"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import type { OrganizationLabel, OrganizationLabelUpdate, LabelCategory } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Get all labels for an organization, optionally filtered by category (with KV caching)
export async function getLabels(
  orgId: string,
  category?: LabelCategory
): Promise<ActionResult<OrganizationLabel[]>> {
  const supabase = await createClient()

  try {
    // Cache all labels for the org, then filter by category client-side
    const allLabels = await cacheGet(
      CacheKeys.labels(orgId),
      async () => {
        const { data, error } = await supabase
          .from("organization_labels")
          .select("*")
          .eq("organization_id", orgId)
          .order("name")

        if (error) throw error
        return data ?? []
      },
      CacheTTL.LABELS
    )

    const data = category
      ? allLabels.filter((l) => l.category === category)
      : allLabels

    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to fetch labels" }
  }
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
  invalidate.labels(orgId)
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
  if (data) invalidate.labels(data.organization_id)
  return { data }
}

// Delete a label
export async function deleteLabel(labelId: string, orgId?: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_labels")
    .delete()
    .eq("id", labelId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  if (orgId) invalidate.labels(orgId)
  return {}
}
