"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { CacheKeys, invalidate, invalidateCache } from "@/lib/cache"
import { uuidSchema, validate } from "@/lib/validations"
import { requireAuth } from "../auth-helpers"
import { createTaskSchema, updateTaskSchema } from "./schemas"
import type { Task, TaskInsert, TaskUpdate, TaskStatus } from "@/lib/supabase/types"
import type { ActionResult } from "../types"
import { notify } from "../notifications"
import { createTaskActivity } from "../task-activities"
import { evaluateDoDWarningsForTask, evaluateDoDForTask } from "../dod-policies"

// Create task
export async function createTask(
  projectId: string,
  data: Omit<TaskInsert, "project_id">
): Promise<ActionResult<Task>> {
  // Validate project ID
  const projectValidation = validate(uuidSchema, projectId)
  if (!projectValidation.success) {
    return { error: "Invalid project ID" }
  }

  // Validate task data
  const validation = validate(createTaskSchema, data)
  if (!validation.success) {
    return { error: validation.error }
  }

  const validatedData = validation.data
  const assignedAgentId = (validatedData as { assigned_agent_id?: string | null }).assigned_agent_id ?? null

  const normalizedData = {
    ...validatedData,
    assigned_agent_id: validatedData.assignee_id ? null : assignedAgentId,
  }

  // Use requireAuth to ensure user is authenticated (throws if not)
  const { user, supabase } = await requireAuth()

  // Build sort_order query (scope by sibling set)
  const sortOrderQuery = normalizedData.parent_task_id
    ? supabase
        .from("tasks")
        .select("sort_order")
        .eq("project_id", projectId)
        .eq("parent_task_id", normalizedData.parent_task_id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single()
    : normalizedData.workstream_id
    ? supabase
        .from("tasks")
        .select("sort_order")
        .eq("workstream_id", normalizedData.workstream_id)
        .is("parent_task_id", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single()
    : supabase
        .from("tasks")
        .select("sort_order")
        .eq("project_id", projectId)
        .is("workstream_id", null)
        .is("parent_task_id", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single()

  // Parallel fetch: sort_order AND project org_id (eliminates 1 waterfall)
  const [sortOrderResult, projectResult] = await Promise.all([
    sortOrderQuery,
    supabase
      .from("projects")
      .select("organization_id")
      .eq("id", projectId)
      .single(),
  ])

  const sortOrder = sortOrderResult.data ? sortOrderResult.data.sort_order + 1 : 0
  const project = projectResult.data

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      ...normalizedData,
      project_id: projectId,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    // Create "created" activity record (deferred — not needed for response)
    await createTaskActivity(task.id, "created")

    revalidatePath(`/projects/${projectId}`)
    revalidatePath("/tasks")
    revalidateTag(CacheTags.projectDetails(projectId))
    await invalidateCache.task({
      projectId,
      assigneeId: normalizedData.assignee_id ?? null,
      orgId: project?.organization_id ?? "",
    })
    if (assignedAgentId && project?.organization_id) {
      await invalidate.key(CacheKeys.userTasks(user.id, project.organization_id))
    }

    // Notify assignee when task is created with assignment
    if (user && normalizedData.assignee_id && project?.organization_id) {
      await notify({
        orgId: project.organization_id,
        userIds: [normalizedData.assignee_id],
        actorId: user.id,
        type: "task_update",
        title: `assigned you to "${task.name}"`,
        projectId: task.project_id,
        taskId: task.id,
      })
    }
  })

  return { data: task }
}

// Update task
export async function updateTask(
  id: string,
  data: TaskUpdate
): Promise<ActionResult<Task>> {
  // Validate task ID
  const idValidation = validate(uuidSchema, id)
  if (!idValidation.success) {
    return { error: "Invalid task ID" }
  }

  // Validate update data against schema (strips unknown fields, enforces constraints)
  const validation = validate(updateTaskSchema, data)
  if (!validation.success) {
    return { error: validation.error }
  }
  const validatedData = validation.data

  const normalizedData: TaskUpdate = { ...validatedData }
  if (normalizedData.assignee_id !== undefined) {
    if (normalizedData.assignee_id) {
      normalizedData.assigned_agent_id = null
      normalizedData.task_type = "user"
      normalizedData.dispatch_status = "pending"
    } else if (normalizedData.assignee_id === null && normalizedData.assigned_agent_id === undefined) {
      normalizedData.task_type = "user"
      normalizedData.dispatch_status = "pending"
    }
  }

  const assignedAgentId = (normalizedData as { assigned_agent_id?: string | null }).assigned_agent_id

  // Guard against empty updates (e.g., all fields stripped by schema)
  if (Object.keys(normalizedData).length === 0) {
    return { error: "No valid fields to update" }
  }

  // Use requireAuth to ensure user is authenticated (throws if not)
  const { user, supabase } = await requireAuth()

  // Get old task state for comparison (needed for notifications)
  const { data: oldTask } = await supabase
    .from("tasks")
    .select("*, project:projects(id, name, organization_id)")
    .eq("id", id)
    .single()

  // DoD block enforcement: prevent status→done when block-mode policies fail
  const oldOrgId = (oldTask?.project as { organization_id?: string } | null)?.organization_id ?? ""
  const isTransitionToDone =
    normalizedData.status === "done" &&
    oldTask?.status !== "done" &&
    !!oldTask?.project_id &&
    !!oldOrgId

  if (isTransitionToDone && oldTask) {
    const dodResult = await evaluateDoDForTask({
      ...(oldTask as Record<string, unknown>),
      ...(normalizedData as Record<string, unknown>),
      id,
      project_id: oldTask.project_id,
      organization_id: oldOrgId,
    })

    if (dodResult.data && dodResult.data.blockers.length > 0) {
      const blockerMessages = dodResult.data.blockers.map((b) => b.message).join("; ")
      return { error: `Blocked by DoD policy: ${blockerMessages}` }
    }
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .update(normalizedData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // orgId was already derived above as oldOrgId
  const orgId = oldOrgId
  const creatorId = (oldTask as { created_by?: string } | null)?.created_by ?? null

  const shouldEvaluateDoDWarnMode = isTransitionToDone

  after(async () => {
    if (shouldEvaluateDoDWarnMode && oldTask) {
      await evaluateDoDWarningsForTask({
        ...(oldTask as Record<string, unknown>),
        ...(normalizedData as Record<string, unknown>),
        id: task.id,
        project_id: task.project_id,
        organization_id: orgId,
      })
    }

    // Track activities for changed fields (deferred — not needed for response)
    if (oldTask) {
      const activityPromises: Promise<unknown>[] = []

      // Track name change
      if (normalizedData.name !== undefined && normalizedData.name !== oldTask.name) {
        activityPromises.push(
          createTaskActivity(id, "name_changed", oldTask.name, normalizedData.name)
        )
      }

      // Track status change
      if (normalizedData.status !== undefined && normalizedData.status !== oldTask.status) {
        activityPromises.push(
          createTaskActivity(id, "status_changed", oldTask.status, normalizedData.status)
        )
      }

      // Track assignee change — batch-fetch all needed profiles in one query
      if (normalizedData.assignee_id !== undefined && normalizedData.assignee_id !== oldTask.assignee_id) {
        const profileIds = [normalizedData.assignee_id, oldTask.assignee_id].filter((pid): pid is string => !!pid)
        const { data: profiles } = profileIds.length > 0
          ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
          : { data: [] as { id: string; full_name: string | null; email: string }[] }
        const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

        if (normalizedData.assignee_id && !oldTask.assignee_id) {
          const assignee = profileMap.get(normalizedData.assignee_id)
          activityPromises.push(
            createTaskActivity(id, "assignee_changed", null, normalizedData.assignee_id, {
              new_assignee_name: assignee?.full_name || assignee?.email || "Unknown",
            })
          )
        } else if (!normalizedData.assignee_id && oldTask.assignee_id) {
          const oldAssignee = profileMap.get(oldTask.assignee_id)
          activityPromises.push(
            createTaskActivity(id, "assignee_removed", oldTask.assignee_id, null, {
              old_assignee_name: oldAssignee?.full_name || oldAssignee?.email || "Unknown",
            })
          )
        } else if (normalizedData.assignee_id && oldTask.assignee_id) {
          const oldAssignee = profileMap.get(oldTask.assignee_id)
          const newAssignee = profileMap.get(normalizedData.assignee_id)
          activityPromises.push(
            createTaskActivity(id, "assignee_changed", oldTask.assignee_id, normalizedData.assignee_id, {
              old_assignee_name: oldAssignee?.full_name || oldAssignee?.email || "Unknown",
              new_assignee_name: newAssignee?.full_name || newAssignee?.email || "Unknown",
            })
          )
        }
      }

      // Track priority change
      if (normalizedData.priority !== undefined && normalizedData.priority !== oldTask.priority) {
        activityPromises.push(
          createTaskActivity(id, "priority_changed", oldTask.priority, normalizedData.priority)
        )
      }

      // Track due date (end_date) change
      if (normalizedData.end_date !== undefined && normalizedData.end_date !== oldTask.end_date) {
        activityPromises.push(
          createTaskActivity(id, "due_date_changed", oldTask.end_date, normalizedData.end_date)
        )
      }

      // Track start date change
      if (normalizedData.start_date !== undefined && normalizedData.start_date !== oldTask.start_date) {
        activityPromises.push(
          createTaskActivity(id, "start_date_changed", oldTask.start_date, normalizedData.start_date)
        )
      }

      // Track workstream change
      if (normalizedData.workstream_id !== undefined && normalizedData.workstream_id !== oldTask.workstream_id) {
        let workstreamName: string | null = null
        if (normalizedData.workstream_id) {
          const { data: ws } = await supabase
            .from("workstreams")
            .select("name")
            .eq("id", normalizedData.workstream_id)
            .single()
          workstreamName = ws?.name ?? null
        }
        activityPromises.push(
          createTaskActivity(id, "workstream_changed", oldTask.workstream_id, normalizedData.workstream_id, {
            workstream_name: workstreamName,
          })
        )
      }

      // Track description change
      if (normalizedData.description !== undefined && normalizedData.description !== oldTask.description) {
        activityPromises.push(
          createTaskActivity(id, "description_changed", null, null)
        )
      }

      // Track tag change
      if (normalizedData.tag !== undefined && normalizedData.tag !== oldTask.tag) {
        activityPromises.push(
          createTaskActivity(id, "tag_changed", oldTask.tag, normalizedData.tag)
        )
      }

      // Execute all activity creations in parallel
      await Promise.all(activityPromises)
    }

    // Cache invalidation
    revalidatePath("/projects")
    revalidatePath("/tasks")
    invalidateCache.taskTimeline({ taskId: id })
    if (task.project_id) {
      await invalidateCache.task({
        taskId: id,
        projectId: task.project_id,
        assigneeId: task.assignee_id,
        orgId,
      })
    }

    if (
      orgId &&
      creatorId &&
      assignedAgentId !== undefined &&
      assignedAgentId !== (oldTask as { assigned_agent_id?: string | null } | null)?.assigned_agent_id
    ) {
      await invalidate.key(CacheKeys.userTasks(creatorId, orgId))
    }

    // Send notifications for significant changes
    if (user && oldTask && orgId) {
      const projectName = (oldTask.project as { name: string } | null)?.name ?? "project"

      // Notify on assignee change
      if (normalizedData.assignee_id !== undefined && normalizedData.assignee_id !== oldTask.assignee_id) {
        // Notify new assignee
        if (normalizedData.assignee_id) {
          await notify({
            orgId,
            userIds: [normalizedData.assignee_id],
            actorId: user.id,
            type: "task_update",
            title: `assigned you to "${task.name}"`,
            projectId: task.project_id,
            taskId: task.id,
          })
        }
        // Notify old assignee they were removed
        if (oldTask.assignee_id) {
          await notify({
            orgId,
            userIds: [oldTask.assignee_id],
            actorId: user.id,
            type: "task_update",
            title: `removed you from "${task.name}"`,
            projectId: task.project_id,
            taskId: task.id,
          })
        }
      }

      // Notify on status change (only if task has assignee)
      if (normalizedData.status !== undefined && normalizedData.status !== oldTask.status && task.assignee_id) {
        await notify({
          orgId,
          userIds: [task.assignee_id],
          actorId: user.id,
          type: "task_update",
          title: `updated "${task.name}" status to ${normalizedData.status}`,
          projectId: task.project_id,
          taskId: task.id,
        })
      }

      // Notify on priority escalation to high/urgent (only if task has assignee)
      if (
        normalizedData.priority !== undefined &&
        normalizedData.priority !== oldTask.priority &&
        (normalizedData.priority === "high" || normalizedData.priority === "urgent") &&
        task.assignee_id
      ) {
        await notify({
          orgId,
          userIds: [task.assignee_id],
          actorId: user.id,
          type: "task_update",
          title: `marked "${task.name}" as ${normalizedData.priority} priority`,
          projectId: task.project_id,
          taskId: task.id,
        })
      }
    }
  })

  return { data: task }
}

// Update task status
export async function updateTaskStatus(
  id: string,
  status: TaskStatus
): Promise<ActionResult<Task>> {
  return updateTask(id, { status })
}

// Update task assignee
export async function updateTaskAssignee(
  id: string,
  assigneeId: string | null
): Promise<ActionResult<Task>> {
  return updateTask(id, { assignee_id: assigneeId })
}

// Delete task
export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth()

  // Get task info + org_id in a single join query (eliminates 1 sequential query)
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, assignee_id, project:projects(organization_id)")
    .eq("id", id)
    .single()

  const orgId = (task?.project as { organization_id?: string } | null)?.organization_id ?? ""

  const { error } = await supabase.from("tasks").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    if (task) {
      revalidatePath(`/projects/${task.project_id}`)
      await invalidateCache.task({
        taskId: id,
        projectId: task.project_id,
        assigneeId: task.assignee_id,
        orgId,
      })
    }
    revalidatePath("/tasks")
  })

  return {}
}
