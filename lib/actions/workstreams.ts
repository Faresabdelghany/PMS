"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
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
  const supabase = await createClient()

  // Get project to validate end_date
  const { data: project } = await supabase
    .from("projects")
    .select("end_date")
    .eq("id", projectId)
    .single()

  // Validate workstream end_date against project end_date
  if (endDate && project?.end_date) {
    if (new Date(endDate) > new Date(project.end_date)) {
      return {
        error: `Workstream end date cannot be after project end date (${project.end_date})`
      }
    }
  }

  // Validate start_date is before end_date
  if (startDate && endDate) {
    if (new Date(startDate) > new Date(endDate)) {
      return { error: "Start date cannot be after end date" }
    }
  }

  // Get max sort_order
  const { data: existing } = await supabase
    .from("workstreams")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single()

  const sortOrder = existing ? existing.sort_order + 1 : 0

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
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ workstream_id: data.id })
      .in("id", taskIds)
      .eq("project_id", projectId) // Safety: only update tasks in same project

    if (taskError) {
      console.error("Failed to assign tasks to workstream:", taskError)
      // Don't fail the whole operation, workstream was created
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return { data }
}

// Get workstreams for project
export async function getWorkstreams(
  projectId: string
): Promise<ActionResult<Workstream[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("workstreams")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data }
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
  const supabase = await createClient()

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
}

// Update workstream
export async function updateWorkstream(
  id: string,
  input: UpdateWorkstreamInput
): Promise<ActionResult<Workstream>> {
  const supabase = await createClient()

  // Get current workstream to find project_id
  const { data: current } = await supabase
    .from("workstreams")
    .select("project_id")
    .eq("id", id)
    .single()

  if (!current) {
    return { error: "Workstream not found" }
  }

  // Get project to validate end_date
  if (input.endDate) {
    const { data: project } = await supabase
      .from("projects")
      .select("end_date")
      .eq("id", current.project_id)
      .single()

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

  revalidatePath(`/projects/${current.project_id}`)
  return { data: workstream }
}

// Delete workstream
export async function deleteWorkstream(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Get project_id for revalidation
  const { data: ws } = await supabase
    .from("workstreams")
    .select("project_id")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("workstreams").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  if (ws) {
    revalidatePath(`/projects/${ws.project_id}`)
  }
  return {}
}

// Reorder workstreams
export async function reorderWorkstreams(
  projectId: string,
  workstreamIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

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

  revalidatePath(`/projects/${projectId}`)
  return {}
}
