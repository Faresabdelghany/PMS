"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireProjectMember } from "./auth-helpers"
import type { ProjectDeliverable, DeliverableStatus, PaymentStatus } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

export type CreateDeliverableInput = {
  projectId: string
  title: string
  value?: number | null
  dueDate?: string | null
  status?: DeliverableStatus
  paymentStatus?: PaymentStatus
}

export type UpdateDeliverableInput = {
  id: string
  title?: string
  value?: number | null
  dueDate?: string | null
  status?: DeliverableStatus
  paymentStatus?: PaymentStatus
}

// Get all deliverables for a project
export async function getDeliverables(
  projectId: string
): Promise<ActionResult<ProjectDeliverable[]>> {
  try {
    await requireProjectMember(projectId)
  } catch {
    return { error: "You must be a project member to view deliverables" }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_deliverables")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data: data ?? [] }
}

// Create a new deliverable
export async function createDeliverable(
  input: CreateDeliverableInput
): Promise<ActionResult<ProjectDeliverable>> {
  const { projectId, title, value, dueDate, status, paymentStatus } = input

  try {
    await requireProjectMember(projectId)
  } catch {
    return { error: "You must be a project member to create deliverables" }
  }

  const supabase = await createClient()

  // Get max sort_order
  const { data: existingDeliverables } = await supabase
    .from("project_deliverables")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single()

  const sortOrder = existingDeliverables ? existingDeliverables.sort_order + 1 : 0

  const { data, error } = await supabase
    .from("project_deliverables")
    .insert({
      project_id: projectId,
      title,
      value: value ?? null,
      due_date: dueDate ?? null,
      status: status ?? "pending",
      payment_status: paymentStatus ?? "unpaid",
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(() => revalidatePath(`/projects/${projectId}`))
  return { data }
}

// Update a deliverable
export async function updateDeliverable(
  input: UpdateDeliverableInput
): Promise<ActionResult<ProjectDeliverable>> {
  const { id, title, value, dueDate, status, paymentStatus } = input

  const supabase = await createClient()

  // First get the deliverable to check project membership
  const { data: deliverable, error: fetchError } = await supabase
    .from("project_deliverables")
    .select("project_id")
    .eq("id", id)
    .single()

  if (fetchError || !deliverable) {
    return { error: "Deliverable not found" }
  }

  try {
    await requireProjectMember(deliverable.project_id)
  } catch {
    return { error: "You must be a project member to update deliverables" }
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (value !== undefined) updateData.value = value
  if (dueDate !== undefined) updateData.due_date = dueDate
  if (status !== undefined) updateData.status = status
  if (paymentStatus !== undefined) updateData.payment_status = paymentStatus

  const { data, error } = await supabase
    .from("project_deliverables")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(() => revalidatePath(`/projects/${deliverable.project_id}`))
  return { data }
}

// Delete a deliverable
export async function deleteDeliverable(
  id: string
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  // First get the deliverable to check project membership
  const { data: deliverable, error: fetchError } = await supabase
    .from("project_deliverables")
    .select("project_id")
    .eq("id", id)
    .single()

  if (fetchError || !deliverable) {
    return { error: "Deliverable not found" }
  }

  try {
    await requireProjectMember(deliverable.project_id)
  } catch {
    return { error: "You must be a project member to delete deliverables" }
  }

  const { error } = await supabase
    .from("project_deliverables")
    .delete()
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  after(() => revalidatePath(`/projects/${deliverable.project_id}`))
  return { data: { success: true } }
}

// Reorder deliverables
export async function reorderDeliverables(
  projectId: string,
  deliverableIds: string[]
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await requireProjectMember(projectId)
  } catch {
    return { error: "You must be a project member to reorder deliverables" }
  }

  const supabase = await createClient()

  // Update sort_order for each deliverable
  const updates = deliverableIds.map((id, index) =>
    supabase
      .from("project_deliverables")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("project_id", projectId)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)

  if (errors.length > 0) {
    return { error: "Failed to reorder some deliverables" }
  }

  after(() => revalidatePath(`/projects/${projectId}`))
  return { data: { success: true } }
}
