"use server"

import { createInboxItemsForUsers } from "./inbox"
import { extractMentions } from "@/lib/utils/mentions"
import type { InboxItemType, Json } from "@/lib/supabase/types"

interface NotifyParams {
  orgId: string
  userIds: string[]
  actorId: string
  type: InboxItemType
  title: string
  message?: string
  projectId?: string
  taskId?: string
  clientId?: string
  metadata?: Json
}

/**
 * Send notifications to multiple users, excluding the actor (don't notify yourself).
 * This is the primary helper for triggering notifications from server actions.
 */
export async function notify({
  orgId,
  userIds,
  actorId,
  type,
  title,
  message,
  projectId,
  taskId,
  clientId,
  metadata,
}: NotifyParams): Promise<void> {
  // Filter out the actor (don't notify yourself)
  const recipients = userIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return

  await createInboxItemsForUsers(recipients, {
    organization_id: orgId,
    actor_id: actorId,
    item_type: type,
    title,
    message: message ?? null,
    project_id: projectId ?? null,
    task_id: taskId ?? null,
    client_id: clientId ?? null,
    ...(metadata !== undefined && { metadata }),
  })
}

/**
 * Notify mentioned users in a piece of text content.
 * Extracts @mentions and sends notifications to those users.
 */
export async function notifyMentions({
  orgId,
  actorId,
  content,
  contextTitle,
  projectId,
  taskId,
}: {
  orgId: string
  actorId: string
  content: string
  contextTitle: string
  projectId?: string
  taskId?: string
}): Promise<void> {
  const mentionedUserIds = extractMentions(content)
  if (mentionedUserIds.length === 0) return

  await notify({
    orgId,
    userIds: mentionedUserIds,
    actorId,
    type: "comment",
    title: `mentioned you in "${contextTitle}"`,
    projectId,
    taskId,
  })
}
