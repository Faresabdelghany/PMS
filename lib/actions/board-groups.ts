"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type BoardGroup = {
  id: string
  org_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type BoardGroupInsert = Omit<BoardGroup, "id" | "created_at" | "updated_at">
export type BoardGroupUpdate = Partial<Omit<BoardGroup, "id" | "org_id" | "created_at" | "updated_at">>

export async function getBoardGroups(orgId: string): Promise<ActionResult<BoardGroup[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)
    const { data, error } = await supabase
      .from("board_groups" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order")
    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as BoardGroup[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getBoardGroup(id: string): Promise<ActionResult<BoardGroup>> {
  try {
    const { supabase } = await requireAuth()
    const { data, error } = await supabase
      .from("board_groups" as any)
      .select("*")
      .eq("id", id)
      .single()
    if (error) return { error: error.message }
    return { data: data as unknown as BoardGroup }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function createBoardGroup(
  orgId: string,
  input: { name: string; description?: string; sort_order?: number }
): Promise<ActionResult<BoardGroup>> {
  try {
    const { supabase } = await requireOrgMember(orgId)
    const name = input.name?.trim()
    if (!name) return { error: "Name is required" }
    const { data, error } = await supabase
      .from("board_groups" as any)
      .insert({
        org_id: orgId,
        name,
        description: input.description?.trim() || null,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single()
    if (error) return { error: error.message }
    after(() => revalidatePath("/board-groups"))
    return { data: data as unknown as BoardGroup }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateBoardGroup(
  id: string,
  input: BoardGroupUpdate
): Promise<ActionResult<BoardGroup>> {
  try {
    const { supabase } = await requireAuth()
    const { data: existing, error: fetchErr } = await supabase
      .from("board_groups" as any)
      .select("org_id")
      .eq("id", id)
      .single()
    if (fetchErr || !existing) return { error: "Board group not found" }
    await requireOrgMember((existing as any).org_id)
    const { data, error } = await supabase
      .from("board_groups" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()
    if (error) return { error: error.message }
    after(() => revalidatePath("/board-groups"))
    return { data: data as unknown as BoardGroup }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function deleteBoardGroup(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()
    const { data: existing, error: fetchErr } = await supabase
      .from("board_groups" as any)
      .select("org_id")
      .eq("id", id)
      .single()
    if (fetchErr || !existing) return { error: "Board group not found" }
    await requireOrgMember((existing as any).org_id)
    const { error } = await supabase
      .from("board_groups" as any)
      .delete()
      .eq("id", id)
    if (error) return { error: error.message }
    after(() => revalidatePath("/board-groups"))
    return {}
  } catch {
    return { error: "Not authorized" }
  }
}
