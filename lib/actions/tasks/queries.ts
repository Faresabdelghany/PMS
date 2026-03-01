"use server"

import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { cachedGetUser } from "@/lib/request-cache"
import { requireAuth } from "../auth-helpers"
import { sanitizeSearchInput } from "@/lib/search-utils"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"
import { encodeCursor, decodeCursor } from "../cursor"
import { createTaskStatusCounts, createTaskPriorityCounts } from "@/lib/constants/status"
import type { TaskStatus, TaskPriority } from "@/lib/supabase/types"
import type { ActionResult, PaginatedResult } from "../types"
import type { TaskFilters, TaskWithRelations } from "./types"

async function attachSubtaskCounts(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  tasks: TaskWithRelations[]
): Promise<TaskWithRelations[]> {
  if (!tasks.length) return tasks

  const parentIds = tasks.map((task) => task.id)
  const { data: subtasks } = await supabase
    .from("tasks")
    .select("id, parent_task_id, status")
    .in("parent_task_id", parentIds)

  const counts = new Map<string, { total: number; done: number }>()
  for (const subtask of subtasks || []) {
    const parentId = subtask.parent_task_id
    if (!parentId) continue
    const bucket = counts.get(parentId) ?? { total: 0, done: 0 }
    bucket.total += 1
    if (subtask.status === "done") bucket.done += 1
    counts.set(parentId, bucket)
  }

  return tasks.map((task) => ({
    ...task,
    subtask_count: counts.get(task.id)?.total ?? 0,
    done_subtask_count: counts.get(task.id)?.done ?? 0,
  }))
}

export async function getTasks(
  projectId: string,
  filters?: TaskFilters,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<TaskWithRelations>> {
  const { supabase } = await requireAuth()

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name)
    `)
    .eq("project_id", projectId)
    .is("parent_task_id", null)

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.priority) query = query.eq("priority", filters.priority)
  if (filters?.assigneeId) query = query.eq("assignee_id", filters.assigneeId)
  if (filters?.workstreamId) query = query.eq("workstream_id", filters.workstreamId)

  if (filters?.search) {
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      const cursorSort = Number(value)
      if (Number.isNaN(cursorSort)) return { error: "Invalid cursor value" }
      query = query.or(`sort_order.gt.${cursorSort},and(sort_order.eq.${cursorSort},id.gt.${id})`)
    } catch {
      return { error: "Invalid cursor" }
    }

    const { data, error } = await query.order("sort_order").order("id").limit(limit + 1)
    if (error) return { error: error.message }

    const hasMore = (data?.length || 0) > limit
    const items = hasMore ? data!.slice(0, limit) : (data || [])
    const nextCursor = hasMore
      ? encodeCursor(items[items.length - 1].sort_order, items[items.length - 1].id)
      : null

    return {
      data: await attachSubtaskCounts(supabase, items as TaskWithRelations[]),
      nextCursor,
      hasMore,
    }
  }

  const { data, error } = await query.order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(1000)
  if (error) return { error: error.message }

  const tasks = await attachSubtaskCounts(supabase, (data || []) as TaskWithRelations[])
  return { data: tasks, nextCursor: null, hasMore: false }
}

export async function getMyTasks(
  orgId: string,
  filters?: Omit<TaskFilters, "assigneeId">,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<TaskWithRelations>> {
  const { user, error: authError, supabase } = await cachedGetUser()
  if (authError || !user) return { error: "Not authenticated" }

  const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

  if (!hasFilters && !cursor) {
    try {
      const cached = await cacheGet(
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
            .is("parent_task_id", null)
            .order("updated_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit + 1)

          if (error) throw error
          const raw = await attachSubtaskCounts(supabase as never, data as TaskWithRelations[])
          const hasMore = raw.length > limit
          const items = hasMore ? raw.slice(0, limit) : raw
          const nextCursor = hasMore
            ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
            : null
          return { data: items, nextCursor, hasMore }
        },
        CacheTTL.TASKS
      )
      return cached
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to fetch tasks" }
    }
  }

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
    .is("parent_task_id", null)

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.priority) query = query.eq("priority", filters.priority)

  if (filters?.search) {
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      query = query.or(`updated_at.lt.${value},and(updated_at.eq.${value},id.lt.${id})`)
    } catch {
      return { error: "Invalid cursor" }
    }
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1)
  if (error) return { error: error.message }

  const withCounts = await attachSubtaskCounts(supabase as never, (data || []) as TaskWithRelations[])
  const hasMore = withCounts.length > limit
  const items = hasMore ? withCounts.slice(0, limit) : withCounts
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
    : null

  return { data: items, nextCursor, hasMore }
}

export async function getAllTasks(
  orgId: string,
  filters?: TaskFilters,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<TaskWithRelations>> {
  const { user, error: authError, supabase } = await cachedGetUser()
  if (authError || !user) return { error: "Not authenticated" }

  const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

  if (!hasFilters && !cursor) {
    try {
      const cached = await cacheGet(
        CacheKeys.orgTasks(orgId),
        async () => {
          const { data, error } = await supabase
            .from("tasks")
            .select(`
              *,
              assignee:profiles(id, full_name, email, avatar_url),
              workstream:workstreams(id, name),
              project:projects!inner(id, name, organization_id)
            `)
            .eq("project.organization_id", orgId)
            .is("parent_task_id", null)
            .order("updated_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit + 1)

          if (error) throw error
          const raw = await attachSubtaskCounts(supabase as never, data as TaskWithRelations[])
          const hasMore = raw.length > limit
          const items = hasMore ? raw.slice(0, limit) : raw
          const nextCursor = hasMore
            ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
            : null
          return { data: items, nextCursor, hasMore }
        },
        CacheTTL.TASKS
      )
      return cached
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to fetch tasks" }
    }
  }

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name),
      project:projects!inner(id, name, organization_id)
    `)
    .eq("project.organization_id", orgId)
    .is("parent_task_id", null)

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.priority) query = query.eq("priority", filters.priority)
  if (filters?.assigneeId) query = query.eq("assignee_id", filters.assigneeId)
  if (filters?.workstreamId) query = query.eq("workstream_id", filters.workstreamId)

  if (filters?.search) {
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      query = query.or(`updated_at.lt.${value},and(updated_at.eq.${value},id.lt.${id})`)
    } catch {
      return { error: "Invalid cursor" }
    }
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1)
  if (error) return { error: error.message }

  const withCounts = await attachSubtaskCounts(supabase as never, (data || []) as TaskWithRelations[])
  const hasMore = withCounts.length > limit
  const items = hasMore ? withCounts.slice(0, limit) : withCounts
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
    : null

  return { data: items, nextCursor, hasMore }
}

export async function getTask(id: string): Promise<ActionResult<TaskWithRelations>> {
  const { supabase } = await requireAuth()

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

  if (error) return { error: error.message }
  return { data: data as TaskWithRelations }
}

export async function getSubtasks(parentTaskId: string): Promise<ActionResult<TaskWithRelations[]>> {
  const { supabase } = await requireAuth()
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name),
      project:projects(id, name)
    `)
    .eq("parent_task_id", parentTaskId)
    .order("sort_order", { ascending: true })

  if (error) return { error: error.message }
  return { data: (data || []) as TaskWithRelations[] }
}

export async function getTaskStats(projectId: string): Promise<
  ActionResult<{ total: number; byStatus: Record<TaskStatus, number>; byPriority: Record<TaskPriority, number> }>
> {
  const { supabase } = await requireAuth()
  const { data, error } = await supabase.rpc("get_task_stats", { p_project_id: projectId })
  if (error) return { error: error.message }

  const stats = data as { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }
  const byStatus = { ...createTaskStatusCounts(), ...stats.byStatus }
  const byPriority = { ...createTaskPriorityCounts(), ...stats.byPriority }

  return {
    data: {
      total: stats.total,
      byStatus: byStatus as Record<TaskStatus, number>,
      byPriority: byPriority as Record<TaskPriority, number>,
    },
  }
}
