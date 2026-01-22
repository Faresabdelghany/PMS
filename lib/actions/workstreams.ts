"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Workstream, WorkstreamInsert, WorkstreamUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

export type { ActionResult }

// Create workstream
export async function createWorkstream(
  projectId: string,
  name: string
): Promise<ActionResult<Workstream>> {
  const supabase = await createClient()

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
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
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
      tasks(id, name, status, priority, assignee_id, sort_order)
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

// Update workstream
export async function updateWorkstream(
  id: string,
  data: WorkstreamUpdate
): Promise<ActionResult<Workstream>> {
  const supabase = await createClient()

  const { data: workstream, error } = await supabase
    .from("workstreams")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/projects")
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
