"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { invalidateCache } from "@/lib/cache"
import { uuidSchema, validate } from "@/lib/validations"
import { requireAuth } from "../auth-helpers"
import { createTaskSchema, updateTaskSchema } from "./schemas"
import type { Task, TaskInsert, TaskUpdate, TaskStatus } from "@/lib/supabase/types"
import type { ActionResult } from "../types"
import { notify } from "../notifications"
import { createTaskActivity } from "../task-activities"

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

  // Use requireAuth to ensure user is authenticated (throws if not)
  const { user, supabase } = await requireAuth()

  // Build sort_order query based on workstream
  const sortOrderQuery = validatedData.workstream_id
    ? supabase
        .from("tasks")
        .select("sort_order")
        .eq("workstream_id", validatedData.workstream_id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single()
    : supabase
        .from("tasks")
        .select("sort_order")
        .eq("project_id", projectId)
        .is("workstream_id", null)
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
      ...validatedData,
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
      assigneeId: validatedData.assignee_id ?? null,
      orgId: project?.organization_id ?? "",
    })

    // Notify assignee when task is created with assignment
    if (user && validatedData.assignee_id && project?.organization_id) {
      await notify({
        orgId: project.organization_id,
        userIds: [validatedData.assignee_id],
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

  // Guard against empty updates (e.g., all fields stripped by schema)
  if (Object.keys(validatedData).length === 0) {
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

  const { data: task, error } = await supabase
    .from("tasks")
    .update(validatedData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Get orgId from the already-fetched oldTask (includes project with organization_id)
  // This avoids an extra sequential query after the update
  const orgId = (oldTask?.project as { organization_id?: string } | null)?.organization_id ?? ""

  after(async () => {
    // Track activities for changed fields (deferred — not needed for response)
    if (oldTask) {
      const activityPromises: Promise<unknown>[] = []

      // Track name change
      if (validatedData.name !== undefined && validatedData.name !== oldTask.name) {
        activityPromises.push(
          createTaskActivity(id, "name_changed", oldTask.name, validatedData.name)
        )
      }

      // Track status change
      if (validatedData.status !== undefined && validatedData.status !== oldTask.status) {
        activityPromises.push(
          createTaskActivity(id, "status_changed", oldTask.status, validatedData.status)
        )
      }

      // Track assignee change — batch-fetch all needed profiles in one query
      if (validatedData.assignee_id !== undefined && validatedData.assignee_id !== oldTask.assignee_id) {
        const profileIds = [validatedData.assignee_id, oldTask.assignee_id].filter((pid): pid is string => !!pid)
        const { data: profiles } = profileIds.length > 0
          ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
          : { data: [] as { id: string; full_name: string | null; email: string }[] }
        const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

        if (validatedData.assignee_id && !oldTask.assignee_id) {
          const assignee = profileMap.get(validatedData.assignee_id)
          activityPromises.push(
            createTaskActivity(id, "assignee_changed", null, validatedData.assignee_id, {
              new_assignee_name: assignee?.full_name || assignee?.email || "Unknown",
            })
          )
        } else if (!validatedData.assignee_id && oldTask.assignee_id) {
          const oldAssignee = profileMap.get(oldTask.assignee_id)
          activityPromises.push(
            createTaskActivity(id, "assignee_removed", oldTask.assignee_id, null, {
              old_assignee_name: oldAssignee?.full_name || oldAssignee?.email || "Unknown",
            })
          )
        } else if (validatedData.assignee_id && oldTask.assignee_id) {
          const oldAssignee = profileMap.get(oldTask.assignee_id)
          const newAssignee = profileMap.get(validatedData.assignee_id)
          activityPromises.push(
            createTaskActivity(id, "assignee_changed", oldTask.assignee_id, validatedData.assignee_id, {
              old_assignee_name: oldAssignee?.full_name || oldAssignee?.email || "Unknown",
              new_assignee_name: newAssignee?.full_name || newAssignee?.email || "Unknown",
            })
          )
        }
      }

      // Track priority change
      if (validatedData.priority !== undefined && validatedData.priority !== oldTask.priority) {
        activityPromises.push(
          createTaskActivity(id, "priority_changed", oldTask.priority, validatedData.priority)
        )
      }

      // Track due date (end_date) change
      if (validatedData.end_date !== undefined && validatedData.end_date !== oldTask.end_date) {
        activityPromises.push(
          createTaskActivity(id, "due_date_changed", oldTask.end_date, validatedData.end_date)
        )
      }

      // Track start date change
      if (validatedData.start_date !== undefined && validatedData.start_date !== oldTask.start_date) {
        activityPromises.push(
          createTaskActivity(id, "start_date_changed", oldTask.start_date, validatedData.start_date)
        )
      }

      // Track workstream change
      if (validatedData.workstream_id !== undefined && validatedData.workstream_id !== oldTask.workstream_id) {
        let workstreamName: string | null = null
        if (validatedData.workstream_id) {
          const { data: ws } = await supabase
            .from("workstreams")
            .select("name")
            .eq("id", validatedData.workstream_id)
            .single()
          workstreamName = ws?.name ?? null
        }
        activityPromises.push(
          createTaskActivity(id, "workstream_changed", oldTask.workstream_id, validatedData.workstream_id, {
            workstream_name: workstreamName,
          })
        )
      }

      // Track description change
      if (validatedData.description !== undefined && validatedData.description !== oldTask.description) {
        activityPromises.push(
          createTaskActivity(id, "description_changed", null, null)
        )
      }

      // Track tag change
      if (validatedData.tag !== undefined && validatedData.tag !== oldTask.tag) {
        activityPromises.push(
          createTaskActivity(id, "tag_changed", oldTask.tag, validatedData.tag)
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

    // Send notifications for significant changes
    if (user && oldTask && orgId) {
      const projectName = (oldTask.project as { name: string } | null)?.name ?? "project"

      // Notify on assignee change
      if (validatedData.assignee_id !== undefined && validatedData.assignee_id !== oldTask.assignee_id) {
        // Notify new assignee
        if (validatedData.assignee_id) {
          await notify({
            orgId,
            userIds: [validatedData.assignee_id],
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
      if (validatedData.status !== undefined && validatedData.status !== oldTask.status && task.assignee_id) {
        await notify({
          orgId,
          userIds: [task.assignee_id],
          actorId: user.id,
          type: "task_update",
          title: `updated "${task.name}" status to ${validatedData.status}`,
          projectId: task.project_id,
          taskId: task.id,
        })
      }

      // Notify on priority escalation to high/urgent (only if task has assignee)
      if (
        validatedData.priority !== undefined &&
        validatedData.priority !== oldTask.priority &&
        (validatedData.priority === "high" || validatedData.priority === "urgent") &&
        task.assignee_id
      ) {
        await notify({
          orgId,
          userIds: [task.assignee_id],
          actorId: user.id,
          type: "task_update",
          title: `marked "${task.name}" as ${validatedData.priority} priority`,
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
