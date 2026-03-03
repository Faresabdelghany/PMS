"use server"

import { requireOrgMember } from "./auth-helpers"
import { MEMORY_EVENTS_LIMIT, MEMORY_SEARCH_LIMIT } from "@/lib/constants"
import type { ActionResult } from "./types"

// ── Types ─────────────────────────────────────────────────────────────

export interface MemoryJournalSummary {
  date: string // "2026-03-02" ISO date
  eventCount: number
  wordCount: number
  byteSize: number
  agents: string[] // unique agent names that day
}

export interface MemoryJournalEvent {
  id: string
  event_type: string
  message: string
  created_at: string
  agent: { id: string; name: string; avatar_url: string | null }
  task?: { id: string; name: string; status: string; priority: string } | null
}

export interface MemoryLongTermSummary {
  totalEvents: number
  totalWordCount: number
  oldestEventDate: string | null
  lastUpdated: string | null
}

// ── Server Actions ────────────────────────────────────────────────────

export async function getMemoryJournals(
  orgId: string
): Promise<ActionResult<MemoryJournalSummary[]>> {
  const { supabase } = await requireOrgMember(orgId)

  const { data, error } = await supabase
    .from("agent_events")
    .select("id, message, created_at, agents:agent_id(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(MEMORY_EVENTS_LIMIT)

  if (error) return { error: error.message }

  const rows = (data ?? []) as unknown as {
    id: string
    message: string
    created_at: string
    agents: { name: string } | null
  }[]

  // Group by ISO date
  const dayMap = new Map<
    string,
    { eventCount: number; wordCount: number; byteSize: number; agents: Set<string> }
  >()

  for (const row of rows) {
    const date = row.created_at.slice(0, 10) // "YYYY-MM-DD"
    const existing = dayMap.get(date)
    const msg = row.message ?? ""
    const words = msg.split(/\s+/).filter(Boolean).length
    const bytes = new TextEncoder().encode(msg).length
    const agentName = row.agents?.name ?? "Unknown"

    if (existing) {
      existing.eventCount++
      existing.wordCount += words
      existing.byteSize += bytes
      existing.agents.add(agentName)
    } else {
      dayMap.set(date, {
        eventCount: 1,
        wordCount: words,
        byteSize: bytes,
        agents: new Set([agentName]),
      })
    }
  }

  const journals: MemoryJournalSummary[] = Array.from(dayMap.entries())
    .map(([date, info]) => ({
      date,
      eventCount: info.eventCount,
      wordCount: info.wordCount,
      byteSize: info.byteSize,
      agents: Array.from(info.agents),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return { data: journals }
}

export async function getJournalContent(
  orgId: string,
  date: string
): Promise<ActionResult<MemoryJournalEvent[]>> {
  const { supabase } = await requireOrgMember(orgId)

  // Fetch events for the given date (UTC day boundaries)
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`

  const { data, error } = await supabase
    .from("agent_events")
    .select("id, event_type, message, created_at, agents:agent_id(id, name, avatar_url), tasks:task_id(id, name, status, priority)")
    .eq("organization_id", orgId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }

  const events: MemoryJournalEvent[] = ((data ?? []) as unknown as {
    id: string
    event_type: string
    message: string
    created_at: string
    agents: { id: string; name: string; avatar_url: string | null } | null
    tasks: { id: string; name: string; status: string; priority: string } | null
  }[]).map((row) => ({
    id: row.id,
    event_type: row.event_type,
    message: row.message,
    created_at: row.created_at,
    agent: row.agents ?? { id: "", name: "Unknown", avatar_url: null },
    task: row.tasks ?? null,
  }))

  return { data: events }
}

export async function searchMemories(
  orgId: string,
  query: string
): Promise<ActionResult<MemoryJournalEvent[]>> {
  const { supabase } = await requireOrgMember(orgId)

  const { data, error } = await supabase
    .from("agent_events")
    .select("id, event_type, message, created_at, agents:agent_id(id, name, avatar_url), tasks:task_id(id, name, status, priority)")
    .eq("organization_id", orgId)
    .ilike("message", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(MEMORY_SEARCH_LIMIT)

  if (error) return { error: error.message }

  const events: MemoryJournalEvent[] = ((data ?? []) as unknown as {
    id: string
    event_type: string
    message: string
    created_at: string
    agents: { id: string; name: string; avatar_url: string | null } | null
    tasks: { id: string; name: string; status: string; priority: string } | null
  }[]).map((row) => ({
    id: row.id,
    event_type: row.event_type,
    message: row.message,
    created_at: row.created_at,
    agent: row.agents ?? { id: "", name: "Unknown", avatar_url: null },
    task: row.tasks ?? null,
  }))

  return { data: events }
}

export async function getMemoryLongTermSummary(
  orgId: string
): Promise<ActionResult<MemoryLongTermSummary>> {
  const { supabase } = await requireOrgMember(orgId)

  const { data, error } = await supabase
    .from("agent_events")
    .select("message, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }

  const rows = data ?? []

  if (rows.length === 0) {
    return {
      data: {
        totalEvents: 0,
        totalWordCount: 0,
        oldestEventDate: null,
        lastUpdated: null,
      },
    }
  }

  let totalWordCount = 0
  for (const row of rows) {
    totalWordCount += (row.message ?? "").split(/\s+/).filter(Boolean).length
  }

  return {
    data: {
      totalEvents: rows.length,
      totalWordCount,
      oldestEventDate: rows[0].created_at,
      lastUpdated: rows[rows.length - 1].created_at,
    },
  }
}
