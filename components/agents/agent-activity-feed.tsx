"use client"

import {
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  RefreshCw,
  Cpu,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentActivityRow } from "@/lib/supabase/types"

const activityIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  task_completed: { icon: CheckCircle2, color: "text-emerald-500" },
  task_assigned: { icon: ClipboardList, color: "text-blue-500" },
  message: { icon: MessageSquare, color: "text-indigo-500" },
  status_change: { icon: RefreshCw, color: "text-amber-500" },
  model_change: { icon: Cpu, color: "text-purple-500" },
  error: { icon: AlertTriangle, color: "text-destructive" },
}

function formatActivityTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface AgentActivityFeedProps {
  activities: AgentActivityRow[]
}

export function AgentActivityFeed({ activities }: AgentActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {activities.map((activity) => {
        const config = activityIcons[activity.activity_type] ?? activityIcons.message
        const Icon = config.icon

        return (
          <div key={activity.id} className="relative flex gap-3 py-2">
            {/* Icon */}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border border-border">
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium leading-tight">{activity.title}</p>
              {activity.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {activity.description}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatActivityTime(activity.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
