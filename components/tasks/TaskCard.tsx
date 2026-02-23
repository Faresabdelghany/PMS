"use client"

import { cn } from "@/lib/utils"
import { Robot, User, Clock } from "@phosphor-icons/react"
import type { OrgTaskWithRelations } from "@/lib/actions/tasks-sprint3"

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-emerald-500",
  "no-priority": "bg-muted-foreground/30",
}

const dispatchBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  dispatched: { label: "Dispatched", className: "bg-blue-500/10 text-blue-400" },
  running: { label: "Running", className: "bg-amber-500/10 text-amber-400 animate-pulse" },
  completed: { label: "Done", className: "bg-emerald-500/10 text-emerald-400" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-400" },
}

const squadColors: Record<string, string> = {
  engineering: "bg-blue-500",
  marketing: "bg-purple-500",
  all: "bg-emerald-500",
}

interface TaskCardProps {
  task: OrgTaskWithRelations
  onClick?: (task: OrgTaskWithRelations) => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const dot = priorityDot[task.priority] ?? priorityDot.low
  const isAgentTask = (task.task_type === "agent") || !!task.assigned_agent_id
  const dispatch = dispatchBadge[task.dispatch_status ?? "pending"] ?? dispatchBadge.pending

  return (
    <div
      className={cn(
        "group relative p-3 rounded-xl border border-border/50 bg-card hover:border-border hover:bg-accent/20 transition-all cursor-pointer select-none",
        task.dispatch_status === "running" && "border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
      )}
      onClick={() => onClick?.(task)}
    >
      {/* Priority dot + dispatch badge */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} />
        {isAgentTask && (
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
              dispatch.className
            )}
          >
            {dispatch.label}
          </span>
        )}
        <div className="flex-1" />
        {task.task_type === "recurring" && (
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted">
            Recurring
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-1">
        {task.name}
      </p>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
          {task.description}
        </p>
      )}

      {/* Footer: assignee + time */}
      <div className="flex items-center gap-2 mt-2">
        {/* Assignee — Agent takes priority */}
        {isAgentTask && task.agent ? (
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0",
                squadColors[task.agent.squad] ?? "bg-slate-500"
              )}
            >
              {task.agent.name.charAt(0)}
            </div>
            <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
              {task.agent.name}
            </span>
          </div>
        ) : task.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-foreground flex-shrink-0">
              {(task.assignee.full_name ?? task.assignee.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
              {task.assignee.full_name ?? task.assignee.email}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border">
              <User size={10} className="text-muted-foreground" />
            </div>
            <span className="text-[11px] text-muted-foreground">Unassigned</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Time ago */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock size={10} />
          <span>{formatTimeAgo(task.updated_at)}</span>
        </div>

        {/* Agent/User indicator icon */}
        {isAgentTask ? (
          <Robot size={12} className="text-purple-400 flex-shrink-0" />
        ) : (
          <User size={12} className="text-muted-foreground/50 flex-shrink-0" />
        )}
      </div>
    </div>
  )
}
