"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle, ArrowsClockwise, Warning, Info, ChatCircle, Heartbeat } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { AgentEventWithAgent } from "@/lib/actions/agent-events"

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

const squadColors: Record<string, string> = {
  engineering: "bg-blue-500",
  marketing: "bg-purple-500",
  all: "bg-emerald-500",
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "task_completed":
      return { Icon: CheckCircle, className: "text-emerald-400" }
    case "task_started":
      return { Icon: ArrowsClockwise, className: "text-blue-400" }
    case "task_failed":
      return { Icon: Warning, className: "text-red-400" }
    case "approval_request":
      return { Icon: Info, className: "text-amber-400" }
    case "agent_message":
      return { Icon: ChatCircle, className: "text-indigo-400" }
    case "heartbeat":
      return { Icon: Heartbeat, className: "text-muted-foreground" }
    default:
      return { Icon: Info, className: "text-muted-foreground" }
  }
}

interface LiveActivityFeedProps {
  orgId: string
  initialEvents: AgentEventWithAgent[]
  agents?: Array<{
    id: string
    name: string
    role: string
    squad: string
    avatar_url: string | null
    status: string
  }>
}

export function LiveActivityFeed({ orgId, initialEvents, agents = [] }: LiveActivityFeedProps) {
  const [events, setEvents] = useState<AgentEventWithAgent[]>(initialEvents)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`agent_events:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_events",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const rawEvent = payload.new as AgentEventWithAgent
          // Real-time payloads don't include joined agent data — look up from agents prop
          const matchedAgent = rawEvent.agent_id
            ? agents.find((a) => a.id === rawEvent.agent_id) ?? null
            : null
          const newEvent: AgentEventWithAgent = {
            ...rawEvent,
            agent: matchedAgent
              ? {
                  id: matchedAgent.id,
                  name: matchedAgent.name,
                  role: matchedAgent.role,
                  squad: matchedAgent.squad,
                  avatar_url: matchedAgent.avatar_url,
                }
              : rawEvent.agent,
          }
          setEvents((prev) => [newEvent, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, supabase, agents])

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Heartbeat size={32} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Waiting for agent activity...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Dispatch a task to see live updates</p>
          </div>
        ) : (
          events.map((event) => {
            const { Icon, className: iconCls } = getEventIcon(event.event_type)
            const agentName = event.agent?.name ?? "Agent"
            const squadColor = event.agent?.squad
              ? (squadColors[event.agent.squad] ?? "bg-slate-500")
              : "bg-slate-500"
            const initials = agentName.charAt(0).toUpperCase()

            return (
              <div
                key={event.id}
                className="flex gap-2.5 p-2.5 rounded-lg hover:bg-accent/30 transition-colors group"
              >
                {/* Agent Avatar */}
                <div
                  className={cn(
                    "relative flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white",
                    squadColor
                  )}
                >
                  {initials}
                  {/* Event type indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-[1px]">
                    <Icon size={10} className={iconCls} weight="fill" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{agentName}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTimeAgo(event.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
                    {event.message}
                  </p>
                  {event.task && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                      ↳ {event.task.name}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
