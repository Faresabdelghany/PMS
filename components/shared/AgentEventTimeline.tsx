"use client"

import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { ChatText } from "@phosphor-icons/react/dist/ssr/ChatText"
import { Play } from "@phosphor-icons/react/dist/ssr/Play"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  id: string
  event_type: string
  message: string
  created_at: string
}

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  task_started: Play,
  task_progress: ArrowsClockwise,
  task_completed: CheckCircle,
  task_failed: XCircle,
  agent_message: ChatText,
  status_change: Lightning,
  approval_request: Lightning,
  heartbeat: Lightning,
}

const eventColors: Record<string, string> = {
  task_started: "text-blue-500",
  task_progress: "text-yellow-500",
  task_completed: "text-green-500",
  task_failed: "text-destructive",
  agent_message: "text-muted-foreground",
  status_change: "text-primary",
  approval_request: "text-amber-500",
  heartbeat: "text-muted-foreground/50",
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface AgentEventTimelineProps {
  events: TimelineEvent[]
}

export function AgentEventTimeline({ events }: AgentEventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No events recorded.
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const Icon = eventIcons[event.event_type] ?? Lightning
        const color = eventColors[event.event_type] ?? "text-muted-foreground"
        const isLast = idx === events.length - 1

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn("mt-1 shrink-0", color)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border my-1" />
              )}
            </div>
            <div className={cn("pb-4 min-w-0", isLast && "pb-0")}>
              <p className="text-sm text-foreground leading-snug break-words">
                {event.message}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(event.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
