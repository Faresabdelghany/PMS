"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { invalidateCache } from "@/lib/cache"
import { requireAuth } from "../auth-helpers"
import type { ActionResult } from "../types"

// Reorder tasks within a workstream
export async function reorderTasks(
  workstreamId: string | null,
  projectId: string,
  taskIds: string[]
): Promise<ActionResult> {
  const { supabase } = await requireAuth()

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
    await invalidateCache.task({
      projectId,
      orgId: project?.organization_id ?? "",
    })
  })

  return {}
}

// Move task to different workstream
export async function moveTaskToWorkstream(
  taskId: string,
  newWorkstreamId: string | null,
  newIndex: number
): Promise<ActionResult> {
  const { supabase } = await requireAuth()

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
    await invalidateCache.task({
      taskId,
      projectId: task.project_id,
      assigneeId: task.assignee_id,
      orgId,
    })
  })

  return {}
}
