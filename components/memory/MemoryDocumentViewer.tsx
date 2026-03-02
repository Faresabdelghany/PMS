"use client"

import { useMemo } from "react"
import { FileText, Clock, Loader2 } from "lucide-react"
import { Brain } from "@phosphor-icons/react/dist/ssr/Brain"
import { cn } from "@/lib/utils"
import type { MemoryJournalEvent, MemoryLongTermSummary } from "@/lib/actions/memory"

type ViewMode = "journal" | "long-term" | "search" | "empty"

interface MemoryDocumentViewerProps {
  mode: ViewMode
  journalDate?: string
  events: MemoryJournalEvent[]
  longTermSummary?: MemoryLongTermSummary
  isLoading: boolean
  searchQuery?: string
}

// ── Event type colors (matching AgentEventTimeline) ───────────────────
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

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatHourKey(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function extractTitle(message: string): { title: string; body: string } {
  // Try splitting on " — " or " - " or ": "
  const separators = [" — ", " - ", ": "]
  for (const sep of separators) {
    const idx = message.indexOf(sep)
    if (idx > 0 && idx < 60) {
      return {
        title: message.slice(0, idx),
        body: message.slice(idx + sep.length),
      }
    }
  }
  // Fallback: first 50 chars
  if (message.length > 50) {
    return { title: message.slice(0, 50) + "…", body: message }
  }
  return { title: message, body: "" }
}

function computeStats(events: MemoryJournalEvent[]) {
  let wordCount = 0
  let byteSize = 0
  for (const e of events) {
    wordCount += (e.message ?? "").split(/\s+/).filter(Boolean).length
    byteSize += new TextEncoder().encode(e.message ?? "").length
  }
  return { wordCount, byteSize }
}

interface HourGroup {
  hourLabel: string
  events: MemoryJournalEvent[]
}

function groupByHour(events: MemoryJournalEvent[]): HourGroup[] {
  const groups = new Map<string, MemoryJournalEvent[]>()
  const order: string[] = []

  for (const event of events) {
    const d = new Date(event.created_at)
    const key = `${d.getHours()}:${Math.floor(d.getMinutes() / 10)}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(event)
  }

  return order.map((key) => {
    const evts = groups.get(key)!
    return {
      hourLabel: formatHourKey(evts[0].created_at),
      events: evts,
    }
  })
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200/60 dark:bg-yellow-500/30 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────

export function MemoryDocumentViewer({
  mode,
  journalDate,
  events,
  longTermSummary,
  isLoading,
  searchQuery,
}: MemoryDocumentViewerProps) {
  const hourGroups = useMemo(
    () => (mode === "journal" ? groupByHour(events) : []),
    [mode, events]
  )

  const stats = useMemo(() => computeStats(events), [events])

  const uniqueAgents = useMemo(() => {
    const names = new Set(events.map((e) => e.agent.name))
    return names.size
  }, [events])

  // ── Empty state ──
  if (mode === "empty") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select a journal to view</p>
        </div>
      </div>
    )
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Long-Term Memory view ──
  if (mode === "long-term" && longTermSummary) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <Brain className="h-6 w-6 text-primary mt-0.5" weight="duotone" />
            <div>
              <h2 className="text-lg font-semibold">Long-Term Memory</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Aggregate overview of all recorded agent events
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-border p-4">
              <p className="text-2xl font-semibold">{longTermSummary.totalEvents.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Events</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-2xl font-semibold">{longTermSummary.totalWordCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Words</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">
                {longTermSummary.oldestEventDate
                  ? new Date(longTermSummary.oldestEventDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Earliest Record</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">
                {formatRelativeDate(longTermSummary.lastUpdated)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Last Updated</p>
            </div>
          </div>

          {/* Recent events preview */}
          {events.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Recent Events</h3>
              <div className="space-y-2">
                {events.slice(0, 10).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs font-medium", eventColors[event.event_type] ?? "text-muted-foreground")}>
                        {event.event_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground">&middot; {event.agent.name}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed break-words">
                      {event.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Search results view ──
  if (mode === "search") {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Search Results</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {events.length} result{events.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </p>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No matching events found.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-medium", eventColors[event.event_type] ?? "text-muted-foreground")}>
                      {event.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">&middot; {event.agent.name}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed break-words">
                    {highlightMatch(event.message, searchQuery ?? "")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Journal view ──
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold">
                Journal: {journalDate}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatFullDate(journalDate!)} &middot;{" "}
                {formatBytes(stats.byteSize)} &middot;{" "}
                {stats.wordCount.toLocaleString()} words
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Events grouped by hour */}
        {events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No events for this date.
          </div>
        ) : (
          <div className="space-y-6">
            {hourGroups.map((group, groupIdx) => (
              <div key={group.hourLabel + groupIdx}>
                {/* Hour separator */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {group.hourLabel}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Events in this hour */}
                <div className="space-y-3">
                  {group.events.map((event) => {
                    const { title, body } = extractTitle(event.message)
                    const color = eventColors[event.event_type] ?? "text-muted-foreground"

                    return (
                      <div
                        key={event.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">
                            {formatTime(event.created_at)}
                          </span>
                          <span className={cn("text-xs font-medium", color)}>
                            {event.event_type.replace(/_/g, " ")}
                          </span>
                          {uniqueAgents > 1 && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {event.agent.name}
                            </span>
                          )}
                        </div>
                        {body ? (
                          <>
                            <p className="text-sm font-medium text-foreground mb-1">
                              {title}
                            </p>
                            <p className="text-sm text-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
                              {body}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">
                            {title}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
