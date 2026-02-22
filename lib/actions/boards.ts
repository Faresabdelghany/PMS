"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type Board = {
  id: string
  org_id: string
  name: string
  description: string | null
  gateway_id: string | null
  agent_id: string | null
  status: "active" | "archived" | "paused"
  created_at: string
  updated_at: string
}

export type BoardInsert = Omit<Board, "id" | "created_at" | "updated_at">
export type BoardUpdate = Partial<Omit<Board, "id" | "org_id" | "created_at" | "updated_at">>

// ── CRUD: Boards ────────────────────────────────────────────────────

export async function getBoards(orgId: string): Promise<ActionResult<Board[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("boards" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("name")

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as Board[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getBoard(id: string): Promise<ActionResult<Board>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("boards" as any)
      .select("*")
      .eq("id", id)
      .single()

    if (error) return { error: error.message }
    return { data: data as unknown as Board }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function createBoard(
  orgId: string,
  input: {
    name: string
    description?: string
    gateway_id?: string
    agent_id?: string
    status?: "active" | "archived" | "paused"
  }
): Promise<ActionResult<Board>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const name = input.name?.trim()
    if (!name) return { error: "Name is required" }

    const { data, error } = await supabase
      .from("boards" as any)
      .insert({
        org_id: orgId,
        name,
        description: input.description?.trim() || null,
        gateway_id: input.gateway_id ?? null,
        agent_id: input.agent_id ?? null,
        status: input.status ?? "active",
      })
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/boards"))

    return { data: data as unknown as Board }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateBoard(
  id: string,
  input: BoardUpdate
): Promise<ActionResult<Board>> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("boards" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Board not found" }

    await requireOrgMember((existing as any).org_id)

    const { data, error } = await supabase
      .from("boards" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/boards"))

    return { data: data as unknown as Board }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function deleteBoard(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("boards" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Board not found" }

    await requireOrgMember((existing as any).org_id, true)

    const { error } = await supabase
      .from("boards" as any)
      .delete()
      .eq("id", id)

    if (error) return { error: error.message }

    after(() => revalidatePath("/boards"))

    return {}
  } catch {
    return { error: "Not authorized" }
  }
}
