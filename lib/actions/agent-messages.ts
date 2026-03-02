"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export type MessageType = "text" | "status" | "handoff" | "task_update" | "system"

export interface AgentConversation {
  id: string
  organization_id: string
  title: string | null
  participant_agent_ids: string[]
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface AgentMessage {
  id: string
  organization_id: string
  conversation_id: string
  from_agent_id: string | null
  from_user_id: string | null
  content: string
  message_type: MessageType
  metadata: Record<string, unknown>
  created_at: string
}

export interface AgentMessageWithSender extends AgentMessage {
  from_agent?: { id: string; name: string; avatar_url: string | null } | null
}

// ── Validation ───────────────────────────────────────────────────────

const createConversationSchema = z.object({
  participant_agent_ids: z.array(z.string().uuid()).min(1),
  title: z.string().trim().max(200).optional().nullable(),
})

const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().trim().min(1).max(10000),
  message_type: z.enum(["text", "status", "handoff", "task_update", "system"]).default("text"),
  from_agent_id: z.string().uuid().optional().nullable(),
  from_user_id: z.string().uuid().optional().nullable(),
})

// ── Actions ──────────────────────────────────────────────────────────

/**
 * List conversations for an organization, ordered by most recent activity.
 */
export async function getConversations(
  orgId: string,
  limit?: number
): Promise<ActionResult<AgentConversation[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("agent_conversations" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit ?? 30)

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as AgentConversation[] }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Create a new conversation between agents (and optionally a user).
 */
export async function createConversation(
  orgId: string,
  participantAgentIds: string[],
  title?: string | null
): Promise<ActionResult<AgentConversation>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const parsed = createConversationSchema.safeParse({
      participant_agent_ids: participantAgentIds,
      title,
    })
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid conversation data" }
    }

    const { data, error } = await supabase
      .from("agent_conversations" as any)
      .insert({
        organization_id: orgId,
        title: parsed.data.title ?? null,
        participant_agent_ids: parsed.data.participant_agent_ids,
        last_message_at: null,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/agent-messages"))

    return { data: data as unknown as AgentConversation }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * List messages in a conversation, with from_agent join.
 * Ordered by created_at ASC (oldest first) for chat-style display.
 */
export async function getMessages(
  orgId: string,
  conversationId: string,
  limit?: number,
  offset?: number
): Promise<ActionResult<AgentMessageWithSender[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    let query = supabase
      .from("agent_messages" as any)
      .select(`
        *,
        from_agent:agents(id, name, avatar_url)
      `)
      .eq("organization_id", orgId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (offset) {
      query = query.range(offset, offset + (limit ?? 50) - 1)
    } else {
      query = query.limit(limit ?? 50)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as AgentMessageWithSender[] }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Send a message in a conversation.
 * Also updates the conversation's last_message_at timestamp.
 */
export async function sendMessage(
  orgId: string,
  conversationId: string,
  content: string,
  type?: MessageType,
  fromAgentId?: string | null,
  fromUserId?: string | null
): Promise<ActionResult<AgentMessage>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const parsed = sendMessageSchema.safeParse({
      conversation_id: conversationId,
      content,
      message_type: type ?? "text",
      from_agent_id: fromAgentId,
      from_user_id: fromUserId,
    })
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid message data" }
    }

    const now = new Date().toISOString()

    // Insert the message
    const { data, error } = await supabase
      .from("agent_messages" as any)
      .insert({
        organization_id: orgId,
        conversation_id: parsed.data.conversation_id,
        from_agent_id: parsed.data.from_agent_id ?? null,
        from_user_id: parsed.data.from_user_id ?? null,
        content: parsed.data.content,
        message_type: parsed.data.message_type,
        metadata: {},
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Update conversation's last_message_at
    await supabase
      .from("agent_conversations" as any)
      .update({ last_message_at: now })
      .eq("id", conversationId)
      .eq("organization_id", orgId)

    after(() => revalidatePath("/agent-messages"))

    return { data: data as unknown as AgentMessage }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Get the count of conversations with messages in the last 24 hours.
 * Serves as a proxy for "unread" until a proper last_read tracking is implemented.
 */
export async function getUnreadCount(
  orgId: string
): Promise<ActionResult<number>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { count, error } = await supabase
      .from("agent_conversations" as any)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("last_message_at", twentyFourHoursAgo)

    if (error) return { data: 0 }
    return { data: count ?? 0 }
  } catch {
    return { data: 0 }
  }
}
