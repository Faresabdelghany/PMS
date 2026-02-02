"use server"

import { requireAuth } from "./auth-helpers"
import type { ChatConversation, ChatMessage, ChatMessageInsert, Json } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

/**
 * Get all conversations for the current user in an organization.
 * Returns up to 50 conversations ordered by most recently updated.
 */
export async function getConversations(
  organizationId: string
): Promise<ActionResult<ChatConversation[]>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50)

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
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

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to get messages" }
  }
}

/**
 * Create a new conversation.
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
 * Used when action status changes (pending → executing → success/error).
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
 */
export async function deleteConversation(
  conversationId: string
): Promise<ActionResult<void>> {
  try {
    const { supabase } = await requireAuth()

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", conversationId)

    if (error) {
      return { error: error.message }
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
      .limit(20)

    if (error) {
      return { error: error.message }
    }

    return { data: data ?? [] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to search conversations" }
  }
}
