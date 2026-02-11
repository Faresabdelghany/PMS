"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import { uuidSchema, validate } from "@/lib/validations"
import { cachedGetUser } from "@/lib/request-cache"
import { requireAuth } from "./auth-helpers"
import { sanitizeSearchInput } from "@/lib/search-utils"
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  DEFAULT_TASK_STATUS,
  DEFAULT_TASK_PRIORITY,
  createTaskStatusCounts,
  createTaskPriorityCounts,
} from "@/lib/constants/status"
import type { Task, TaskInsert, TaskUpdate, TaskStatus, TaskPriority, TaskActivityAction } from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { notify } from "./notifications"
import { createTaskActivity } from "./task-activities"

// Task validation schemas
const createTaskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Task name is required")
    .max(500, "Task name must be less than 500 characters"),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).default(DEFAULT_TASK_STATUS),
  priority: z.enum(TASK_PRIORITIES).default(DEFAULT_TASK_PRIORITY),
  workstream_id: z.string().uuid().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  tag: z.string().max(50).optional().nullable(),
})

const updateTaskSchema = createTaskSchema.partial()

const reorderTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, "At least one task ID is required"),
  workstreamId: z.string().uuid().optional().nullable(),
})


export type TaskFilters = {
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  workstreamId?: string
  search?: string
}

export type TaskWithRelations = Task & {
  assignee?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  workstream?: {
    id: string
    name: string
  } | null
  project?: {
    id: string
    name: string
  } | null
}

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

  // Create "created" activity record
  await createTaskActivity(task.id, "created")

  after(async () => {
    revalidatePath(`/projects/${projectId}`)
    revalidatePath("/tasks")
    revalidateTag(CacheTags.tasks(projectId))
    revalidateTag(CacheTags.projectDetails(projectId))
    // KV cache invalidation
    await invalidate.task(projectId, validatedData.assignee_id ?? null, project?.organization_id ?? "")

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

// Get tasks for project with filters
export async function getTasks(
  projectId: string,
  filters?: TaskFilters
): Promise<ActionResult<TaskWithRelations[]>> {
  const supabase = await createClient()

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name)
    `)
    .eq("project_id", projectId)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.priority) {
    query = query.eq("priority", filters.priority)
  }

  if (filters?.assigneeId) {
    query = query.eq("assignee_id", filters.assigneeId)
  }

  if (filters?.workstreamId) {
    query = query.eq("workstream_id", filters.workstreamId)
  }

  if (filters?.search) {
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  const { data, error } = await query.order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data: data as TaskWithRelations[] }
}

// Get tasks for current user across all projects in an organization
export async function getMyTasks(
  orgId: string,
  filters?: Omit<TaskFilters, "assigneeId">
): Promise<ActionResult<TaskWithRelations[]>> {
  // Use cached auth - deduplicates with other calls in the same request
  const { user, error: authError, supabase } = await cachedGetUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Only cache unfiltered queries
  const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

  if (!hasFilters) {
    try {
      const tasks = await cacheGet(
        CacheKeys.userTasks(user.id, orgId),
        async () => {
          const { data, error } = await supabase
            .from("tasks")
            .select(`
              *,
              assignee:profiles(id, full_name, email, avatar_url),
              workstream:workstreams(id, name),
              project:projects!inner(id, name, organization_id)
            `)
            .eq("assignee_id", user.id)
            .eq("project.organization_id", orgId)
            .order("updated_at", { ascending: false })

          if (error) throw error
          return data as TaskWithRelations[]
        },
        CacheTTL.TASKS
      )
      return { data: tasks }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to fetch tasks" }
    }
  }

  // Filtered query - don't cache
  // Use !inner join to filter by organization at the database level
  // This is more efficient than fetching all tasks and filtering in JS
  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name),
      project:projects!inner(id, name, organization_id)
    `)
    .eq("assignee_id", user.id)
    .eq("project.organization_id", orgId)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.priority) {
    query = query.eq("priority", filters.priority)
  }

  if (filters?.search) {
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  const { data, error } = await query.order("updated_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: data as TaskWithRelations[] }
}

// Get single task
export async function getTask(id: string): Promise<ActionResult<TaskWithRelations>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name),
      project:projects(id, name)
    `)
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as TaskWithRelations }
}

// Update task
export async function updateTask(
  id: string,
  data: TaskUpdate
): Promise<ActionResult<Task>> {
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
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Get orgId from the already-fetched oldTask (includes project with organization_id)
  // This avoids an extra sequential query after the update
  const orgId = (oldTask?.project as { organization_id?: string } | null)?.organization_id ?? ""

  // Track activities for changed fields
  if (oldTask) {
    const activityPromises: Promise<unknown>[] = []

    // Track name change
    if (data.name !== undefined && data.name !== oldTask.name) {
      activityPromises.push(
        createTaskActivity(id, "name_changed", oldTask.name, data.name)
      )
    }

    // Track status change
    if (data.status !== undefined && data.status !== oldTask.status) {
      activityPromises.push(
        createTaskActivity(id, "status_changed", oldTask.status, data.status)
      )
    }

    // Track assignee change — batch-fetch all needed profiles in one query
    if (data.assignee_id !== undefined && data.assignee_id !== oldTask.assignee_id) {
      const profileIds = [data.assignee_id, oldTask.assignee_id].filter((id): id is string => !!id)
      const { data: profiles } = profileIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
        : { data: [] as { id: string; full_name: string | null; email: string }[] }
      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

      if (data.assignee_id && !oldTask.assignee_id) {
        const assignee = profileMap.get(data.assignee_id)
        activityPromises.push(
          createTaskActivity(id, "assignee_changed", null, data.assignee_id, {
            new_assignee_name: assignee?.full_name || assignee?.email || "Unknown",
          })
        )
      } else if (!data.assignee_id && oldTask.assignee_id) {
        const oldAssignee = profileMap.get(oldTask.assignee_id)
        activityPromises.push(
          createTaskActivity(id, "assignee_removed", oldTask.assignee_id, null, {
            old_assignee_name: oldAssignee?.full_name || oldAssignee?.email || "Unknown",
          })
        )
      } else if (data.assignee_id && oldTask.assignee_id) {
        const oldAssignee = profileMap.get(oldTask.assignee_id)
        const newAssignee = profileMap.get(data.assignee_id)
        activityPromises.push(
          createTaskActivity(id, "assignee_changed", oldTask.assignee_id, data.assignee_id, {
            old_assignee_name: oldAssignee?.full_name || oldAssignee?.email || "Unknown",
            new_assignee_name: newAssignee?.full_name || newAssignee?.email || "Unknown",
          })
        )
      }
    }

    // Track priority change
    if (data.priority !== undefined && data.priority !== oldTask.priority) {
      activityPromises.push(
        createTaskActivity(id, "priority_changed", oldTask.priority, data.priority)
      )
    }

    // Track due date (end_date) change
    if (data.end_date !== undefined && data.end_date !== oldTask.end_date) {
      activityPromises.push(
        createTaskActivity(id, "due_date_changed", oldTask.end_date, data.end_date)
      )
    }

    // Track start date change
    if (data.start_date !== undefined && data.start_date !== oldTask.start_date) {
      activityPromises.push(
        createTaskActivity(id, "start_date_changed", oldTask.start_date, data.start_date)
      )
    }

    // Track workstream change
    if (data.workstream_id !== undefined && data.workstream_id !== oldTask.workstream_id) {
      let workstreamName: string | null = null
      if (data.workstream_id) {
        const { data: ws } = await supabase
          .from("workstreams")
          .select("name")
          .eq("id", data.workstream_id)
          .single()
        workstreamName = ws?.name ?? null
      }
      activityPromises.push(
        createTaskActivity(id, "workstream_changed", oldTask.workstream_id, data.workstream_id, {
          workstream_name: workstreamName,
        })
      )
    }

    // Track description change
    if (data.description !== undefined && data.description !== oldTask.description) {
      activityPromises.push(
        createTaskActivity(id, "description_changed", null, null)
      )
    }

    // Track tag change
    if (data.tag !== undefined && data.tag !== oldTask.tag) {
      activityPromises.push(
        createTaskActivity(id, "tag_changed", oldTask.tag, data.tag)
      )
    }

    // Execute all activity creations in parallel
    await Promise.all(activityPromises)
  }

  after(async () => {
    revalidatePath("/projects")
    revalidatePath("/tasks")
    revalidateTag(CacheTags.task(id))
    revalidateTag(CacheTags.taskTimeline(id))
    if (task.project_id) {
      revalidateTag(CacheTags.tasks(task.project_id))
      // KV cache invalidation
      await invalidate.task(task.project_id, task.assignee_id, orgId)
    }

    // Send notifications for significant changes
    if (user && oldTask && orgId) {
      const projectName = (oldTask.project as { name: string } | null)?.name ?? "project"

      // Notify on assignee change
      if (data.assignee_id !== undefined && data.assignee_id !== oldTask.assignee_id) {
        // Notify new assignee
        if (data.assignee_id) {
          await notify({
            orgId,
            userIds: [data.assignee_id],
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
      if (data.status !== undefined && data.status !== oldTask.status && task.assignee_id) {
        await notify({
          orgId,
          userIds: [task.assignee_id],
          actorId: user.id,
          type: "task_update",
          title: `updated "${task.name}" status to ${data.status}`,
          projectId: task.project_id,
          taskId: task.id,
        })
      }

      // Notify on priority escalation to high/urgent (only if task has assignee)
      if (
        data.priority !== undefined &&
        data.priority !== oldTask.priority &&
        (data.priority === "high" || data.priority === "urgent") &&
        task.assignee_id
      ) {
        await notify({
          orgId,
          userIds: [task.assignee_id],
          actorId: user.id,
          type: "task_update",
          title: `marked "${task.name}" as ${data.priority} priority`,
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
  const supabase = await createClient()

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
    revalidateTag(CacheTags.task(id))
    if (task) {
      revalidatePath(`/projects/${task.project_id}`)
      revalidateTag(CacheTags.tasks(task.project_id))
      // KV cache invalidation
      await invalidate.task(task.project_id, task.assignee_id, orgId)
    }
    revalidatePath("/tasks")
  })

  return {}
}

// Reorder tasks within a workstream
export async function reorderTasks(
  workstreamId: string | null,
  projectId: string,
  taskIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get orgId from project for cache invalidation
  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .single()

  // Update sort_order for each task
  const updates = taskIds.map((id, index) =>
    supabase.from("tasks").update({ sort_order: index }).eq("id", id)
  )

  const results = await Promise.all(updates)
  const error = results.find((r) => r.error)?.error

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath(`/projects/${projectId}`)
    revalidateTag(CacheTags.tasks(projectId))
    // KV cache invalidation - invalidate project tasks cache
    await invalidate.key(CacheKeys.projectTasks(projectId))
  })

  return {}
}

// Move task to different workstream
export async function moveTaskToWorkstream(
  taskId: string,
  newWorkstreamId: string | null,
  newIndex: number
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get task's project_id, assignee_id, and org_id in a single join query (eliminates 1 sequential query)
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, assignee_id, project:projects(organization_id)")
    .eq("id", taskId)
    .single()

  if (!task) {
    return { error: "Task not found" }
  }

  const orgId = (task.project as { organization_id?: string } | null)?.organization_id ?? ""

  // Update task's workstream and sort_order
  const { error } = await supabase
    .from("tasks")
    .update({
      workstream_id: newWorkstreamId,
      sort_order: newIndex,
    })
    .eq("id", taskId)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath(`/projects/${task.project_id}`)
    revalidateTag(CacheTags.task(taskId))
    revalidateTag(CacheTags.tasks(task.project_id))
    // KV cache invalidation
    await invalidate.task(task.project_id, task.assignee_id, orgId)
  })

  return {}
}

// Bulk update task status
export async function bulkUpdateTaskStatus(
  taskIds: string[],
  status: TaskStatus
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get task info for cache invalidation before update
  const { data: tasks } = await supabase
    .from("tasks")
    .select("project_id, assignee_id")
    .in("id", taskIds)

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .in("id", taskIds)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    // Invalidate individual task caches
    taskIds.forEach(id => revalidateTag(CacheTags.task(id)))
    revalidatePath("/projects")
    revalidatePath("/tasks")

    // KV cache invalidation - invalidate affected project and user task caches
    if (tasks && tasks.length > 0) {
      const projectIds = new Set<string>()
      const assigneeIds = new Set<string>()

      for (const task of tasks) {
        if (task.project_id) projectIds.add(task.project_id)
        if (task.assignee_id) assigneeIds.add(task.assignee_id)
      }

      // Get orgIds for all affected projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, organization_id")
        .in("id", Array.from(projectIds))

      const projectOrgMap = new Map(projects?.map(p => [p.id, p.organization_id]) ?? [])

      // Invalidate project task caches
      for (const projectId of projectIds) {
        await invalidate.key(CacheKeys.projectTasks(projectId))
      }

      // Invalidate user task caches
      for (const assigneeId of assigneeIds) {
        for (const [projectId, orgId] of projectOrgMap) {
          if (orgId) {
            await invalidate.key(CacheKeys.userTasks(assigneeId, orgId))
          }
        }
      }
    }
  })

  return {}
}

// Get task stats for project
export async function getTaskStats(projectId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<TaskStatus, number>
    byPriority: Record<TaskPriority, number>
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tasks")
    .select("status, priority")
    .eq("project_id", projectId)

  if (error) {
    return { error: error.message }
  }

  const byStatus = createTaskStatusCounts()
  const byPriority = createTaskPriorityCounts()

  data.forEach((task) => {
    if (task.status in byStatus) {
      byStatus[task.status as TaskStatus]++
    }
    if (task.priority in byPriority) {
      byPriority[task.priority as TaskPriority]++
    }
  })

  return {
    data: {
      total: data.length,
      byStatus,
      byPriority,
    },
  }
}
