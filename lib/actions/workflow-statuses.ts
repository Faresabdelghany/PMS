"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ActionResult } from "./types"
import { requireAuth, requireOrgMember } from "./auth-helpers"

// Types
export type WorkflowCategory = 'unstarted' | 'started' | 'finished' | 'canceled'
export type WorkflowEntityType = 'task' | 'project' | 'workstream'

export type WorkflowStatus = {
  id: string
  organization_id: string
  entity_type: WorkflowEntityType
  category: WorkflowCategory
  name: string
  description: string | null
  color: string
  is_default: boolean
  is_locked: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Validation schemas
const createWorkflowStatusSchema = z.object({
  entity_type: z.enum(['task', 'project', 'workstream']),
  category: z.enum(['unstarted', 'started', 'finished', 'canceled']),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const updateWorkflowStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// Get workflow statuses for organization
export async function getWorkflowStatuses(
  organizationId: string,
  entityType?: WorkflowEntityType
): Promise<ActionResult<WorkflowStatus[]>> {
  try {
    const { supabase } = await requireOrgMember(organizationId)

    let query = supabase
      .from("workflow_statuses")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order")

    if (entityType) {
      query = query.eq("entity_type", entityType)
    }

    const { data, error } = await query

    if (error) {
      return { error: error.message }
    }

    return { data: data as WorkflowStatus[] }
  } catch {
    return { error: "Not authorized" }
  }
}

// Create workflow status
export async function createWorkflowStatus(
  organizationId: string,
  data: z.infer<typeof createWorkflowStatusSchema>
): Promise<ActionResult<WorkflowStatus>> {
  try {
    const { supabase } = await requireOrgMember(organizationId)

    // Validate input
    const validation = createWorkflowStatusSchema.safeParse(data)
    if (!validation.success) {
      return { error: validation.error.errors[0]?.message || "Invalid input" }
    }

    const validData = validation.data

    // Get max sort_order for this entity type and category
    const { data: maxOrder } = await supabase
      .from("workflow_statuses")
      .select("sort_order")
      .eq("organization_id", organizationId)
      .eq("entity_type", validData.entity_type)
      .eq("category", validData.category)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single()

    const sortOrder = maxOrder ? maxOrder.sort_order + 1 : 0

    const { data: status, error } = await supabase
      .from("workflow_statuses")
      .insert({
        organization_id: organizationId,
        ...validData,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return { error: "A status with this name already exists" }
      }
      return { error: error.message }
    }

    revalidatePath("/settings")
    return { data: status as WorkflowStatus }
  } catch {
    return { error: "Not authorized" }
  }
}

// Update workflow status
export async function updateWorkflowStatus(
  id: string,
  data: z.infer<typeof updateWorkflowStatusSchema>
): Promise<ActionResult<WorkflowStatus>> {
  try {
    const { supabase } = await requireAuth()

    // Validate input
    const validation = updateWorkflowStatusSchema.safeParse(data)
    if (!validation.success) {
      return { error: validation.error.errors[0]?.message || "Invalid input" }
    }

    // Check if status is locked
    const { data: existing } = await supabase
      .from("workflow_statuses")
      .select("is_locked")
      .eq("id", id)
      .single()

    if (existing?.is_locked) {
      return { error: "Cannot modify a locked status" }
    }

    const { data: status, error } = await supabase
      .from("workflow_statuses")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/settings")
    return { data: status as WorkflowStatus }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Delete workflow status
export async function deleteWorkflowStatus(id: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { supabase } = await requireAuth()

    // Check if status is locked or default
    const { data: existing } = await supabase
      .from("workflow_statuses")
      .select("is_locked, is_default")
      .eq("id", id)
      .single()

    if (existing?.is_locked) {
      return { error: "Cannot delete a locked status" }
    }

    if (existing?.is_default) {
      return { error: "Cannot delete a default status" }
    }

    const { error } = await supabase
      .from("workflow_statuses")
      .delete()
      .eq("id", id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/settings")
    return { data: { success: true } }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Reorder workflow statuses
export async function reorderWorkflowStatuses(
  statusIds: string[]
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { supabase } = await requireAuth()

    // Update sort_order for each status
    const updates = statusIds.map((id, index) =>
      supabase
        .from("workflow_statuses")
        .update({ sort_order: index })
        .eq("id", id)
    )

    const results = await Promise.all(updates)
    const error = results.find((r) => r.error)?.error

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/settings")
    return { data: { success: true } }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Initialize default statuses for an organization
export async function initializeWorkflowStatuses(
  organizationId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { supabase } = await requireOrgMember(organizationId)

    const { error } = await supabase.rpc("create_default_workflow_statuses", {
      org_id: organizationId,
    })

    if (error) {
      return { error: error.message }
    }

    return { data: { success: true } }
  } catch {
    return { error: "Not authorized" }
  }
}
