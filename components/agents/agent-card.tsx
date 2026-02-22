"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentWithSupervisor, AgentType, AgentStatus, AgentSquad } from "@/lib/supabase/types"

// ── Status styling ──────────────────────────────────────────────────

const statusConfig: Record<AgentStatus, { label: string; dot: string; badge: string }> = {
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
  busy: {
    label: "Busy",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100",
  },
  idle: {
    label: "Idle",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-100",
  },
  offline: {
    label: "Offline",
    dot: "bg-zinc-400",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-600/30 dark:text-zinc-200",
  },
}

const typeLabels: Record<AgentType, string> = {
  supreme: "Supreme",
  lead: "Lead",
  specialist: "Specialist",
  integration: "Integration",
}

const typeBadgeColors: Record<AgentType, string> = {
  supreme: "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-100",
  lead: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-100",
  specialist: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100",
  integration: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-100",
}

const squadLabels: Record<AgentSquad, string> = {
  engineering: "Engineering",
  marketing: "Marketing",
  all: "All",
}

function formatLastActive(date: string | null): string {
  if (!date) return "Never"
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

interface AgentCardProps {
  agent: AgentWithSupervisor
  onClick?: () => void
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const status = statusConfig[agent.status]
  const typeColor = typeBadgeColors[agent.agent_type]

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-border/80",
        "group relative"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-start gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                status.dot
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>

        {/* Badges row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium", typeColor)}
          >
            {typeLabels[agent.agent_type]}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-transparent bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {squadLabels[agent.squad]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium",
              status.badge
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </Badge>
        </div>

        {/* Footer: model + last active */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate max-w-[60%]">
            {agent.ai_model || "No model"}
          </span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {formatLastActive(agent.last_active_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
