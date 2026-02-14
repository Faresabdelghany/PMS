"use server"

import { after } from "next/server"
import type { InboxItem, InboxItemInsert, InboxItemWithRelations, InboxItemType } from "@/lib/supabase/types"
import type { ActionResult, PaginatedResult } from "./types"
import { requireAuth } from "./auth-helpers"
import { cacheGet, CacheKeys, CacheTTL, invalidateCache } from "@/lib/cache"
import { INBOX_PAGE_SIZE } from "@/lib/constants"
import { encodeCursor, decodeCursor } from "./cursor"

export type InboxFilters = {
  isRead?: boolean
  itemType?: InboxItemType
}

// Get inbox items for current user with optional filters and cursor-based pagination
export async function getInboxItems(
  filters?: InboxFilters,
  cursor?: string,
  limit: number = INBOX_PAGE_SIZE
): Promise<PaginatedResult<InboxItemWithRelations>> {
  try {
    const { user, supabase } = await requireAuth()

    // Only cache unfiltered, first-page queries
    const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

    if (!hasFilters && !cursor) {
      try {
        const items = await cacheGet(
          CacheKeys.inbox(user.id),
          async () => {
            const { data, error } = await supabase
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
              .order("id", { ascending: false })
              .limit(limit + 1)

            if (error) throw error
            return data as InboxItemWithRelations[]
          },
          CacheTTL.INBOX
        )

        const hasMore = items.length > limit
        const page = hasMore ? items.slice(0, limit) : items
        const nextCursor = hasMore
          ? encodeCursor(page[page.length - 1].created_at, page[page.length - 1].id)
          : null

        return { data: page, nextCursor, hasMore }
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Failed to fetch inbox" }
      }
    }

    // Filtered or cursor query - don't cache
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

    if (filters?.isRead !== undefined) {
      query = query.eq("is_read", filters.isRead)
    }

    if (filters?.itemType) {
      query = query.eq("item_type", filters.itemType)
    }

    // Compound cursor: (created_at, id) DESC
    if (cursor) {
      try {
        const { value, id } = decodeCursor(cursor)
        query = query.or(
          `created_at.lt.${value},and(created_at.eq.${value},id.lt.${id})`
        )
      } catch {
        return { error: "Invalid cursor" }
      }
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1)

    if (error) {
      return { error: error.message }
    }

    const hasMore = (data?.length || 0) > limit
    const items = hasMore ? data!.slice(0, limit) : (data || [])
    const nextCursor = hasMore
      ? encodeCursor(items[items.length - 1].created_at, items[items.length - 1].id)
      : null

    return {
      data: items as InboxItemWithRelations[],
      nextCursor,
      hasMore,
    }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get unread count for current user
export async function getUnreadCount(): Promise<ActionResult<number>> {
  try {
    const { user, supabase } = await requireAuth()

    const { count, error } = await supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    if (error) {
      return { error: error.message }
    }

    return { data: count || 0 }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Mark a single inbox item as read
export async function markAsRead(itemId: string): Promise<ActionResult<InboxItem>> {
  const { user, supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("inbox_items")
    .update({ is_read: true })
    .eq("id", itemId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    await invalidateCache.inbox({ userId: user.id })
  })

  return { data }
}

// Mark all inbox items as read for current user
export async function markAllAsRead(): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireAuth()

    const { error } = await supabase
      .from("inbox_items")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    if (error) {
      return { error: error.message }
    }

    after(async () => {
      await invalidateCache.inbox({ userId: user.id })
    })

    return {}
  } catch {
    return { error: "Not authenticated" }
  }
}

// Delete a single inbox item
export async function deleteInboxItem(itemId: string): Promise<ActionResult> {
  const { user, supabase } = await requireAuth()

  const { error } = await supabase
    .from("inbox_items")
    .delete()
    .eq("id", itemId)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    await invalidateCache.inbox({ userId: user.id })
  })

  return {}
}

// Create an inbox item (for triggering notifications)
export async function createInboxItem(
  data: Omit<InboxItemInsert, "id" | "created_at">
): Promise<ActionResult<InboxItem>> {
  const { supabase } = await requireAuth()

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
  const { supabase } = await requireAuth()

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
