"use server"

import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import type { AgentActivityWithAgent } from "./agents"
import { getOrgAgentActivities } from "./agents"

// Re-export the org-wide activity fetch as the primary activity action
export async function getActivityFeed(
  orgId: string,
  filters?: {
    agentId?: string
    date?: string // ISO date string for filtering by day
    limit?: number
  }
): Promise<ActionResult<AgentActivityWithAgent[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    let query = supabase
      .from("agent_activities" as any)
      .select("*, agent:agents!agent_activities_agent_id_fkey(id, name, role, avatar_url)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(filters?.limit ?? 100)

    if (filters?.agentId) {
      query = query.eq("agent_id", filters.agentId)
    }

    if (filters?.date) {
      const start = new Date(filters.date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(filters.date)
      end.setHours(23, 59, 59, 999)
      query = query
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
    }

    const { data, error } = await query

    if (error) {
      // Table might not exist yet; fall back to empty
      if (error.code === "42P01") return { data: [] }
      return { error: error.message }
    }

    const activities = ((data ?? []) as any[]).map((row) => ({
      ...row,
      agent: Array.isArray(row.agent)
        ? row.agent[0] ?? { id: "", name: "Unknown", role: "", avatar_url: null }
        : row.agent,
    })) as AgentActivityWithAgent[]

    return { data: activities }
  } catch {
    return { data: [] }
  }
}

// Re-export helper
export type { AgentActivityWithAgent } from "./agents"
