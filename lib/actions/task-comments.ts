"use server"

import { createClient } from "@/lib/supabase/server"
import { after } from "next/server"
import type {
  TaskComment,
  TaskCommentInsert,
  TaskCommentUpdate,
  TaskCommentWithRelations,
  TaskCommentReaction,
  TaskCommentAttachment,
  TaskCommentAttachmentInsert,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth } from "./auth-helpers"
import { notifyMentions } from "./notifications"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { getStoragePublicUrl } from "@/lib/supabase/storage-utils"

// Create a new comment on a task
export async function createTaskComment(
  taskId: string,
  content: string,
  attachmentPaths?: string[]
): Promise<ActionResult<TaskCommentWithRelations>> {
  try {
    const { user, supabase } = await requireAuth()

    if (!content.trim()) {
      return { error: "Comment content is required" }
    }

    // Verify user has access to the task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, name, project_id, projects(organization_id)")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return { error: "Task not found or access denied" }
    }

    // Create the comment
    const commentRecord: TaskCommentInsert = {
      task_id: taskId,
      author_id: user.id,
      content: content.trim(),
    }

    const { data: comment, error } = await supabase
      .from("task_comments")
      .insert(commentRecord)
      .select(`
        *,
        author:profiles(id, full_name, email, avatar_url)
      `)
      .single()

    if (error) {
      return { error: `Failed to create comment: ${error.message}` }
    }

    // If there are attachments, link them to this comment
    if (attachmentPaths && attachmentPaths.length > 0) {
      const attachmentRecords: TaskCommentAttachmentInsert[] = attachmentPaths.map(path => {
        const parts = path.split("/")
        const fileName = parts[parts.length - 1]
        return {
          comment_id: comment.id,
          file_name: fileName,
          file_path: path,
          file_size: 0, // Will be updated by a separate call
          mime_type: "application/octet-stream",
        }
      })

      const { error: attachError } = await supabase.from("task_comment_attachments").insert(attachmentRecords)
      if (attachError) {
        console.error("Failed to insert comment attachments:", attachError.message)
      }
    }

    // Fetch the complete comment with relations
    const { data: fullComment, error: refetchError } = await supabase
      .from("task_comments")
      .select(`
        *,
        author:profiles(id, full_name, email, avatar_url),
        reactions:task_comment_reactions(*),
        attachments:task_comment_attachments(*)
      `)
      .eq("id", comment.id)
      .single()

    if (refetchError || !fullComment) {
      console.error("Failed to refetch comment with relations:", refetchError?.message)
      // Return the original comment with minimal shape rather than failing
      return { data: { ...comment, reactions: [], attachments: [] } as TaskCommentWithRelations }
    }

    revalidateTag(CacheTags.taskTimeline(taskId))
    revalidateTag(CacheTags.taskComments(taskId))

    // Send mention notifications
    const project = task.projects as { organization_id: string } | null
    if (project) {
      after(async () => {
        await notifyMentions({
          orgId: project.organization_id,
          actorId: user.id,
          content,
          contextTitle: task.name,
          projectId: task.project_id,
          taskId,
        })
      })
    }

    return { data: fullComment as TaskCommentWithRelations }
  } catch (error) {
    console.error("Error creating task comment:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Update an existing comment
export async function updateTaskComment(
  commentId: string,
  content: string
): Promise<ActionResult<TaskComment>> {
  try {
    const { user, supabase } = await requireAuth()

    if (!content.trim()) {
      return { error: "Comment content is required" }
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("task_comments")
      .select("id, task_id, author_id")
      .eq("id", commentId)
      .single()

    if (fetchError || !existing) {
      return { error: "Comment not found" }
    }

    if (existing.author_id !== user.id) {
      return { error: "You can only edit your own comments" }
    }

    const updateData: TaskCommentUpdate = {
      content: content.trim(),
    }

    const { data: comment, error } = await supabase
      .from("task_comments")
      .update(updateData)
      .eq("id", commentId)
      .select()
      .single()

    if (error) {
      return { error: `Failed to update comment: ${error.message}` }
    }

    revalidateTag(CacheTags.taskTimeline(existing.task_id))
    revalidateTag(CacheTags.taskComments(existing.task_id))

    return { data: comment }
  } catch (error) {
    console.error("Error updating task comment:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Delete a comment
export async function deleteTaskComment(
  commentId: string
): Promise<ActionResult<void>> {
  try {
    const { user, supabase } = await requireAuth()

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("task_comments")
      .select("id, task_id, author_id")
      .eq("id", commentId)
      .single()

    if (fetchError || !existing) {
      return { error: "Comment not found" }
    }

    if (existing.author_id !== user.id) {
      return { error: "You can only delete your own comments" }
    }

    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId)

    if (error) {
      return { error: `Failed to delete comment: ${error.message}` }
    }

    revalidateTag(CacheTags.taskTimeline(existing.task_id))
    revalidateTag(CacheTags.taskComments(existing.task_id))

    return { data: undefined }
  } catch (error) {
    console.error("Error deleting task comment:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Toggle a reaction on a comment
export async function toggleCommentReaction(
  commentId: string,
  emoji: string
): Promise<ActionResult<{ added: boolean }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Check if reaction already exists
    const { data: existing } = await supabase
      .from("task_comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .single()

    if (existing) {
      // Remove reaction
      const { error } = await supabase
        .from("task_comment_reactions")
        .delete()
        .eq("id", existing.id)

      if (error) {
        return { error: `Failed to remove reaction: ${error.message}` }
      }

      // Get task_id for cache invalidation
      const { data: comment } = await supabase
        .from("task_comments")
        .select("task_id")
        .eq("id", commentId)
        .single()

      if (comment) {
        revalidateTag(CacheTags.taskTimeline(comment.task_id))
      }

      return { data: { added: false } }
    } else {
      // Add reaction
      const { error } = await supabase
        .from("task_comment_reactions")
        .insert({
          comment_id: commentId,
          user_id: user.id,
          emoji,
        })

      if (error) {
        return { error: `Failed to add reaction: ${error.message}` }
      }

      // Get task_id for cache invalidation
      const { data: comment } = await supabase
        .from("task_comments")
        .select("task_id")
        .eq("id", commentId)
        .single()

      if (comment) {
        revalidateTag(CacheTags.taskTimeline(comment.task_id))
      }

      return { data: { added: true } }
    }
  } catch (error) {
    console.error("Error toggling reaction:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Get comments for a task (with reactions and attachments)
export async function getTaskComments(
  taskId: string
): Promise<ActionResult<TaskCommentWithRelations[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data: comments, error } = await supabase
      .from("task_comments")
      .select(`
        *,
        author:profiles(id, full_name, email, avatar_url),
        reactions:task_comment_reactions(*),
        attachments:task_comment_attachments(*)
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })

    if (error) {
      return { error: `Failed to fetch comments: ${error.message}` }
    }

    return { data: comments as TaskCommentWithRelations[] }
  } catch (error) {
    console.error("Error fetching task comments:", error)
    return { error: "An unexpected error occurred" }
  }
}

// Upload a comment attachment
export async function uploadCommentAttachment(
  taskId: string,
  file: {
    name: string
    type: string
    size: number
    arrayBuffer: ArrayBuffer
  }
): Promise<ActionResult<{ path: string; url: string }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Get task's project to get org_id for the storage path
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("project_id, projects(organization_id)")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return { error: "Task not found or access denied" }
    }

    const project = task.projects as { organization_id: string }
    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const storagePath = `${project.organization_id}/${taskId}/${timestamp}_${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from("task-attachments")
      .upload(storagePath, file.arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return { error: `Failed to upload file: ${uploadError.message}` }
    }

    const publicUrl = getStoragePublicUrl(supabase, "task-attachments", storagePath)

    return {
      data: {
        path: storagePath,
        url: publicUrl || "",
      },
    }
  } catch (error) {
    console.error("Error uploading attachment:", error)
    return { error: "An unexpected error occurred" }
  }
}
