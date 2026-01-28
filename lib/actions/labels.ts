"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { OrganizationLabel, OrganizationLabelUpdate, LabelCategory } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Get all labels for an organization, optionally filtered by category
export async function getLabels(
  orgId: string,
  category?: LabelCategory
): Promise<ActionResult<OrganizationLabel[]>> {
  const supabase = await createClient()

  let query = supabase
    .from("organization_labels")
    .select("*")
    .eq("organization_id", orgId)

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query.order("name")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Create a new label
export async function createLabel(
  orgId: string,
  input: { category: LabelCategory; name: string; description?: string; color: string }
): Promise<ActionResult<OrganizationLabel>> {
  const supabase = await createClient()

  const name = input.name?.trim()
  const description = input.description?.trim() || null
  const color = input.color
  const category = input.category

  if (!["type", "duration", "group", "badge"].includes(category)) {
    return { error: "Invalid label category" }
  }

  if (!name || name.length < 1 || name.length > 50) {
    return { error: "Label name must be between 1 and 50 characters" }
  }

  if (description && description.length > 200) {
    return { error: "Description must be less than 200 characters" }
  }

  if (!color || !color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: "Invalid color format" }
  }

  const { data, error } = await supabase
    .from("organization_labels")
    .insert({
      organization_id: orgId,
      category,
      name,
      description,
      color,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A label with this name already exists in this category" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Update a label
export async function updateLabel(
  labelId: string,
  input: { name?: string; description?: string; color?: string }
): Promise<ActionResult<OrganizationLabel>> {
  const supabase = await createClient()

  const updates: OrganizationLabelUpdate = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 1 || name.length > 50) {
      return { error: "Label name must be between 1 and 50 characters" }
    }
    updates.name = name
  }

  if (input.description !== undefined) {
    const description = input.description.trim()
    if (description.length > 200) {
      return { error: "Description must be less than 200 characters" }
    }
    updates.description = description || null
  }

  if (input.color !== undefined) {
    if (!input.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Invalid color format" }
    }
    updates.color = input.color
  }

  const { data, error } = await supabase
    .from("organization_labels")
    .update(updates)
    .eq("id", labelId)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A label with this name already exists in this category" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Delete a label
export async function deleteLabel(labelId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_labels")
    .delete()
    .eq("id", labelId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return {}
}
