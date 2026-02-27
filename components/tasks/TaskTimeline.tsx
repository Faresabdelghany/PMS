"use client"

import { Robot, ClockClockwise } from "@phosphor-icons/react"
import { TaskCommentItem } from "./TaskCommentItem"
import { TaskActivityItem } from "./TaskActivityItem"
import { cn } from "@/lib/utils"
import type { TaskTimelineItem } from "@/lib/supabase/types"

interface TaskTimelineProps {
  items: TaskTimelineItem[]
  currentUserId?: string
  onReactionToggle?: (commentId: string, emoji: string) => Promise<void>
  onEditComment?: (commentId: string, content: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
}

function AgentEventItem({ item }: { item: Extract<TaskTimelineItem, { type: "agent_event" }> }) {
  const agentName = item.data.agent?.name ?? "Agent"
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-start gap-2">
        <Robot size={16} className="mt-0.5 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground/90">
            <span className="font-medium">{agentName}</span>
            <span className="text-muted-foreground"> • {item.data.event_type}</span>
          </p>
          <p className="text-sm text-foreground/80 mt-1">{item.data.message}</p>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <ClockClockwise size={12} />
            {new Date(item.data.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

export function TaskTimeline({
  items,
  currentUserId,
  onReactionToggle,
  onEditComment,
  onDeleteComment,
}: TaskTimelineProps) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8">No activity yet. Be the first to comment!</div>
  }

  return (
    <div className={cn("space-y-4")}>
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
        }

        if (item.type === "agent_event") {
          return <AgentEventItem key={`agent-event-${item.data.id}`} item={item} />
        }

        return <TaskActivityItem key={`activity-${item.data.id}`} activity={item.data} />
      })}
    </div>
  )
}
