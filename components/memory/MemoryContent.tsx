"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
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
import { getAgentEventHistory, type AgentEventHistoryItem, type AgentMemoryCard } from "@/lib/actions/memory"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"

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

interface MemoryContentProps {
  initialCards: AgentMemoryCard[]
  orgId: string
}

export function MemoryContent({ initialCards, orgId }: MemoryContentProps) {
  const [search, setSearch] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<AgentMemoryCard | null>(null)
  const [events, setEvents] = useState<AgentEventHistoryItem[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)

  const filtered = search
    ? initialCards.filter((c) =>
        c.agent.name.toLowerCase().includes(search.toLowerCase())
      )
    : initialCards

  const handleCardClick = async (card: AgentMemoryCard) => {
    setSelectedAgent(card)
    setIsLoadingEvents(true)
    const result = await getAgentEventHistory(card.agent.id, orgId)
    setEvents(result.data ?? [])
    setIsLoadingEvents(false)
  }

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Memory">
        <div className="relative max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="pl-9 h-9 text-sm"
          />
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No agents found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((card) => (
              <button
                key={card.agent.id}
                type="button"
                onClick={() => handleCardClick(card)}
                className="text-left rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={card.agent.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {card.agent.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm truncate block">
                      {card.agent.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{card.agent.role}</span>
                  </div>
                </div>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Task:</span>
                    <span className="text-xs font-medium truncate">
                      {card.currentTask ?? "No active task"}
                    </span>
                  </div>
                  {card.lastEvent && (
                    <>
                      <p className="text-xs text-muted-foreground truncate">
                        {card.lastEvent.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {formatRelativeTime(card.lastEvent.created_at)}
                      </p>
                    </>
                  )}
                </div>
              </button>
            ))}
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
