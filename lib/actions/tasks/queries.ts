"use server"

import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { cachedGetUser } from "@/lib/request-cache"
import { requireAuth } from "../auth-helpers"
import { sanitizeSearchInput } from "@/lib/search-utils"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"
import { encodeCursor, decodeCursor } from "../cursor"
import {
  createTaskStatusCounts,
  createTaskPriorityCounts,
} from "@/lib/constants/status"
import type { TaskStatus, TaskPriority } from "@/lib/supabase/types"
import type { ActionResult, PaginatedResult } from "../types"
import type { TaskFilters, TaskWithRelations } from "./types"

// Get tasks for a project with filters.
// When no cursor is provided, returns ALL tasks (needed for board/drag-drop views).
// When a cursor is provided, returns paginated results.
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

  // When cursor is provided, paginate. Otherwise return all tasks.
  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      const cursorSort = Number(value)
      if (Number.isNaN(cursorSort)) {
        return { error: "Invalid cursor value" }
      }
      // Compound cursor: (sort_order > cursor) OR (sort_order = cursor AND id > cursorId)
      query = query.or(
        `sort_order.gt.${cursorSort},and(sort_order.eq.${cursorSort},id.gt.${id})`
      )
    } catch {
      return { error: "Invalid cursor" }
    }

    const { data, error } = await query
      .order("sort_order")
      .order("id")
      .limit(limit + 1)

    if (error) {
      return { error: error.message }
    }

    const hasMore = (data?.length || 0) > limit
    const items = hasMore ? data!.slice(0, limit) : (data || [])
    const nextCursor = hasMore
      ? encodeCursor(items[items.length - 1].sort_order, items[items.length - 1].id)
      : null

    return { data: items as TaskWithRelations[], nextCursor, hasMore }
  }

  // No cursor: return all tasks (board view, drag-drop, timeline need full set)
  const { data, error } = await query.order("sort_order", { ascending: true }).order("id", { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data: (data || []) as TaskWithRelations[], nextCursor: null, hasMore: false }
}

// Get tasks for current user across all projects in an organization
export async function getMyTasks(
  orgId: string,
  filters?: Omit<TaskFilters, "assigneeId">,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<TaskWithRelations>> {
  // Use cached auth - deduplicates with other calls in the same request
  const { user, error: authError, supabase } = await cachedGetUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Only cache unfiltered, first-page queries
  const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

  if (!hasFilters && !cursor) {
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
            .order("id", { ascending: false })
            .limit(limit + 1)

          if (error) throw error
          return data as TaskWithRelations[]
        },
        CacheTTL.TASKS
      )

      const hasMore = tasks.length > limit
      const items = hasMore ? tasks.slice(0, limit) : tasks
      const nextCursor = hasMore
        ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
        : null

      return { data: items, nextCursor, hasMore }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to fetch tasks" }
    }
  }

  // Filtered or cursor query - don't cache
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

  // Compound cursor: (updated_at, id) DESC
  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      query = query.or(
        `updated_at.lt.${value},and(updated_at.eq.${value},id.lt.${id})`
      )
    } catch {
      return { error: "Invalid cursor" }
    }
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)

  if (error) {
    return { error: error.message }
  }

  const hasMore = (data?.length || 0) > limit
  const items = hasMore ? data!.slice(0, limit) : (data || [])
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
    : null

  return {
    data: items as TaskWithRelations[],
    nextCursor,
    hasMore,
  }
}

// Get single task
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

  if (error) {
    return { error: error.message }
  }

  return { data: data as TaskWithRelations }
}

// Get task stats for project (uses SQL aggregation RPC — single row instead of N rows)
export async function getTaskStats(projectId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<TaskStatus, number>
    byPriority: Record<TaskPriority, number>
  }>
> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase.rpc("get_task_stats", {
    p_project_id: projectId,
  })

  if (error) {
    return { error: error.message }
  }

  // RPC returns JSON with the exact shape we need
  const stats = data as {
    total: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
  }

  // Merge with defaults to ensure all keys exist
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
