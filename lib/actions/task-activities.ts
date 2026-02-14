"use server"

import { createClient } from "@/lib/supabase/server"
import type {
  TaskActivity,
  TaskActivityInsert,
  TaskActivityWithRelations,
  TaskActivityAction,
  TaskCommentWithRelations,
  TaskTimelineItem,
  Json,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth } from "./auth-helpers"
import { invalidateCache } from "@/lib/cache"
import { logger } from "@/lib/logger"

// Create a task activity record (called internally by task update actions)
export async function createTaskActivity(
  taskId: string,
  action: TaskActivityAction,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: Record<string, unknown>
): Promise<ActionResult<TaskActivity>> {
  try {
    const { user, supabase } = await requireAuth()

    const activityRecord: TaskActivityInsert = {
      task_id: taskId,
      actor_id: user.id,
      action,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      metadata: metadata ? (metadata as Json) : null,
    }

    const { data: activity, error } = await supabase
      .from("task_activities")
      .insert(activityRecord)
      .select()
      .single()

    if (error) {
      return { error: `Failed to create activity: ${error.message}` }
    }

    invalidateCache.taskTimeline({ taskId })

    return { data: activity }
  } catch (error) {
    logger.error("Error creating task activity", { module: "task-activities", error })
    return { error: "An unexpected error occurred" }
  }
}

// Get activities for a task
export async function getTaskActivities(
  taskId: string
): Promise<ActionResult<TaskActivityWithRelations[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data: activities, error } = await supabase
      .from("task_activities")
      .select(`
        *,
        actor:profiles(id, full_name, email, avatar_url)
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })

    if (error) {
      return { error: `Failed to fetch activities: ${error.message}` }
    }

    return { data: activities as TaskActivityWithRelations[] }
  } catch (error) {
    logger.error("Error fetching task activities", { module: "task-activities", error })
    return { error: "An unexpected error occurred" }
  }
}

// Get the combined timeline (comments + activities) for a task
export async function getTaskTimeline(
  taskId: string
): Promise<ActionResult<TaskTimelineItem[]>> {
  try {
    const { supabase } = await requireAuth()

    // Fetch comments and activities in parallel
    const [commentsResult, activitiesResult] = await Promise.all([
      supabase
        .from("task_comments")
        .select(`
          *,
          author:profiles(id, full_name, email, avatar_url),
          reactions:task_comment_reactions(*, user:profiles(id, full_name, avatar_url)),
          attachments:task_comment_attachments(*)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true }),
      supabase
        .from("task_activities")
        .select(`
          *,
          actor:profiles(id, full_name, email, avatar_url)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true }),
    ])

    if (commentsResult.error) {
      return { error: `Failed to fetch comments: ${commentsResult.error.message}` }
    }

    if (activitiesResult.error) {
      return { error: `Failed to fetch activities: ${activitiesResult.error.message}` }
    }

    // Merge and sort by created_at
    const timeline: TaskTimelineItem[] = [
      ...(commentsResult.data || []).map(comment => ({
        type: "comment" as const,
        data: comment as TaskCommentWithRelations,
      })),
      ...(activitiesResult.data || []).map(activity => ({
        type: "activity" as const,
        data: activity as TaskActivityWithRelations,
      })),
    ].sort((a, b) => {
      const aTime = new Date(a.data.created_at).getTime()
      const bTime = new Date(b.data.created_at).getTime()
      return aTime - bTime
    })

    return { data: timeline }
  } catch (error) {
    logger.error("Error fetching task timeline", { module: "task-activities", error })
    return { error: "An unexpected error occurred" }
  }
}
