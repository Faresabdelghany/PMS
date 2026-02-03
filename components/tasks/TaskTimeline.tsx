"use client"

import { TaskCommentItem } from "./TaskCommentItem"
import { TaskActivityItem } from "./TaskActivityItem"
import type { TaskTimelineItem } from "@/lib/supabase/types"

interface TaskTimelineProps {
  items: TaskTimelineItem[]
  currentUserId?: string
  onReactionToggle?: (commentId: string, emoji: string) => Promise<void>
  onEditComment?: (commentId: string, content: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
}

export function TaskTimeline({
  items,
  currentUserId,
  onReactionToggle,
  onEditComment,
  onDeleteComment,
}: TaskTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No activity yet. Be the first to comment!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        if (item.type === "comment") {
          return (
            <TaskCommentItem
              key={`comment-${item.data.id}`}
              comment={item.data}
              currentUserId={currentUserId}
              onReactionToggle={onReactionToggle}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
            />
          )
        } else {
          return (
            <TaskActivityItem
              key={`activity-${item.data.id}`}
              activity={item.data}
            />
          )
        }
      })}
    </div>
  )
}
