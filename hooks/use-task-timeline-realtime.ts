"use client"

import { useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type {
  TaskCommentWithRelations,
  TaskActivityWithRelations,
  TaskCommentReaction,
} from "@/lib/supabase/types"

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

  const fetchActivityWithRelations = useCallback(
    async (activityId: string): Promise<TaskActivityWithRelations | null> => {
      const supabase = createClient()
      const { data } = await supabase
        .from("task_activities")
        .select(`
          *,
          actor:profiles(id, full_name, email, avatar_url)
        `)
        .eq("id", activityId)
        .single()
      return data as TaskActivityWithRelations | null
    },
    []
  )

  // Stable ref for commentIds to use in the dependency check without
  // triggering the comments/activities channel to rebuild
  const commentIdsRef = useRef(commentIds)
  commentIdsRef.current = commentIds

  // Channel 1: Comments & activities — stable, only depends on taskId
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
          const newRecord = payload.new as { id?: string } | undefined
          if (newRecord?.id) {
            const activity = await fetchActivityWithRelations(newRecord.id)
            if (activity) {
              callbacksRef.current.onActivityInsert?.(activity)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [taskId, fetchCommentWithRelations, fetchActivityWithRelations])

  // Channel 2: Reactions — re-subscribes when commentIds change
  // Serialized to a stable string so the effect only re-runs when the actual IDs change
  const commentIdsKey = commentIds.join(",")

  useEffect(() => {
    if (!taskId || commentIds.length === 0) return

    const supabase = createClient()

    const channel = supabase
      .channel(`task-reactions-${taskId}-${commentIdsKey}`)
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, commentIdsKey])
}
