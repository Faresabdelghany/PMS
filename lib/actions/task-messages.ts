"use server"

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

export interface TaskSubscription {
  id: string
  task_id: string
  agent_id: string
  organization_id: string
  created_at: string
}

// ── Subscription Helpers ─────────────────────────────────────────────

/**
 * Upsert a subscription for an agent on a task thread.
 * Safe to call multiple times — ignores duplicates.
 * Never throws — failures are logged but do not propagate.
 */
async function subscribeToTask(
  orgId: string,
  taskId: string,
  agentId: string
): Promise<void> {
  try {
    const { supabase } = await requireAuth()
    await (supabase as any)
      .from("task_subscriptions" as any)
      .upsert(
        {
          organization_id: orgId,
          task_id: taskId,
          agent_id: agentId,
        },
        { onConflict: "task_id,agent_id", ignoreDuplicates: true }
      )
  } catch (err) {
    console.error("[task-messages] subscribeToTask error:", err)
  }
}

/**
 * Public exported version so other actions (e.g. task assignment) can subscribe agents.
 */
export async function subscribeAgentToTask(
  orgId: string,
  taskId: string,
  agentId: string
): Promise<void> {
  await subscribeToTask(orgId, taskId, agentId)
}

/**
 * Create agent_notifications for ALL subscribers of a task thread,
 * excluding the agent who posted the comment.
 * Never throws — failures are logged but do not propagate.
 */
async function notifySubscribers(
  orgId: string,
  taskId: string,
  messageId: string,
  content: string,
  excludeAgentId?: string | null
): Promise<void> {
  try {
    const { supabase } = await requireAuth()

    // Fetch all subscribers for this task
    const { data: subscriptions } = await (supabase as any)
      .from("task_subscriptions" as any)
      .select("agent_id")
      .eq("task_id", taskId)
      .eq("organization_id", orgId)

    if (!subscriptions || subscriptions.length === 0) return

    // Exclude the commenter themselves
    const targetAgentIds = (subscriptions as Array<{ agent_id: string }>)
      .map((s) => s.agent_id)
      .filter((id) => id !== excludeAgentId)

    if (targetAgentIds.length === 0) return

    const notifications = targetAgentIds.map((agentId) => ({
      organization_id: orgId,
      mentioned_agent_id: agentId,
      task_id: taskId,
      message_id: messageId,
      content: `New comment on a task thread you're subscribed to: "${content.slice(0, 200)}"`,
      delivered: false,
    }))

    await (supabase as any).from("agent_notifications").insert(notifications)
  } catch (err) {
    console.error("[task-messages] notifySubscribers error:", err)
  }
}

// ── Mention Helpers ──────────────────────────────────────────────────

/**
 * Extract @AgentName mentions from a message string.
 * Returns deduplicated list of mentioned names (without the @ symbol).
 */
function parseMentions(content: string): string[] {
  const regex = /@([A-Za-z][A-Za-z0-9 _-]{0,49})/g
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    names.add(match[1].trim())
  }
  return Array.from(names)
}

/**
 * After a message is inserted, create agent_notifications for any @mentioned agents
 * and auto-subscribe them to the task thread.
 * Never throws — failures are logged but do not propagate.
 */
async function handleMentions(
  orgId: string,
  taskId: string,
  messageId: string,
  content: string
): Promise<void> {
  try {
    const mentions = parseMentions(content)
    if (mentions.length === 0) return

    const { supabase } = await requireAuth()

    const { data: agents } = await (supabase as any)
      .from("agents")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("name", mentions)

    if (!agents || agents.length === 0) return

    const agentList = agents as Array<{ id: string; name: string }>

    // Subscribe mentioned agents to the thread
    await Promise.all(
      agentList.map((agent) => subscribeToTask(orgId, taskId, agent.id))
    )

    const notifications = agentList.map((agent) => ({
      organization_id: orgId,
      mentioned_agent_id: agent.id,
      task_id: taskId,
      message_id: messageId,
      content: `You were mentioned in a task message: "${content.slice(0, 200)}"`,
      delivered: false,
    }))

    await (supabase as any).from("agent_notifications").insert(notifications)
  } catch (err) {
    console.error("[task-messages] handleMentions error:", err)
  }
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

  // Auto-subscribe the commenter (agent) to this thread
  if (fromAgentId) {
    await subscribeToTask(orgId, taskId, fromAgentId)
  }

  // Notify all existing subscribers about the new comment (excluding commenter)
  await notifySubscribers(orgId, taskId, data.id, content, fromAgentId)

  // Parse @mentions and create agent_notifications + subscribe mentioned agents (non-blocking)
  await handleMentions(orgId, taskId, data.id, content)

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
