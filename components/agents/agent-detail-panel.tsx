"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AgentActivityFeed } from "./agent-activity-feed"
import { Bot, Clock, Cpu, Shield, GitBranch, Users, Star, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAgent } from "@/lib/actions/agents"
import { getAgentActivities } from "@/lib/actions/agents"
import { toast } from "sonner"
import type {
  AgentWithSupervisor,
  AgentActivityRow,
  AgentType,
  AgentStatus,
  AgentSquad,
} from "@/lib/supabase/types"

// ── Status styling ──────────────────────────────────────────────────

const statusConfig: Record<AgentStatus, { label: string; dot: string; badge: string }> = {
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    badge: "bg-teal-50 text-teal-700 border-transparent dark:bg-teal-500/15 dark:text-teal-100",
  },
  busy: {
    label: "Busy",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-100",
  },
  idle: {
    label: "Idle",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border-transparent dark:bg-blue-500/15 dark:text-blue-100",
  },
  offline: {
    label: "Offline",
    dot: "bg-zinc-400",
    badge: "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-600/30 dark:text-slate-200",
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

export function AgentDetailPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = searchParams.get("agent")

  const [agent, setAgent] = useState<AgentWithSupervisor | null>(null)
  const [activities, setActivities] = useState<AgentActivityRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const isOpen = !!agentId

  useEffect(() => {
    if (!agentId) {
      setAgent(null)
      setActivities([])
      return
    }

    const currentId = agentId

    async function fetchData() {
      setIsLoading(true)
      try {
        const [agentResult, activitiesResult] = await Promise.all([
          getAgent(currentId),
          getAgentActivities(currentId),
        ])

        if (agentResult.error) {
          toast.error(agentResult.error)
          return
        }
        if (agentResult.data) setAgent(agentResult.data)
        if (activitiesResult.data) setActivities(activitiesResult.data)
      } catch {
        toast.error("Failed to load agent details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [agentId])

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("agent")
    const newPath = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    router.push(newPath, { scroll: false })
  }, [router, searchParams])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[600px] lg:w-[700px] sm:max-w-none p-0 flex flex-col sm:rounded-l-[32px] overflow-hidden"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">
          {agent?.name || "Agent Details"}
        </SheetTitle>

        {isLoading && <AgentDetailPanelSkeleton />}

        {!isLoading && !agent && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Agent not found
          </div>
        )}

        {!isLoading && agent && (
          <>
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex-shrink-0 border-b border-border/60 space-y-2">
              <div className="flex items-start gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                      statusConfig[agent.status].dot
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold truncate">{agent.name}</h2>
                  <p className="text-sm text-muted-foreground truncate">{agent.role}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border-transparent px-2 py-0.5 text-[10px] font-medium",
                    typeBadgeColors[agent.agent_type]
                  )}
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
                    statusConfig[agent.status].badge
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig[agent.status].dot)} />
                  {statusConfig[agent.status].label}
                </Badge>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4 space-y-5">
              {/* Description */}
              {agent.description && (
                <div className="space-y-1.5">
                  <h3 className="text-sm font-medium text-foreground">Description</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
                </div>
              )}

              {/* Details — icon-in-circle grid matching TaskDetailFields */}
              <div className="rounded-2xl border border-border bg-card/80 px-5 py-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <DetailField
                    icon={Cpu}
                    label="AI Model"
                    value={agent.ai_model || "Not configured"}
                  />
                  <DetailField
                    icon={Shield}
                    label="Provider"
                    value={agent.ai_provider || "None"}
                  />
                  <DetailField
                    icon={Circle}
                    label="Status"
                    value={statusConfig[agent.status].label}
                    renderIcon={() => (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <span className={cn("w-2.5 h-2.5 rounded-full", statusConfig[agent.status].dot)} />
                      </div>
                    )}
                  />
                  <DetailField
                    icon={Users}
                    label="Squad"
                    value={squadLabels[agent.squad]}
                  />
                  <DetailField
                    icon={Star}
                    label="Type"
                    value={typeLabels[agent.agent_type]}
                  />
                  <DetailField
                    icon={GitBranch}
                    label="Reports To"
                    value={agent.supervisor?.name || "None"}
                  />
                  <DetailField
                    icon={Clock}
                    label="Last Active"
                    value={formatLastActive(agent.last_active_at)}
                  />
                </div>
              </div>

              {/* Capabilities */}
              {agent.capabilities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Capabilities</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className="rounded-full text-[11px] font-normal"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px w-full bg-border/80" />

              {/* Activity Feed */}
              <div className="space-y-3 pt-1">
                <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
                <AgentActivityFeed activities={activities} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Field component matching TaskDetailFields icon-in-circle pattern ──

function DetailField({
  icon: Icon,
  label,
  value,
  renderIcon,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  renderIcon?: () => React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2 min-w-0">
      {renderIcon ? (
        renderIcon()
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-0.5 min-w-0 w-full">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

function AgentDetailPanelSkeleton() {
  return (
    <div className="p-5 space-y-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="rounded-2xl border border-border p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 pt-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}
