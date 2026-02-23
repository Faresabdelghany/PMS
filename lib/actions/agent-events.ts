"use server"

import { requireAuth } from "./auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export type AgentEventType =
  | "task_started"
  | "task_progress"
  | "task_completed"
  | "task_failed"
  | "agent_message"
  | "approval_request"
  | "status_change"
  | "heartbeat"

export interface AgentEvent {
  id: string
  organization_id: string
  agent_id: string | null
  task_id: string | null
  event_type: AgentEventType
  message: string
  payload: Record<string, unknown>
  created_at: string
}

export interface AgentEventWithAgent extends AgentEvent {
  agent?: {
    id: string
    name: string
    role: string
    squad: string
    avatar_url: string | null
  } | null
  task?: {
    id: string
    name: string
  } | null
}

// ── Actions ──────────────────────────────────────────────────────────

/**
 * Get recent agent events for live activity feed
 */
export async function getAgentEvents(
  orgId: string,
  limit = 20
): Promise<ActionResult<AgentEventWithAgent[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agent_events")
    .select(`
      *,
      agent:agents(id, name, role, squad, avatar_url),
      task:tasks(id, name)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { error: error.message }
  }

  return { data: (data ?? []) as AgentEventWithAgent[] }
}

/**
 * Create an agent event (used by service-role clients / API routes)
 * This uses the service client to bypass RLS — only call from trusted server code.
 */
export async function createAgentEvent(eventData: {
  organization_id: string
  agent_id?: string | null
  task_id?: string | null
  event_type: AgentEventType
  message: string
  payload?: Record<string, unknown>
}): Promise<ActionResult<AgentEvent>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("agent_events")
    .insert({
      organization_id: eventData.organization_id,
      agent_id: eventData.agent_id ?? null,
      task_id: eventData.task_id ?? null,
      event_type: eventData.event_type,
      message: eventData.message,
      payload: eventData.payload ?? {},
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as AgentEvent }
}
