"use client"

import { useState, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import type { AgentMemoryCard } from "@/lib/actions/memory"
import { getAgentEventHistory, type AgentEventHistoryItem } from "@/lib/actions/sessions"

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

interface MemoryContentLegacyProps {
  cards: AgentMemoryCard[]
  orgId: string
}

export function MemoryContentLegacy({ cards, orgId }: MemoryContentLegacyProps) {
  const [search, setSearch] = useState("")
  const [selectedAgent, setSelectedAgent] = useState<AgentMemoryCard | null>(null)
  const [events, setEvents] = useState<AgentEventHistoryItem[]>([])

  const filtered = search
    ? cards.filter((c) => c.agent.name.toLowerCase().includes(search.toLowerCase()))
    : cards

  const openSheet = useCallback(async (card: AgentMemoryCard) => {
    setSelectedAgent(card)
    const result = await getAgentEventHistory(card.agent.id, orgId)
    if (result.data) setEvents(result.data)
  }, [orgId])

  return (
    <>
      <div className="px-4 py-3 border-b border-border">
        <div className="relative max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filtered.map((card) => (
            <Card
              key={card.agent.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => openSheet(card)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={card.agent.avatar_url ?? undefined} />
                    <AvatarFallback>{card.agent.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{card.agent.name}</span>
                    <p className="text-xs text-muted-foreground">{card.agent.role}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {card.lastEvent?.message ?? "No activity recorded"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {timeAgo(card.lastEvent?.created_at ?? null)}
                </p>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground">
              No agents found
            </div>
          )}
        </div>
      </ScrollArea>

      <Sheet open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedAgent?.agent.name} — Recent Activity</SheetTitle>
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
