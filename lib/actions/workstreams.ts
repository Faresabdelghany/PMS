"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireAuth, requireProjectMember } from "./auth-helpers"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import type { Workstream, WorkstreamInsert, WorkstreamUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

export type CreateWorkstreamInput = {
  projectId: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  tag?: string | null
  taskIds?: string[] // Tasks to assign to this workstream
}

// Create workstream with full fields
export async function createWorkstream(
  input: CreateWorkstreamInput
): Promise<ActionResult<Workstream>> {
  const { projectId, name, description, startDate, endDate, tag, taskIds } = input

  // Require project membership — use the returned authenticated client
  let supabase
  try {
    const ctx = await requireProjectMember(projectId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be a project member to create workstreams" }
  }

  // Validate start_date is before end_date (can check without DB)
  if (startDate && endDate) {
    if (new Date(startDate) > new Date(endDate)) {
      return { error: "Start date cannot be after end date" }
    }
  }

  // Parallel fetch: project end_date AND max sort_order (eliminates 1 waterfall)
  const [projectResult, sortOrderResult] = await Promise.all([
    supabase
      .from("projects")
      .select("end_date")
      .eq("id", projectId)
      .single(),
    supabase
      .from("workstreams")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single(),
  ])

  const project = projectResult.data

  // Validate workstream end_date against project end_date
  if (endDate && project?.end_date) {
    if (new Date(endDate) > new Date(project.end_date)) {
      return {
        error: `Workstream end date cannot be after project end date (${project.end_date})`
      }
    }
  }

  const sortOrder = sortOrderResult.data ? sortOrderResult.data.sort_order + 1 : 0

  const { data, error } = await supabase
    .from("workstreams")
    .insert({
      project_id: projectId,
      name,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      tag: tag || null,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // If task IDs provided, assign them to this workstream
  if (taskIds && taskIds.length > 0 && data) {
    // Don't fail the whole operation if task assignment fails, workstream was created
    await supabase
      .from("tasks")
      .update({ workstream_id: data.id })
      .in("id", taskIds)
      .eq("project_id", projectId) // Safety: only update tasks in same project
  }

  after(async () => {
    revalidatePath(`/projects/${projectId}`)
    // KV cache invalidation
    await invalidate.workstream(projectId)
  })

  return { data }
}

// Get workstreams for project
export async function getWorkstreams(
  projectId: string
): Promise<ActionResult<Workstream[]>> {
  try {
    const workstreams = await cacheGet(
      CacheKeys.workstreams(projectId),
      async () => {
        const { supabase } = await requireAuth()
        const { data, error } = await supabase
          .from("workstreams")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order")

        if (error) throw error
        return data ?? []
      },
      CacheTTL.WORKSTREAMS
    )
    return { data: workstreams }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to fetch workstreams" }
  }
}

// Get workstreams with tasks
export async function getWorkstreamsWithTasks(projectId: string): Promise<
  ActionResult<
    (Workstream & {
      tasks: {
        id: string
        name: string
        status: string
        priority: string
        assignee_id: string | null
        start_date: string | null
        end_date: string | null
        tag: string | null
        sort_order: number
      }[]
    })[]
  >
> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("workstreams")
    .select(`
      *,
      tasks(id, name, status, priority, assignee_id, start_date, end_date, tag, sort_order)
    `)
    .eq("project_id", projectId)
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  // Sort tasks within each workstream
  const sortedData = data.map((ws) => ({
    ...ws,
    tasks: ws.tasks.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
  }))

  return { data: sortedData }
}

export type UpdateWorkstreamInput = {
  name?: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  tag?: string | null
  taskIds?: string[] // Tasks to assign to this workstream (replaces current assignments)
}

// Update workstream
export async function updateWorkstream(
  id: string,
  input: UpdateWorkstreamInput
): Promise<ActionResult<Workstream>> {
  // Authenticate first — no DB queries before auth
  const { supabase } = await requireAuth()

  // Get current workstream to find project_id
  const { data: current } = await supabase
    .from("workstreams")
    .select("project_id")
    .eq("id", id)
    .single()

  if (!current) {
    return { error: "Workstream not found" }
  }

  // Run project membership check and project end_date fetch in parallel
  const [authResult, projectResult] = await Promise.all([
    requireProjectMember(current.project_id).catch(() => null),
    input.endDate
      ? supabase.from("projects").select("end_date").eq("id", current.project_id).single()
      : Promise.resolve({ data: null }),
  ])

  if (!authResult) {
    return { error: "You must be a project member to update workstreams" }
  }

  if (input.endDate) {
    const project = projectResult.data
    if (project?.end_date && new Date(input.endDate) > new Date(project.end_date)) {
      return {
        error: `Workstream end date cannot be after project end date (${project.end_date})`
      }
    }
  }

  // Validate start_date is before end_date
  if (input.startDate && input.endDate) {
    if (new Date(input.startDate) > new Date(input.endDate)) {
      return { error: "Start date cannot be after end date" }
    }
  }

  const updateData: WorkstreamUpdate = {}
  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description
  if (input.startDate !== undefined) updateData.start_date = input.startDate
  if (input.endDate !== undefined) updateData.end_date = input.endDate
  if (input.tag !== undefined) updateData.tag = input.tag

  const { data: workstream, error } = await supabase
    .from("workstreams")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Handle task assignments if taskIds is provided
  if (input.taskIds !== undefined) {
    // First, remove this workstream from all tasks that had it
    await supabase
      .from("tasks")
      .update({ workstream_id: null })
      .eq("workstream_id", id)
      .eq("project_id", current.project_id)

    // Then, assign this workstream to the selected tasks
    if (input.taskIds.length > 0) {
      await supabase
        .from("tasks")
        .update({ workstream_id: id })
        .in("id", input.taskIds)
        .eq("project_id", current.project_id)
    }
  }

  after(async () => {
    revalidatePath(`/projects/${current.project_id}`)
    // KV cache invalidation
    await invalidate.workstream(current.project_id)
  })

  return { data: workstream }
}

// Delete workstream
export async function deleteWorkstream(id: string): Promise<ActionResult> {
  // Authenticate first — no DB queries before auth
  const { supabase } = await requireAuth()

  // Get project_id for revalidation and auth check
  const { data: ws } = await supabase
    .from("workstreams")
    .select("project_id")
    .eq("id", id)
    .single()

  if (!ws) {
    return { error: "Workstream not found" }
  }

  // Require project membership
  try {
    await requireProjectMember(ws.project_id)
  } catch {
    return { error: "You must be a project member to delete workstreams" }
  }

  const { error } = await supabase.from("workstreams").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath(`/projects/${ws.project_id}`)
    // KV cache invalidation
    await invalidate.workstream(ws.project_id)
  })

  return {}
}

// Reorder workstreams
export async function reorderWorkstreams(
  projectId: string,
  workstreamIds: string[]
): Promise<ActionResult> {
  // Require project membership — use the returned authenticated client
  let supabase
  try {
    const ctx = await requireProjectMember(projectId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be a project member to reorder workstreams" }
  }

  // Update sort_order for each workstream
  const updates = workstreamIds.map((id, index) =>
    supabase
      .from("workstreams")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("project_id", projectId)
  )

  const results = await Promise.all(updates)
  const error = results.find((r) => r.error)?.error

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath(`/projects/${projectId}`)
    // KV cache invalidation
    await invalidate.workstream(projectId)
  })

  return {}
}
