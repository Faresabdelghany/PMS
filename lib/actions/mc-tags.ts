"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

// Mission Control specific tags (distinct from organization_tags)
export type MCTag = {
  id: string
  org_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export type MCTagInsert = Omit<MCTag, "id" | "created_at" | "updated_at">
export type MCTagUpdate = Partial<Omit<MCTag, "id" | "org_id" | "created_at" | "updated_at">>

// ── CRUD: Mission Control Tags ──────────────────────────────────────

export async function getMCTags(orgId: string): Promise<ActionResult<MCTag[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("mc_tags" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("name")

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as unknown as MCTag[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function createMCTag(
  orgId: string,
  input: { name: string; color?: string }
): Promise<ActionResult<MCTag>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const name = input.name?.trim()
    if (!name || name.length < 1 || name.length > 50) {
      return { error: "Tag name must be between 1 and 50 characters" }
    }

    const color = input.color ?? "#6366f1"
    if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Invalid color format (use hex e.g. #6366f1)" }
    }

    const { data, error } = await supabase
      .from("mc_tags" as any)
      .insert({ org_id: orgId, name, color })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") return { error: "A tag with this name already exists" }
      return { error: error.message }
    }

    after(() => revalidatePath("/tags"))

    return { data: data as unknown as MCTag }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateMCTag(
  id: string,
  input: MCTagUpdate
): Promise<ActionResult<MCTag>> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("mc_tags" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Tag not found" }

    await requireOrgMember((existing as any).org_id)

    if (input.name !== undefined) {
      const name = input.name.trim()
      if (name.length < 1 || name.length > 50) {
        return { error: "Tag name must be between 1 and 50 characters" }
      }
      input.name = name
    }

    if (input.color !== undefined && !input.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Invalid color format" }
    }

    const { data, error } = await supabase
      .from("mc_tags" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "23505") return { error: "A tag with this name already exists" }
      return { error: error.message }
    }

    after(() => revalidatePath("/tags"))

    return { data: data as unknown as MCTag }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function deleteMCTag(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("mc_tags" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Tag not found" }

    await requireOrgMember((existing as any).org_id)

    const { error } = await supabase
      .from("mc_tags" as any)
      .delete()
      .eq("id", id)

    if (error) return { error: error.message }

    after(() => revalidatePath("/tags"))

    return {}
  } catch {
    return { error: "Not authenticated" }
  }
}
