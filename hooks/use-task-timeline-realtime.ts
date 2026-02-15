"use client"

import { useEffect, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useDocumentVisibility } from "./use-document-visibility"
import type {
  Json,
  TaskCommentWithRelations,
  TaskActivityWithRelations,
  TaskCommentReaction,
} from "@/lib/supabase/types"

/** Debounce delay (ms) before rebuilding the reactions channel after commentIds change */
const REACTION_CHANNEL_DEBOUNCE_MS = 500

interface UseTaskTimelineRealtimeCallbacks {
  onCommentInsert?: (comment: TaskCommentWithRelations) => void
  onCommentUpdate?: (comment: TaskCommentWithRelations) => void
  onCommentDelete?: (commentId: string) => void
  onActivityInsert?: (activity: TaskActivityWithRelations) => void
  onReactionInsert?: (commentId: string, reaction: TaskCommentReaction) => void
  onReactionDelete?: (commentId: string, reactionId: string) => void
}

export function useTaskTimelineRealtime(
  taskId: string | null,
  commentIds: string[],
  callbacks: UseTaskTimelineRealtimeCallbacks
) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const isVisible = useDocumentVisibility()
  const isVisibleRef = useRef(isVisible)
  isVisibleRef.current = isVisible

  // Refs for channel management so the visibility effect can access them
  const timelineChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const reactionsChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  const fetchCommentWithRelations = useCallback(
    async (commentId: string): Promise<TaskCommentWithRelations | null> => {
      const supabase = createClient()
      const { data } = await supabase
        .from("task_comments")
        .select(`
          *,
          author:profiles(id, full_name, email, avatar_url),
          reactions:task_comment_reactions(*),
          attachments:task_comment_attachments(*)
        `)
        .eq("id", commentId)
        .single()
      return data as TaskCommentWithRelations | null
    },
    []
  )

  // Visibility-based pause/resume for both channels
  useEffect(() => {
    const timelineChannel = timelineChannelRef.current
    const reactionsChannel = reactionsChannelRef.current

    if (isVisible) {
      timelineChannel?.subscribe()
      reactionsChannel?.subscribe()
    } else {
      timelineChannel?.unsubscribe()
      reactionsChannel?.unsubscribe()
    }
  }, [isVisible])

  // Channel 1: Comments & activities -- stable, only depends on taskId
  useEffect(() => {
    if (!taskId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`task-timeline-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const newRecord = payload.new as { id?: string } | undefined
          const oldRecord = payload.old as { id?: string } | undefined
          if (payload.eventType === "INSERT" && newRecord?.id) {
            // Comments need relations (author, reactions, attachments) -- must fetch
            const comment = await fetchCommentWithRelations(newRecord.id)
            if (comment) {
              callbacksRef.current.onCommentInsert?.(comment)
            }
          } else if (payload.eventType === "UPDATE" && newRecord?.id) {
            const comment = await fetchCommentWithRelations(newRecord.id)
            if (comment) {
              callbacksRef.current.onCommentUpdate?.(comment)
            }
          } else if (payload.eventType === "DELETE" && oldRecord?.id) {
            callbacksRef.current.onCommentDelete?.(oldRecord.id)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_activities",
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          // Activities payload contains all scalar fields.
          // We only need the actor profile (a single join), so we construct
          // the activity from the payload and fetch only the actor profile
          // instead of re-fetching the whole row with relations.
          const newRecord = payload.new as Record<string, unknown> | undefined
          if (!newRecord?.id) return

          const supabaseInner = createClient()
          const actorId = newRecord.actor_id as string | null

          let actor = null
          if (actorId) {
            const { data: profile } = await supabaseInner
              .from("profiles")
              .select("id, full_name, email, avatar_url")
              .eq("id", actorId)
              .single()
            actor = profile
          }

          const activity: TaskActivityWithRelations = {
            id: newRecord.id as string,
            task_id: newRecord.task_id as string,
            actor_id: newRecord.actor_id as string,
            action: newRecord.action as string,
            old_value: (newRecord.old_value as string | null) ?? null,
            new_value: (newRecord.new_value as string | null) ?? null,
            metadata: (newRecord.metadata as Json) ?? null,
            created_at: newRecord.created_at as string,
            actor,
          }

          callbacksRef.current.onActivityInsert?.(activity)
        }
      )

    timelineChannelRef.current = channel

    // Only subscribe if visible
    if (isVisibleRef.current) {
      channel.subscribe((status, err) => {
        if (err) {
          console.error(`[Realtime] task-timeline-${taskId} error:`, err)
        }
      })
    }

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
      timelineChannelRef.current = null
    }
  }, [taskId, fetchCommentWithRelations])

  // Channel 2: Reactions -- debounced re-subscribe when commentIds change
  // The debounce prevents channel thrashing when comments are added in rapid succession
  const commentIdsKey = useMemo(() => commentIds.join(","), [commentIds])

  useEffect(() => {
    if (!taskId || commentIds.length === 0) {
      // Clean up any existing reactions channel
      if (reactionsChannelRef.current) {
        const supabase = createClient()
        reactionsChannelRef.current.unsubscribe()
        supabase.removeChannel(reactionsChannelRef.current)
        reactionsChannelRef.current = null
      }
      return
    }

    // Debounce: wait before creating a new channel so rapid comment additions
    // (e.g. bulk insert, typing fast) don't thrash subscriptions
    const timer = setTimeout(() => {
      // Clean up previous reactions channel if any
      const supabase = createClient()
      if (reactionsChannelRef.current) {
        reactionsChannelRef.current.unsubscribe()
        supabase.removeChannel(reactionsChannelRef.current)
        reactionsChannelRef.current = null
      }

      // Use a stable channel name based on taskId only.
      // The filter changes when commentIds change, but the channel name stays
      // the same conceptually. Supabase requires unique channel names, so we
      // append a short hash of commentIds to avoid conflicts with stale channels.
      const channelName = `task-reactions-${taskId}-${commentIds.length}`
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_comment_reactions",
            filter: `comment_id=in.(${commentIdsKey})`,
          },
          (payload) => {
            const reaction = payload.new as TaskCommentReaction | undefined
            if (reaction?.comment_id) {
              callbacksRef.current.onReactionInsert?.(
                reaction.comment_id,
                reaction
              )
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "task_comment_reactions",
            filter: `comment_id=in.(${commentIdsKey})`,
          },
          (payload) => {
            const oldReaction = payload.old as {
              id?: string
              comment_id?: string
            } | undefined
            if (oldReaction?.comment_id && oldReaction?.id) {
              callbacksRef.current.onReactionDelete?.(
                oldReaction.comment_id,
                oldReaction.id
              )
            }
          }
        )

      reactionsChannelRef.current = channel

      // Only subscribe if visible
      if (isVisibleRef.current) {
        channel.subscribe((status, err) => {
          if (err) {
            console.error(`[Realtime] task-reactions-${taskId} error:`, err)
          }
        })
      }
    }, REACTION_CHANNEL_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      // Clean up the channel on unmount or before re-running effect
      if (reactionsChannelRef.current) {
        const supabase = createClient()
        reactionsChannelRef.current.unsubscribe()
        supabase.removeChannel(reactionsChannelRef.current)
        reactionsChannelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, commentIdsKey])
}
