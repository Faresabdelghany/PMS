"use server"

import { revalidatePath } from "next/cache"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import type { OrganizationTag, OrganizationTagUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth, requireOrgMember } from "./auth-helpers"

// Get all tags for an organization (with KV caching)
export async function getTags(orgId: string): Promise<ActionResult<OrganizationTag[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const data = await cacheGet(
      CacheKeys.tags(orgId),
      async () => {
        const { data, error } = await supabase
          .from("organization_tags")
          .select("*")
          .eq("organization_id", orgId)
          .order("name")

        if (error) throw error
        return data ?? []
      },
      CacheTTL.TAGS
    )
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to fetch tags" }
  }
}

// Create a new tag
export async function createTag(
  orgId: string,
  input: { name: string; description?: string; color: string }
): Promise<ActionResult<OrganizationTag>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

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
    invalidate.tags(orgId)
    return { data }
  } catch {
    return { error: "Not authorized" }
  }
}

// Update a tag
export async function updateTag(
  tagId: string,
  input: { name?: string; description?: string; color?: string }
): Promise<ActionResult<OrganizationTag>> {
  try {
    const { supabase } = await requireAuth()

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
    if (data) invalidate.tags(data.organization_id)
    return { data }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Delete a tag
export async function deleteTag(tagId: string, orgId?: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { error } = await supabase
      .from("organization_tags")
      .delete()
      .eq("id", tagId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/settings")
    if (orgId) invalidate.tags(orgId)
    return {}
  } catch {
    return { error: "Not authenticated" }
  }
}
