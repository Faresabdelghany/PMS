"use server"

import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type AgentSessionStatus = "active" | "idle" | "offline"

export interface AgentSession {
  agent: {
    id: string
    name: string
    role: string
    avatar_url: string | null
  }
  lastEvent: {
    id: string
    event_type: string
    message: string
    created_at: string
  } | null
  status: AgentSessionStatus
}

export interface AgentEventHistoryItem {
  id: string
  event_type: string
  message: string
  payload: Record<string, unknown>
  created_at: string
}

function computeStatus(lastEventTime: string | null): AgentSessionStatus {
  if (!lastEventTime) return "offline"
  const diff = Date.now() - new Date(lastEventTime).getTime()
  if (diff < 15 * 60 * 1000) return "active"
  if (diff < 60 * 60 * 1000) return "idle"
  return "offline"
}

export async function getAgentSessions(orgId: string): Promise<ActionResult<AgentSession[]>> {
  const { supabase } = await requireAuth()

  // Get all agents
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, role, avatar_url")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name")

  if (agentsError) return { error: agentsError.message }
  if (!agents?.length) return { data: [] }

  // Get latest event per agent
  const { data: events, error: eventsError } = await supabase
    .from("agent_events")
    .select("id, agent_id, event_type, message, created_at")
    .eq("organization_id", orgId)
    .in("agent_id", agents.map((a) => a.id))
    .order("created_at", { ascending: false })

  if (eventsError) return { error: eventsError.message }

  // Group by agent, take latest
  const latestByAgent = new Map<string, typeof events[0]>()
  for (const event of events ?? []) {
    if (event.agent_id && !latestByAgent.has(event.agent_id)) {
      latestByAgent.set(event.agent_id, event)
    }
  }

  const sessions: AgentSession[] = agents.map((agent) => {
    const lastEvent = latestByAgent.get(agent.id) ?? null
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        avatar_url: agent.avatar_url,
      },
      lastEvent: lastEvent
        ? {
            id: lastEvent.id,
            event_type: lastEvent.event_type,
            message: lastEvent.message,
            created_at: lastEvent.created_at,
          }
        : null,
      status: computeStatus(lastEvent?.created_at ?? null),
    }
  })

  return { data: sessions }
}

export async function getAgentEventHistory(
  agentId: string,
  orgId: string,
  limit = 20
): Promise<ActionResult<AgentEventHistoryItem[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agent_events")
    .select("id, event_type, message, payload, created_at")
    .eq("organization_id", orgId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { error: error.message }
  return { data: (data ?? []) as AgentEventHistoryItem[] }
}
