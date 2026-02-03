"use client"

import { useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type {
  TaskCommentWithRelations,
  TaskActivityWithRelations,
} from "@/lib/supabase/types"

interface UseTaskTimelineRealtimeCallbacks {
  onCommentInsert?: (comment: TaskCommentWithRelations) => void
  onCommentUpdate?: (comment: TaskCommentWithRelations) => void
  onCommentDelete?: (commentId: string) => void
  onActivityInsert?: (activity: TaskActivityWithRelations) => void
  onReactionChange?: (commentId: string) => void
}

export function useTaskTimelineRealtime(
  taskId: string | null,
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

  useEffect(() => {
    if (!taskId) return

    const supabase = createClient()

    // Subscribe to task_comments changes
    const commentsChannel = supabase
      .channel(`task-comments-${taskId}`)
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
      .subscribe()

    // Subscribe to task_activities changes
    const activitiesChannel = supabase
      .channel(`task-activities-${taskId}`)
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

    // Subscribe to reaction changes
    const reactionsChannel = supabase
      .channel(`task-reactions-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comment_reactions",
        },
        async (payload) => {
          // Get the comment_id from either new or old record
          const newRecord = payload.new as { comment_id?: string } | undefined
          const oldRecord = payload.old as { comment_id?: string } | undefined
          const commentId = newRecord?.comment_id || oldRecord?.comment_id
          if (commentId) {
            // Refetch the comment to get updated reactions
            const comment = await fetchCommentWithRelations(commentId)
            if (comment) {
              callbacksRef.current.onCommentUpdate?.(comment)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(activitiesChannel)
      supabase.removeChannel(reactionsChannel)
    }
  }, [taskId, fetchCommentWithRelations, fetchActivityWithRelations])
}
