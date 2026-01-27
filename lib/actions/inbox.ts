"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { InboxItem, InboxItemInsert, InboxItemWithRelations, InboxItemType } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

export type InboxFilters = {
  isRead?: boolean
  itemType?: InboxItemType
}

// Get inbox items for current user with optional filters
export async function getInboxItems(
  filters?: InboxFilters
): Promise<ActionResult<InboxItemWithRelations[]>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  let query = supabase
    .from("inbox_items")
    .select(`
      *,
      actor:profiles!inbox_items_actor_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      task:tasks(id, name),
      client:clients(id, name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (filters?.isRead !== undefined) {
    query = query.eq("is_read", filters.isRead)
  }

  if (filters?.itemType) {
    query = query.eq("item_type", filters.itemType)
  }

  const { data, error } = await query.limit(50)

  if (error) {
    return { error: error.message }
  }

  return { data: data as InboxItemWithRelations[] }
}

// Get unread count for current user
export async function getUnreadCount(): Promise<ActionResult<number>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const { count, error } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false)

  if (error) {
    return { error: error.message }
  }

  return { data: count || 0 }
}

// Mark a single inbox item as read
export async function markAsRead(itemId: string): Promise<ActionResult<InboxItem>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("inbox_items")
    .update({ is_read: true })
    .eq("id", itemId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/inbox")
  return { data }
}

// Mark all inbox items as read for current user
export async function markAllAsRead(): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const { error } = await supabase
    .from("inbox_items")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/inbox")
  return {}
}

// Delete a single inbox item
export async function deleteInboxItem(itemId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("inbox_items")
    .delete()
    .eq("id", itemId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/inbox")
  return {}
}

// Create an inbox item (for triggering notifications)
export async function createInboxItem(
  data: Omit<InboxItemInsert, "id" | "created_at">
): Promise<ActionResult<InboxItem>> {
  const supabase = await createClient()

  const { data: item, error } = await supabase
    .from("inbox_items")
    .insert(data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: item }
}

// Create inbox items for multiple users (e.g., notify all project members)
export async function createInboxItemsForUsers(
  userIds: string[],
  data: Omit<InboxItemInsert, "id" | "created_at" | "user_id">
): Promise<ActionResult<number>> {
  const supabase = await createClient()

  const items = userIds.map((userId) => ({
    ...data,
    user_id: userId,
  }))

  const { data: result, error } = await supabase
    .from("inbox_items")
    .insert(items)
    .select("id")

  if (error) {
    return { error: error.message }
  }

  return { data: result?.length || 0 }
}
