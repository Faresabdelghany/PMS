"use server"

import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { cachedGetUser } from "@/lib/request-cache"
import { requireAuth } from "../auth-helpers"
import { sanitizeSearchInput } from "@/lib/search-utils"
import {
  createTaskStatusCounts,
  createTaskPriorityCounts,
} from "@/lib/constants/status"
import type { TaskStatus, TaskPriority } from "@/lib/supabase/types"
import type { ActionResult } from "../types"
import type { TaskFilters, TaskWithRelations } from "./types"

// Get tasks for project with filters
export async function getTasks(
  projectId: string,
  filters?: TaskFilters
): Promise<ActionResult<TaskWithRelations[]>> {
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

// Get task stats for project
export async function getTaskStats(projectId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<TaskStatus, number>
    byPriority: Record<TaskPriority, number>
  }>
> {
  const { supabase } = await requireAuth()

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
