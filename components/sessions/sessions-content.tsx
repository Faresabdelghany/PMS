"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  type AgentSession,
  type AgentSessionStatus,
  type AgentEventHistoryItem,
  getAgentSessions,
  getAgentEventHistory,
} from "@/lib/actions/sessions"

function StatusBadge({ status }: { status: AgentSessionStatus }) {
  const variant = status === "active" ? "default" : status === "idle" ? "secondary" : "outline"
  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface SessionsContentLegacyProps {
  initialSessions: AgentSession[]
  orgId: string
}

export function SessionsContentLegacy({ initialSessions, orgId }: SessionsContentLegacyProps) {
  const [sessions, setSessions] = useState(initialSessions)
  const [filter, setFilter] = useState<"all" | AgentSessionStatus>("all")
  const [selectedAgent, setSelectedAgent] = useState<AgentSession | null>(null)
  const [events, setEvents] = useState<AgentEventHistoryItem[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(async () => {
        const result = await getAgentSessions(orgId)
        if (result.data) setSessions(result.data)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [orgId])

  const openSheet = useCallback(async (agent: AgentSession) => {
    setSelectedAgent(agent)
    const result = await getAgentEventHistory(agent.agent.id, orgId)
    if (result.data) setEvents(result.data)
  }, [orgId])

  const filtered = filter === "all" ? sessions : sessions.filter((s) => s.status === filter)
  const counts = {
    all: sessions.length,
    active: sessions.filter((s) => s.status === "active").length,
    idle: sessions.filter((s) => s.status === "idle").length,
    offline: sessions.filter((s) => s.status === "offline").length,
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-border">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="idle">Idle ({counts.idle})</TabsTrigger>
            <TabsTrigger value="offline">Offline ({counts.offline})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {filtered.map((session) => (
            <button
              key={session.agent.id}
              type="button"
              className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              onClick={() => openSheet(session)}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={session.agent.avatar_url ?? undefined} />
                <AvatarFallback>{session.agent.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{session.agent.name}</span>
                  <StatusBadge status={session.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {session.lastEvent?.message ?? "No activity"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo(session.lastEvent?.created_at ?? null)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No agents found</div>
          )}
        </div>
      </ScrollArea>

      <Sheet open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedAgent?.agent.name} — Recent Events</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-8rem)]">
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{ev.event_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{ev.message}</p>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No events</p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
