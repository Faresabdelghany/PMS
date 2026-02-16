"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TaskDetailHeader } from "./TaskDetailHeader"
import { TaskDetailFields } from "./TaskDetailFields"
import { TaskDetailDescription } from "./TaskDetailDescription"
import { TaskTimeline } from "./TaskTimeline"
import { TaskCommentEditor } from "./TaskCommentEditor"
import { Skeleton } from "@/components/ui/skeleton"
import { getTask, updateTask, type TaskWithRelations } from "@/lib/actions/tasks"
import { getTaskTimeline } from "@/lib/actions/task-activities"
import { createTaskComment } from "@/lib/actions/task-comments"
import type {
  TaskTimelineItem,
  TaskCommentWithRelations,
  TaskCommentReaction,
  Workstream,
  OrganizationTagLean,
} from "@/lib/supabase/types"
import { toast } from "sonner"
import { useTaskTimelineRealtime } from "@/hooks/use-task-timeline-realtime"

export type TaskPanelMember = {
  user_id: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

function addReactionToItem(
  item: TaskTimelineItem,
  commentId: string,
  reaction: TaskCommentReaction
): TaskTimelineItem {
  if (item.type !== "comment" || item.data.id !== commentId) return item
  const comment = item.data as TaskCommentWithRelations
  const existing = comment.reactions ?? []
  if (existing.some((r) => r.id === reaction.id)) return item
  return { type: "comment" as const, data: { ...comment, reactions: [...existing, reaction] } }
}

function removeReactionFromItem(
  item: TaskTimelineItem,
  commentId: string,
  reactionId: string
): TaskTimelineItem {
  if (item.type !== "comment" || item.data.id !== commentId) return item
  const comment = item.data as TaskCommentWithRelations
  const filtered = (comment.reactions ?? []).filter((r) => r.id !== reactionId)
  return { type: "comment" as const, data: { ...comment, reactions: filtered } }
}

interface TaskDetailPanelProps {
  projectId: string
  organizationId: string
  organizationMembers?: TaskPanelMember[]
  workstreams?: Workstream[]
  tags?: OrganizationTagLean[]
}

export function TaskDetailPanel({
  projectId,
  organizationId,
  organizationMembers = [],
  workstreams = [],
  tags = [],
}: TaskDetailPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskId = searchParams.get("task")

  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [timeline, setTimeline] = useState<TaskTimelineItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOpen = !!taskId

  // Fetch task data when taskId changes
  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setTimeline([])
      return
    }

    const currentTaskId = taskId

    async function fetchTaskData() {
      setIsLoading(true)
      try {
        const [taskResult, timelineResult] = await Promise.all([
          getTask(currentTaskId),
          getTaskTimeline(currentTaskId),
        ])

        if (taskResult.error) {
          toast.error(taskResult.error)
          return
        }

        if (taskResult.data) {
          setTask(taskResult.data)
        }

        if (timelineResult.data) {
          setTimeline(timelineResult.data)
        }
      } catch {
        toast.error("Failed to load task details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTaskData()
  }, [taskId])

  // Derive comment IDs from timeline so the reaction subscription
  // only listens to reactions on this task's comments
  const commentIds = useMemo(
    () => timeline.filter((item) => item.type === "comment").map((item) => item.data.id),
    [timeline]
  )

  // Real-time updates for timeline
  useTaskTimelineRealtime(taskId, commentIds, {
    onCommentInsert: (comment) => {
      setTimeline((prev) => {
        if (prev.some((item) => item.type === "comment" && item.data.id === comment.id)) {
          return prev
        }
        return [...prev, { type: "comment", data: comment }]
      })
    },
    onCommentUpdate: (comment) => {
      setTimeline((prev) =>
        prev.map((item) =>
          item.type === "comment" && item.data.id === comment.id
            ? { type: "comment", data: comment }
            : item
        )
      )
    },
    onCommentDelete: (commentId) => {
      setTimeline((prev) =>
        prev.filter(
          (item) => !(item.type === "comment" && item.data.id === commentId)
        )
      )
    },
    onActivityInsert: (activity) => {
      setTimeline((prev) => {
        if (prev.some((item) => item.type === "activity" && item.data.id === activity.id)) {
          return prev
        }
        return [...prev, { type: "activity", data: activity }]
      })
    },
    onReactionInsert: (commentId, reaction) => {
      setTimeline((prev) => prev.map((item) => addReactionToItem(item, commentId, reaction)))
    },
    onReactionDelete: (commentId, reactionId) => {
      setTimeline((prev) => prev.map((item) => removeReactionFromItem(item, commentId, reactionId)))
    },
  })

  // Close panel handler
  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("task")
    const newPath = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    router.push(newPath, { scroll: false })
  }, [router, searchParams])

  // Escape key is handled by the Sheet (Radix Dialog) component's built-in
  // onOpenChange callback — no need for a manual window keydown listener.

  // Update task field handler
  const handleUpdateTask = useCallback(
    async (field: string, value: unknown) => {
      if (!taskId || !task) return

      const result = await updateTask(taskId, { [field]: value })
      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        setTask((prev) => (prev ? { ...prev, ...result.data } : prev))
        toast.success("Task updated")
      }
    },
    [taskId, task]
  )

  // Handle comment submission
  const handleSubmitComment = useCallback(
    async (content: string, attachments?: string[]) => {
      if (!taskId) return

      setIsSubmitting(true)
      try {
        const result = await createTaskComment(taskId, content, attachments)
        if (result.error) {
          toast.error(result.error)
          return
        }

        const newComment = result.data
        if (newComment) {
          setTimeline((prev) => {
            if (prev.some((item) => item.type === "comment" && item.data.id === newComment.id)) {
              return prev
            }
            return [...prev, { type: "comment" as const, data: newComment }]
          })
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [taskId]
  )

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[600px] lg:w-[700px] sm:max-w-none p-0 flex flex-col sm:rounded-l-[32px] overflow-hidden"
        aria-describedby={undefined}
      >
        {/* Always render SheetTitle for accessibility */}
        <SheetTitle className="sr-only">
          {task?.name || "Task Details"}
        </SheetTitle>
        {isLoading && <TaskDetailPanelSkeleton />}
        {!isLoading && !task && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Task not found
          </div>
        )}
        {!isLoading && task && (
          <>
            <div className="px-5 pt-4 pb-3 space-y-2 flex-shrink-0">
              <TaskDetailHeader
                task={task}
                onNameChange={(name) => handleUpdateTask("name", name)}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-0 sm:pt-4 space-y-8">
              {/* Task Fields */}
              <TaskDetailFields
                task={task}
                onUpdate={handleUpdateTask}
                organizationMembers={organizationMembers}
                workstreams={workstreams}
                tags={tags}
              />

              {/* Description */}
              <TaskDetailDescription
                description={task.description}
                onSave={(desc) => handleUpdateTask("description", desc)}
                taskName={task.name}
                projectName={task.project?.name}
              />

              <div className="h-px w-full bg-border/80" />

              {/* Timeline */}
              <div className="space-y-3 pt-1">
                <h3 className="text-sm font-medium text-foreground">Activity</h3>
                <TaskTimeline
                  items={timeline}
                  currentUserId={organizationMembers.find(m => m.profile)?.profile?.id}
                  onReactionToggle={async (commentId, emoji) => {
                    const { toggleCommentReaction } = await import("@/lib/actions/task-comments")
                    const result = await toggleCommentReaction(commentId, emoji)
                    if (result.error) {
                      toast.error(result.error)
                    }
                  }}
                />
              </div>

              {/* Comment Editor */}
              <div className="pb-4">
                <TaskCommentEditor
                  onSubmit={handleSubmitComment}
                  isSubmitting={isSubmitting}
                  organizationMembers={organizationMembers}
                  taskId={taskId!}
                />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function TaskDetailPanelSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-32" />
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}
