"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import { uuidSchema, validate } from "@/lib/validations"
import type { Task, TaskInsert, TaskUpdate, TaskStatus, TaskPriority } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Task validation schemas
const createTaskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Task name is required")
    .max(500, "Task name must be less than 500 characters"),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(["todo", "in-progress", "done"]).default("todo"),
  priority: z.enum(["no-priority", "low", "medium", "high", "urgent"]).default("medium"),
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
  const supabase = await createClient()

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
    revalidatePath(`/projects/${projectId}`)
    revalidatePath("/tasks")
    revalidateTag(CacheTags.tasks(projectId))
    revalidateTag(CacheTags.projectDetails(projectId))
    // KV cache invalidation
    await invalidate.task(projectId, validatedData.assignee_id ?? null, project?.organization_id ?? "")
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
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
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
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

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
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
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
  const supabase = await createClient()

  const { data: task, error } = await supabase
    .from("tasks")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Get orgId from project for cache invalidation
  let orgId = ""
  if (task.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("organization_id")
      .eq("id", task.project_id)
      .single()
    orgId = project?.organization_id ?? ""
  }

  after(async () => {
    revalidatePath("/projects")
    revalidatePath("/tasks")
    revalidateTag(CacheTags.task(id))
    if (task.project_id) {
      revalidateTag(CacheTags.tasks(task.project_id))
      // KV cache invalidation
      await invalidate.task(task.project_id, task.assignee_id, orgId)
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

  // Get task info for revalidation and cache invalidation
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, assignee_id")
    .eq("id", id)
    .single()

  // Get orgId from project for cache invalidation
  let orgId = ""
  if (task?.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("organization_id")
      .eq("id", task.project_id)
      .single()
    orgId = project?.organization_id ?? ""
  }

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

  // Get task's project_id and assignee_id
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, assignee_id")
    .eq("id", taskId)
    .single()

  if (!task) {
    return { error: "Task not found" }
  }

  // Get orgId from project for cache invalidation
  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", task.project_id)
    .single()

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
    await invalidate.task(task.project_id, task.assignee_id, project?.organization_id ?? "")
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

  const byStatus: Record<TaskStatus, number> = {
    todo: 0,
    "in-progress": 0,
    done: 0,
  }

  const byPriority: Record<TaskPriority, number> = {
    "no-priority": 0,
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  }

  data.forEach((task) => {
    byStatus[task.status]++
    byPriority[task.priority]++
  })

  return {
    data: {
      total: data.length,
      byStatus,
      byPriority,
    },
  }
}
