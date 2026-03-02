"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import { z } from "zod"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface AgentLog {
  id: string
  organization_id: string
  agent_id: string
  session_id: string | null
  level: LogLevel
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AgentLogWithAgent extends AgentLog {
  agent?: { id: string; name: string; avatar_url: string | null } | null
}

// ── Actions ──────────────────────────────────────────────────────────

/**
 * Get paginated agent logs with optional filters and agent join.
 * Supports filtering by agentId, level, and search (ilike on message).
 */
export async function getAgentLogs(
  orgId: string,
  filters?: {
    agentId?: string
    level?: LogLevel
    search?: string
    limit?: number
    offset?: number
  }
): Promise<ActionResult<AgentLogWithAgent[]>> {
  const { supabase } = await requireAuth()

  let query = supabase
    .from("agent_logs" as any)
    .select(`
      *,
      agent:agents(id, name, avatar_url)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (filters?.agentId) {
    query = query.eq("agent_id", filters.agentId)
  }
  if (filters?.level) {
    query = query.eq("level", filters.level)
  }
  if (filters?.search) {
    const sanitized = filters.search.replace(/[%_]/g, "")
    query = query.ilike("message", `%${sanitized}%`)
  }

  const limit = filters?.limit ?? 100
  const offset = filters?.offset ?? 0

  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    // Table might not exist yet — return empty instead of crashing
    if (error.code === "42P01") return { data: [] }
    return { error: error.message }
  }

  const logs = ((data ?? []) as any[]).map((row) => ({
    ...row,
    agent: Array.isArray(row.agent) ? row.agent[0] ?? null : row.agent,
  })) as AgentLogWithAgent[]

  return { data: logs }
}

/**
 * Get log counts grouped by level for the last 24 hours.
 */
export async function getAgentLogStats(
  orgId: string
): Promise<
  ActionResult<{
    debug: number
    info: number
    warn: number
    error: number
    total: number
  }>
> {
  const { supabase } = await requireAuth()

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from("agent_logs" as any)
    .select("level")
    .eq("organization_id", orgId)
    .gte("created_at", twentyFourHoursAgo.toISOString())

  if (error) {
    // Table might not exist yet
    if (error.code === "42P01") {
      return { data: { debug: 0, info: 0, warn: 0, error: 0, total: 0 } }
    }
    return { error: error.message }
  }

  const rows = (data ?? []) as unknown as { level: LogLevel }[]

  const counts = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    total: rows.length,
  }

  for (const row of rows) {
    if (row.level in counts) {
      counts[row.level]++
    }
  }

  return { data: counts }
}
