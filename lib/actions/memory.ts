"use server"

import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export interface AgentMemoryCard {
  agent: {
    id: string
    name: string
    role: string
    avatar_url: string | null
  }
  currentTask: string | null
  lastEvent: {
    id: string
    event_type: string
    message: string
    created_at: string
  } | null
}

export async function getAgentMemoryCards(orgId: string): Promise<ActionResult<AgentMemoryCard[]>> {
  const { supabase } = await requireAuth()

  // Get agents
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, role, avatar_url")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name")

  if (agentsError) return { error: agentsError.message }
  if (!agents?.length) return { data: [] }

  // Get latest event per agent
  const { data: events } = await supabase
    .from("agent_events")
    .select("id, agent_id, event_type, message, created_at")
    .eq("organization_id", orgId)
    .in("agent_id", agents.map((a) => a.id))
    .order("created_at", { ascending: false })

  const latestByAgent = new Map<string, (typeof events extends (infer U)[] | null ? U : never)>()
  for (const event of events ?? []) {
    if (event.agent_id && !latestByAgent.has(event.agent_id)) {
      latestByAgent.set(event.agent_id, event)
    }
  }

  const cards: AgentMemoryCard[] = agents.map((agent) => {
    const lastEvent = latestByAgent.get(agent.id) ?? null
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        avatar_url: agent.avatar_url,
      },
      currentTask: null,
      lastEvent: lastEvent
        ? {
            id: lastEvent.id,
            event_type: lastEvent.event_type,
            message: lastEvent.message,
            created_at: lastEvent.created_at,
          }
        : null,
    }
  })

  return { data: cards }
}

export interface AgentEventHistoryItem {
  id: string
  event_type: string
  message: string
  payload: Record<string, unknown>
  created_at: string
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
