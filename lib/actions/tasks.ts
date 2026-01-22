"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Task, TaskInsert, TaskUpdate, TaskStatus, TaskPriority } from "@/lib/supabase/types"

export type ActionResult<T = void> = {
  error?: string
  data?: T
}

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
  const supabase = await createClient()

  // Get max sort_order for the workstream (or project if no workstream)
  let sortOrder = 0
  if (data.workstream_id) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("sort_order")
      .eq("workstream_id", data.workstream_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single()
    sortOrder = existing ? existing.sort_order + 1 : 0
  } else {
    const { data: existing } = await supabase
      .from("tasks")
      .select("sort_order")
      .eq("project_id", projectId)
      .is("workstream_id", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single()
    sortOrder = existing ? existing.sort_order + 1 : 0
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      ...data,
      project_id: projectId,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/tasks")
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

// Get tasks for current user across all projects
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

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name),
      project:projects(id, name, organization_id)
    `)
    .eq("assignee_id", user.id)

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

  // Filter by organization
  const filteredData = data.filter(
    (task) => (task.project as { organization_id: string })?.organization_id === orgId
  )

  return { data: filteredData as TaskWithRelations[] }
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

  revalidatePath("/projects")
  revalidatePath("/tasks")
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

  // Get project_id for revalidation
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("tasks").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  if (task) {
    revalidatePath(`/projects/${task.project_id}`)
  }
  revalidatePath("/tasks")
  return {}
}

// Reorder tasks within a workstream
export async function reorderTasks(
  workstreamId: string | null,
  projectId: string,
  taskIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Update sort_order for each task
  const updates = taskIds.map((id, index) =>
    supabase.from("tasks").update({ sort_order: index }).eq("id", id)
  )

  const results = await Promise.all(updates)
  const error = results.find((r) => r.error)?.error

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// Move task to different workstream
export async function moveTaskToWorkstream(
  taskId: string,
  newWorkstreamId: string | null,
  newIndex: number
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get task's project_id
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single()

  if (!task) {
    return { error: "Task not found" }
  }

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

  revalidatePath(`/projects/${task.project_id}`)
  return {}
}

// Bulk update task status
export async function bulkUpdateTaskStatus(
  taskIds: string[],
  status: TaskStatus
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .in("id", taskIds)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/projects")
  revalidatePath("/tasks")
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
