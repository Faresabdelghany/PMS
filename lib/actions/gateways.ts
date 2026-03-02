"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"
import type { GatewayConnectionInfo } from "@/lib/types/gateway"

export type Gateway = {
  id: string
  org_id: string
  name: string
  url: string
  status: "online" | "offline" | "unknown"
  last_seen_at: string | null
  workspace_root: string | null
  auth_mode: "none" | "token" | "basic"
  auth_token: string | null
  created_at: string
  updated_at: string
}

export type GatewayInsert = Omit<Gateway, "id" | "created_at" | "updated_at">
export type GatewayUpdate = Partial<Omit<Gateway, "id" | "org_id" | "created_at" | "updated_at">>

export type GatewayHealthResult = {
  status: "online" | "offline"
  latencyMs?: number
}

// ── Health Check ────────────────────────────────────────────────────

export async function checkGatewayHealth(url: string): Promise<GatewayHealthResult> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)

    const latencyMs = Date.now() - start
    return { status: res.ok ? "online" : "offline", latencyMs }
  } catch {
    return { status: "offline" }
  }
}

// ── CRUD: Gateways ──────────────────────────────────────────────────

export async function getGateways(orgId: string): Promise<ActionResult<Gateway[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("gateways" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("name")

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as Gateway[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getGateway(id: string): Promise<ActionResult<Gateway>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("gateways" as any)
      .select("*")
      .eq("id", id)
      .single()

    if (error) return { error: error.message }
    return { data: data as unknown as Gateway }
  } catch {
    return { error: "Not authenticated" }
  }
}

function normalizeGatewayWebSocketUrl(url: string): string {
  const trimmed = url.trim()

  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`
  }
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed
  }

  return `ws://${trimmed}`
}

export async function getGatewayConnectionInfo(
  orgId: string
): Promise<ActionResult<GatewayConnectionInfo | null>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("gateways" as any)
      .select("id, url, auth_token, auth_mode")
      .eq("org_id", orgId)
      .neq("status", "offline")
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1)

    if (error) return { error: error.message }

    const gatewayRows = (data ?? []) as unknown as Array<{
      id: string
      url: string
      auth_token: string | null
      auth_mode: 'none' | 'token' | 'password' | 'basic'
    }>
    const gateway = gatewayRows[0]

    if (!gateway) return { data: null }

    return {
      data: {
        url: normalizeGatewayWebSocketUrl(gateway.url),
        token: gateway.auth_token ?? "",
        authMode: gateway.auth_mode ?? "none",
        gatewayId: gateway.id,
      },
    }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function createGateway(
  orgId: string,
  input: {
    name: string
    url?: string
    workspace_root?: string
    auth_mode?: "none" | "token" | "basic"
    auth_token?: string
  }
): Promise<ActionResult<Gateway>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const name = input.name?.trim()
    if (!name) return { error: "Name is required" }

    const url = input.url?.trim() || "http://localhost:18789"

    const { data, error } = await supabase
      .from("gateways" as any)
      .insert({
        org_id: orgId,
        name,
        url,
        workspace_root: input.workspace_root?.trim() || null,
        auth_mode: input.auth_mode ?? "none",
        auth_token: input.auth_token?.trim() || null,
        status: "unknown",
      })
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/gateways"))

    return { data: data as unknown as Gateway }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateGateway(
  id: string,
  input: GatewayUpdate
): Promise<ActionResult<Gateway>> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("gateways" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Gateway not found" }

    await requireOrgMember((existing as any).org_id)

    const { data, error } = await supabase
      .from("gateways" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/gateways"))

    return { data: data as unknown as Gateway }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function deleteGateway(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { data: existing, error: fetchErr } = await supabase
      .from("gateways" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Gateway not found" }

    await requireOrgMember((existing as any).org_id, true)

    const { error } = await supabase
      .from("gateways" as any)
      .delete()
      .eq("id", id)

    if (error) return { error: error.message }

    after(() => revalidatePath("/gateways"))

    return {}
  } catch {
    return { error: "Not authorized" }
  }
}
