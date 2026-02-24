"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export interface TaskMessage {
  id: string
  organization_id: string
  task_id: string
  from_agent_id: string | null
  from_user_id: string | null
  content: string
  created_at: string
  agent?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
}

export interface AgentNotification {
  id: string
  organization_id: string
  mentioned_agent_id: string
  task_id: string | null
  message_id: string | null
  content: string
  delivered: boolean
  created_at: string
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getMessages(
  taskId: string
): Promise<ActionResult<TaskMessage[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("task_messages")
    .select(`
      *,
      agent:agents!from_agent_id(id, name, avatar_url)
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { data: (data ?? []) as unknown as TaskMessage[] }
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createMessage(
  orgId: string,
  taskId: string,
  content: string,
  fromAgentId?: string | null,
  fromUserId?: string | null
): Promise<ActionResult<TaskMessage>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("task_messages")
    .insert({
      organization_id: orgId,
      task_id: taskId,
      from_agent_id: fromAgentId ?? null,
      from_user_id: fromUserId ?? null,
      content,
    })
    .select(`
      *,
      agent:agents!from_agent_id(id, name, avatar_url)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as unknown as TaskMessage }
}

export async function createNotification(
  orgId: string,
  mentionedAgentId: string,
  content: string,
  taskId?: string | null,
  messageId?: string | null
): Promise<ActionResult<AgentNotification>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("agent_notifications")
    .insert({
      organization_id: orgId,
      mentioned_agent_id: mentionedAgentId,
      task_id: taskId ?? null,
      message_id: messageId ?? null,
      content,
    })
    .select("*")
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as unknown as AgentNotification }
}
