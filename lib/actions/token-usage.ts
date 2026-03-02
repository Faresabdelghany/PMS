"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import { z } from "zod"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export interface TokenUsageLog {
  id: string
  organization_id: string
  agent_id: string | null
  session_id: string | null
  task_id: string | null
  model: string
  provider: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface TokenUsageSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  entryCount: number
}

export interface TokenUsageByAgent {
  agent_id: string
  agent_name: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
}

export interface TokenUsageByModel {
  model: string
  provider: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
}

export interface TokenUsageTrendEntry {
  date: string
  cost: number
  tokens: number
}

export interface TokenUsageLogWithAgent extends TokenUsageLog {
  agent?: { id: string; name: string; avatar_url: string | null } | null
}

// ── Helpers ──────────────────────────────────────────────────────────

type TimeRange = "1d" | "7d" | "30d"

function getRangeStart(range: TimeRange): Date {
  const now = new Date()
  switch (range) {
    case "1d":
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

// ── Actions ──────────────────────────────────────────────────────────

/**
 * Get aggregate token usage summary for a given time range.
 */
export async function getTokenUsageSummary(
  orgId: string,
  range: TimeRange
): Promise<ActionResult<TokenUsageSummary>> {
  const { supabase } = await requireAuth()

  const rangeStart = getRangeStart(range)

  const { data, error } = await supabase
    .from("token_usage_logs" as any)
    .select("input_tokens, output_tokens, cost_usd")
    .eq("organization_id", orgId)
    .gte("created_at", rangeStart.toISOString())

  if (error) {
    if (error.code === "42P01") {
      return {
        data: { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, entryCount: 0 },
      }
    }
    return { error: error.message }
  }

  const rows = (data ?? []) as unknown as {
    input_tokens: number
    output_tokens: number
    cost_usd: number
  }[]

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0

  for (const row of rows) {
    totalInputTokens += row.input_tokens ?? 0
    totalOutputTokens += row.output_tokens ?? 0
    totalCostUsd += row.cost_usd ?? 0
  }

  return {
    data: {
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      entryCount: rows.length,
    },
  }
}

/**
 * Get token usage grouped by agent for a given time range.
 */
export async function getTokenUsageByAgent(
  orgId: string,
  range: TimeRange
): Promise<ActionResult<TokenUsageByAgent[]>> {
  const { supabase } = await requireAuth()

  const rangeStart = getRangeStart(range)

  const { data, error } = await supabase
    .from("token_usage_logs" as any)
    .select(`
      agent_id, input_tokens, output_tokens, cost_usd,
      agent:agents(id, name)
    `)
    .eq("organization_id", orgId)
    .gte("created_at", rangeStart.toISOString())

  if (error) {
    if (error.code === "42P01") return { data: [] }
    return { error: error.message }
  }

  const rows = ((data ?? []) as any[]).map((row) => ({
    ...row,
    agent: Array.isArray(row.agent) ? row.agent[0] ?? null : row.agent,
  })) as Array<{
    agent_id: string | null
    input_tokens: number
    output_tokens: number
    cost_usd: number
    agent: { id: string; name: string } | null
  }>

  // Group by agent_id
  const agentMap = new Map<
    string,
    { agent_name: string; total_input_tokens: number; total_output_tokens: number; total_cost_usd: number }
  >()

  for (const row of rows) {
    const agentId = row.agent_id ?? "unknown"
    const existing = agentMap.get(agentId)

    if (existing) {
      existing.total_input_tokens += row.input_tokens ?? 0
      existing.total_output_tokens += row.output_tokens ?? 0
      existing.total_cost_usd += row.cost_usd ?? 0
    } else {
      agentMap.set(agentId, {
        agent_name: row.agent?.name ?? "Unknown",
        total_input_tokens: row.input_tokens ?? 0,
        total_output_tokens: row.output_tokens ?? 0,
        total_cost_usd: row.cost_usd ?? 0,
      })
    }
  }

  const result: TokenUsageByAgent[] = Array.from(agentMap.entries()).map(
    ([agent_id, info]) => ({
      agent_id,
      agent_name: info.agent_name,
      total_input_tokens: info.total_input_tokens,
      total_output_tokens: info.total_output_tokens,
      total_cost_usd: info.total_cost_usd,
    })
  )

  // Sort by cost descending
  result.sort((a, b) => b.total_cost_usd - a.total_cost_usd)

  return { data: result }
}

/**
 * Get token usage grouped by model for a given time range.
 */
export async function getTokenUsageByModel(
  orgId: string,
  range: TimeRange
): Promise<ActionResult<TokenUsageByModel[]>> {
  const { supabase } = await requireAuth()

  const rangeStart = getRangeStart(range)

  const { data, error } = await supabase
    .from("token_usage_logs" as any)
    .select("model, provider, input_tokens, output_tokens, cost_usd")
    .eq("organization_id", orgId)
    .gte("created_at", rangeStart.toISOString())

  if (error) {
    if (error.code === "42P01") return { data: [] }
    return { error: error.message }
  }

  const rows = (data ?? []) as unknown as {
    model: string
    provider: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
  }[]

  // Group by model+provider composite key
  const modelMap = new Map<
    string,
    { model: string; provider: string; total_input_tokens: number; total_output_tokens: number; total_cost_usd: number }
  >()

  for (const row of rows) {
    const key = `${row.provider}::${row.model}`
    const existing = modelMap.get(key)

    if (existing) {
      existing.total_input_tokens += row.input_tokens ?? 0
      existing.total_output_tokens += row.output_tokens ?? 0
      existing.total_cost_usd += row.cost_usd ?? 0
    } else {
      modelMap.set(key, {
        model: row.model,
        provider: row.provider,
        total_input_tokens: row.input_tokens ?? 0,
        total_output_tokens: row.output_tokens ?? 0,
        total_cost_usd: row.cost_usd ?? 0,
      })
    }
  }

  const result: TokenUsageByModel[] = Array.from(modelMap.values())

  // Sort by cost descending
  result.sort((a, b) => b.total_cost_usd - a.total_cost_usd)

  return { data: result }
}

/**
 * Get token usage trend bucketed by daily or weekly intervals.
 */
export async function getTokenUsageTrend(
  orgId: string,
  range: TimeRange,
  interval: "daily" | "weekly"
): Promise<ActionResult<TokenUsageTrendEntry[]>> {
  const { supabase } = await requireAuth()

  const rangeStart = getRangeStart(range)

  const { data, error } = await supabase
    .from("token_usage_logs" as any)
    .select("input_tokens, output_tokens, cost_usd, created_at")
    .eq("organization_id", orgId)
    .gte("created_at", rangeStart.toISOString())
    .order("created_at", { ascending: true })

  if (error) {
    if (error.code === "42P01") return { data: [] }
    return { error: error.message }
  }

  const rows = (data ?? []) as unknown as {
    input_tokens: number
    output_tokens: number
    cost_usd: number
    created_at: string
  }[]

  // Bucket by date or week
  const bucketMap = new Map<string, { cost: number; tokens: number }>()

  for (const row of rows) {
    const date = new Date(row.created_at)
    let bucketKey: string

    if (interval === "daily") {
      bucketKey = date.toISOString().slice(0, 10) // "YYYY-MM-DD"
    } else {
      // Weekly: use the Monday of the week as the bucket key
      const day = date.getDay()
      const monday = new Date(date)
      monday.setDate(date.getDate() - ((day + 6) % 7))
      bucketKey = monday.toISOString().slice(0, 10)
    }

    const existing = bucketMap.get(bucketKey)
    const tokens = (row.input_tokens ?? 0) + (row.output_tokens ?? 0)
    const cost = row.cost_usd ?? 0

    if (existing) {
      existing.cost += cost
      existing.tokens += tokens
    } else {
      bucketMap.set(bucketKey, { cost, tokens })
    }
  }

  const trend: TokenUsageTrendEntry[] = Array.from(bucketMap.entries())
    .map(([date, info]) => ({
      date,
      cost: info.cost,
      tokens: info.tokens,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { data: trend }
}

/**
 * Get the most recent token usage entries with agent join.
 */
export async function getRecentTokenUsage(
  orgId: string,
  limit?: number
): Promise<ActionResult<TokenUsageLogWithAgent[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("token_usage_logs" as any)
    .select(`
      *,
      agent:agents(id, name, avatar_url)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit ?? 20)

  if (error) {
    if (error.code === "42P01") return { data: [] }
    return { error: error.message }
  }

  const logs = ((data ?? []) as any[]).map((row) => ({
    ...row,
    agent: Array.isArray(row.agent) ? row.agent[0] ?? null : row.agent,
  })) as TokenUsageLogWithAgent[]

  return { data: logs }
}
