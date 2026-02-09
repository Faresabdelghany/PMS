"use server"

import { requireAuth } from "./auth-helpers"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import type { ChatConversation, ChatMessage, ChatMessageInsert, Json } from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { CONVERSATION_PAGE_SIZE, MESSAGE_PAGE_SIZE, SEARCH_CONVERSATION_LIMIT } from "@/lib/constants"

/**
 * Get all conversations for the current user in an organization.
 * Returns up to 50 conversations ordered by most recently updated.
 * Uses KV cache with 2-minute TTL.
 */
export async function getConversations(
  organizationId: string
): Promise<ActionResult<ChatConversation[]>> {
  try {
    const { user, supabase } = await requireAuth()

    const conversations = await cacheGet(
      CacheKeys.conversations(user.id, organizationId),
      async () => {
        const { data, error } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(CONVERSATION_PAGE_SIZE)

        if (error) throw error
        return data ?? []
      },
      CacheTTL.CONVERSATIONS
    )

    return { data: conversations }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get conversations" }
  }
}

/**
 * Get a single conversation by ID.
 * RLS ensures only the owner can access it.
 */
export async function getConversation(
  conversationId: string
): Promise<ActionResult<ChatConversation>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("id", conversationId)
      .single()

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get conversation" }
  }
}

/**
 * Get all messages for a conversation.
 * RLS ensures only the conversation owner can access messages.
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ActionResult<ChatMessage[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MESSAGE_PAGE_SIZE)

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get messages" }
  }
}

/**
 * Get a conversation and its messages in a single database call.
 * Uses the get_conversation_with_messages RPC function to eliminate
 * 2 separate round trips (getConversation + getConversationMessages).
 */
export async function getConversationWithMessages(
  conversationId: string
): Promise<ActionResult<{ conversation: ChatConversation | null; messages: ChatMessage[] }>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase.rpc("get_conversation_with_messages", {
      p_conversation_id: conversationId,
      p_message_limit: MESSAGE_PAGE_SIZE,
    })

    if (error) {
      return { error: error.message }
    }

    const result = data as unknown as {
      conversation: ChatConversation | null
      messages: ChatMessage[]
    } | null

    return {
      data: {
        conversation: result?.conversation ?? null,
        messages: result?.messages ?? [],
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get conversation" }
  }
}

/**
 * Create a new conversation.
 * Invalidates conversation list cache after creation.
 */
export async function createConversation(
  organizationId: string,
  title?: string
): Promise<ActionResult<ChatConversation>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        title: title ?? "New Chat",
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    // Invalidate conversations cache
    await invalidate.conversations(user.id, organizationId)

    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create conversation" }
  }
}

/**
 * Add a message to a conversation.
 */
export async function addMessage(
  conversationId: string,
  data: {
    role: "user" | "assistant"
    content: string
    attachments?: Json | null
    action_data?: Json | null
    multi_action_data?: Json | null
  }
): Promise<ActionResult<ChatMessage>> {
  try {
    const { supabase } = await requireAuth()

    const insertData: ChatMessageInsert = {
      conversation_id: conversationId,
      role: data.role,
      content: data.content,
      attachments: data.attachments,
      action_data: data.action_data,
      multi_action_data: data.multi_action_data,
    }

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    return { data: message }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add message" }
  }
}

/**
 * Update action data on a message.
 * Used when action status changes (pending -> executing -> success/error).
 */
export async function updateMessageActionData(
  messageId: string,
  actionData: unknown,
  multiActionData?: unknown
): Promise<ActionResult<void>> {
  try {
    const { supabase } = await requireAuth()

    const updatePayload: Record<string, unknown> = {
      action_data: actionData,
    }

    if (multiActionData !== undefined) {
      updatePayload.multi_action_data = multiActionData
    }

    const { error } = await supabase
      .from("chat_messages")
      .update(updatePayload)
      .eq("id", messageId)

    if (error) {
      return { error: error.message }
    }

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update message" }
  }
}

/**
 * Update a conversation's title.
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<ActionResult<void>> {
  try {
    const { supabase } = await requireAuth()

    const { error } = await supabase
      .from("chat_conversations")
      .update({ title })
      .eq("id", conversationId)

    if (error) {
      return { error: error.message }
    }

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update conversation" }
  }
}

/**
 * Delete a conversation.
 * Messages are automatically deleted via cascade.
 * Invalidates conversation list cache after deletion.
 */
export async function deleteConversation(
  conversationId: string,
  organizationId?: string
): Promise<ActionResult<void>> {
  try {
    const { user, supabase } = await requireAuth()

    // If orgId provided, invalidate cache; otherwise fetch it first
    let orgId = organizationId
    if (!orgId) {
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("organization_id")
        .eq("id", conversationId)
        .single()
      orgId = conv?.organization_id
    }

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", conversationId)

    if (error) {
      return { error: error.message }
    }

    if (orgId) {
      await invalidate.conversations(user.id, orgId)
    }

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete conversation" }
  }
}

/**
 * Search conversations by title.
 * Returns up to 20 matching conversations.
 */
export async function searchConversations(
  organizationId: string,
  query: string
): Promise<ActionResult<ChatConversation[]>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .ilike("title", `%${query}%`)
      .order("updated_at", { ascending: false })
      .limit(SEARCH_CONVERSATION_LIMIT)

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to search conversations" }
  }
}
