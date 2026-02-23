"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type BoardWebhook = {
  id: string
  board_id: string
  org_id: string
  url: string
  events: string[]
  secret: string | null
  enabled: boolean
  last_triggered_at: string | null
  created_at: string
  updated_at: string
}

export type BoardWebhookInsert = Omit<BoardWebhook, "id" | "created_at" | "updated_at" | "last_triggered_at">
export type BoardWebhookUpdate = Partial<Omit<BoardWebhook, "id" | "board_id" | "org_id" | "created_at" | "updated_at">>

export async function getBoardWebhooks(boardId: string): Promise<ActionResult<BoardWebhook[]>> {
  try {
    const { supabase } = await requireAuth()
    const { data, error } = await supabase
      .from("board_webhooks" as any)
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as BoardWebhook[] }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function createBoardWebhook(
  input: {
    board_id: string
    org_id: string
    url: string
    events: string[]
    secret?: string
    enabled?: boolean
  }
): Promise<ActionResult<BoardWebhook>> {
  try {
    const { supabase } = await requireOrgMember(input.org_id)
    if (!input.url?.trim()) return { error: "URL is required" }
    if (!input.events?.length) return { error: "At least one event is required" }
    const { data, error } = await supabase
      .from("board_webhooks" as any)
      .insert({
        board_id: input.board_id,
        org_id: input.org_id,
        url: input.url.trim(),
        events: input.events,
        secret: input.secret?.trim() || null,
        enabled: input.enabled ?? true,
      })
      .select()
      .single()
    if (error) return { error: error.message }
    after(() => revalidatePath(`/boards/${input.board_id}/webhooks`))
    return { data: data as unknown as BoardWebhook }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateBoardWebhook(
  id: string,
  input: BoardWebhookUpdate
): Promise<ActionResult<BoardWebhook>> {
  try {
    const { supabase } = await requireAuth()
    const { data: existing, error: fetchErr } = await supabase
      .from("board_webhooks" as any)
      .select("org_id, board_id")
      .eq("id", id)
      .single()
    if (fetchErr || !existing) return { error: "Webhook not found" }
    await requireOrgMember((existing as any).org_id)
    const { data, error } = await supabase
      .from("board_webhooks" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()
    if (error) return { error: error.message }
    after(() => revalidatePath(`/boards/${(existing as any).board_id}/webhooks`))
    return { data: data as unknown as BoardWebhook }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function deleteBoardWebhook(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()
    const { data: existing, error: fetchErr } = await supabase
      .from("board_webhooks" as any)
      .select("org_id, board_id")
      .eq("id", id)
      .single()
    if (fetchErr || !existing) return { error: "Webhook not found" }
    await requireOrgMember((existing as any).org_id)
    const { error } = await supabase
      .from("board_webhooks" as any)
      .delete()
      .eq("id", id)
    if (error) return { error: error.message }
    after(() => revalidatePath(`/boards/${(existing as any).board_id}/webhooks`))
    return {}
  } catch {
    return { error: "Not authorized" }
  }
}

export async function testWebhook(id: string): Promise<ActionResult<{ status: number; ok: boolean }>> {
  try {
    const { supabase } = await requireAuth()
    const { data: webhook, error: fetchErr } = await supabase
      .from("board_webhooks" as any)
      .select("*")
      .eq("id", id)
      .single()
    if (fetchErr || !webhook) return { error: "Webhook not found" }
    await requireOrgMember((webhook as any).org_id)
    // Send test POST request
    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook delivery from PMS Mission Control" },
    }
    let status = 0
    let ok = false
    try {
      const res = await fetch((webhook as any).url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PMS-Event": "test",
          "X-PMS-Webhook-ID": id,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      })
      status = res.status
      ok = res.ok
    } catch {
      return { error: "Failed to reach webhook URL" }
    }
    // Update last_triggered_at
    await supabase
      .from("board_webhooks" as any)
      .update({ last_triggered_at: new Date().toISOString() })
      .eq("id", id)
    after(() => revalidatePath(`/boards/${(webhook as any).board_id}/webhooks`))
    return { data: { status, ok } }
  } catch {
    return { error: "Not authorized" }
  }
}
