"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PageHeader } from "@/components/ui/page-header"
import { AgentEventTimeline } from "@/components/shared/AgentEventTimeline"
import { getAgentEventHistory, type AgentEventHistoryItem } from "@/lib/actions/sessions"
import type { AgentSession, AgentSessionStatus } from "@/lib/actions/sessions"
import { cn } from "@/lib/utils"

const statusConfig: Record<AgentSessionStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-green-500", dot: "bg-green-500" },
  idle: { label: "Idle", color: "text-yellow-500", dot: "bg-yellow-500" },
  offline: { label: "Offline", color: "text-muted-foreground", dot: "bg-muted-foreground/50" },
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

interface SessionsContentProps {
  initialSessions: AgentSession[]
  orgId: string
}

export function SessionsContent({ initialSessions, orgId }: SessionsContentProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<AgentSessionStatus | "all">("all")
  const [selectedAgent, setSelectedAgent] = useState<AgentSession | null>(null)
  const [events, setEvents] = useState<AgentEventHistoryItem[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000)
    return () => clearInterval(interval)
  }, [router])

  const filtered =
    filter === "all"
      ? initialSessions
      : initialSessions.filter((s) => s.status === filter)

  const handleCardClick = async (session: AgentSession) => {
    setSelectedAgent(session)
    setIsLoadingEvents(true)
    const result = await getAgentEventHistory(session.agent.id, orgId)
    setEvents(result.data ?? [])
    setIsLoadingEvents(false)
  }

  const counts = {
    all: initialSessions.length,
    active: initialSessions.filter((s) => s.status === "active").length,
    idle: initialSessions.filter((s) => s.status === "idle").length,
    offline: initialSessions.filter((s) => s.status === "offline").length,
  }

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Sessions">
        <div className="flex items-center gap-2">
          {(["all", "active", "idle", "offline"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === "all" ? "All" : statusConfig[f].label} ({counts[f]})
            </Button>
          ))}
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No agents found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((session) => {
              const sc = statusConfig[session.status]
              return (
                <button
                  key={session.agent.id}
                  type="button"
                  onClick={() => handleCardClick(session)}
                  className="text-left rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.agent.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {session.agent.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {session.agent.name}
                        </span>
                        <span className={cn("h-2 w-2 rounded-full shrink-0", sc.dot)} />
                      </div>
                      <span className="text-xs text-muted-foreground">{session.agent.role}</span>
                    </div>
                    <Badge variant="outline" className={cn("text-xs shrink-0", sc.color)}>
                      {sc.label}
                    </Badge>
                  </div>
                  {session.lastEvent && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground truncate">
                        {session.lastEvent.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {formatRelativeTime(session.lastEvent.created_at)}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Sheet
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
      >
        <SheetContent className="sm:max-w-md overflow-auto">
          {selectedAgent && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedAgent.agent.name}
                  <Badge variant="outline" className="text-xs font-normal">
                    {selectedAgent.agent.role}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                {isLoadingEvents ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading events…
                  </div>
                ) : (
                  <AgentEventTimeline events={events} />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
