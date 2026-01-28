"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { OrganizationTag, OrganizationTagUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Color palette for tags/labels
export const TAG_COLORS = [
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Gray", hex: "#6b7280" },
] as const

// Get all tags for an organization
export async function getTags(orgId: string): Promise<ActionResult<OrganizationTag[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("organization_tags")
    .select("*")
    .eq("organization_id", orgId)
    .order("name")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Create a new tag
export async function createTag(
  orgId: string,
  input: { name: string; description?: string; color: string }
): Promise<ActionResult<OrganizationTag>> {
  const supabase = await createClient()

  const name = input.name?.trim()
  const description = input.description?.trim() || null
  const color = input.color

  if (!name || name.length < 1 || name.length > 50) {
    return { error: "Tag name must be between 1 and 50 characters" }
  }

  if (description && description.length > 200) {
    return { error: "Description must be less than 200 characters" }
  }

  if (!color || !color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: "Invalid color format" }
  }

  const { data, error } = await supabase
    .from("organization_tags")
    .insert({
      organization_id: orgId,
      name,
      description,
      color,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A tag with this name already exists" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Update a tag
export async function updateTag(
  tagId: string,
  input: { name?: string; description?: string; color?: string }
): Promise<ActionResult<OrganizationTag>> {
  const supabase = await createClient()

  const updates: OrganizationTagUpdate = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 1 || name.length > 50) {
      return { error: "Tag name must be between 1 and 50 characters" }
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
    .from("organization_tags")
    .update(updates)
    .eq("id", tagId)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A tag with this name already exists" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Delete a tag
export async function deleteTag(tagId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_tags")
    .delete()
    .eq("id", tagId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return {}
}
