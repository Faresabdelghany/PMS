"use client"

import { useMemo, type ReactNode } from "react"
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

// ── Helpers ───────────────────────────────────────────────────────────

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z")
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatRelativeModified(dateStr: string | null): string {
  if (!dateStr) return ""
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Modified just now"
  if (mins < 60) return `Modified ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Modified about ${hours} hour${hours !== 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Modified ${days} day${days !== 1 ? "s" : ""} ago`
  const months = Math.floor(days / 30)
  return `Modified ${months}mo ago`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
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
  const separators = [" — ", " - ", ": "]
  for (const sep of separators) {
    const idx = message.indexOf(sep)
    if (idx > 0 && idx < 80) {
      return { title: message.slice(0, idx), body: message.slice(idx + sep.length) }
    }
  }
  if (message.length > 60) {
    return { title: message.slice(0, 60) + "...", body: message }
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

/**
 * Renders body text with bold labels (text before first colon),
 * numbered lists, and standalone section headings.
 */
function renderFormattedBody(text: string): ReactNode {
  if (!text) return null

  const lines = text.split("\n")

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        // Numbered list item: "1. text"
        const listMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
        if (listMatch) {
          return (
            <div key={i} className="flex gap-2 pl-5">
              <span className="text-muted-foreground/60 shrink-0 w-4 text-right text-sm">
                {listMatch[1]}.
              </span>
              <span className="text-sm text-foreground/80 leading-relaxed">
                {renderInlineLabels(listMatch[2])}
              </span>
            </div>
          )
        }

        // Label detection: "Word:" or "Multi Word:" at start
        const colonIdx = trimmed.indexOf(":")
        if (colonIdx > 0 && colonIdx < 40) {
          const label = trimmed.slice(0, colonIdx + 1)
          const rest = trimmed.slice(colonIdx + 1).trim()
          const wordCount = label.split(/\s+/).length

          if (wordCount <= 5) {
            if (!rest) {
              // Label-only line (introduces a list or subsection)
              return (
                <p key={i} className="text-sm font-semibold text-foreground mt-2">
                  {label}
                </p>
              )
            }
            return (
              <p key={i} className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">{label}</span>{" "}
                <span className="text-foreground/80">{rest}</span>
              </p>
            )
          }
        }

        // Standalone heading: short line, capitalized, no trailing period
        if (
          trimmed.length > 3 &&
          trimmed.length < 60 &&
          !trimmed.endsWith(".") &&
          !trimmed.endsWith(",") &&
          trimmed[0] === trimmed[0].toUpperCase() &&
          !trimmed.startsWith("http")
        ) {
          const words = trimmed.split(/\s+/)
          if (words.length >= 2 && words.length <= 8) {
            return (
              <p key={i} className="text-sm font-bold text-foreground mt-3 mb-0.5">
                {trimmed}
              </p>
            )
          }
        }

        // Regular text
        return (
          <p key={i} className="text-sm text-foreground/80 leading-relaxed">
            {renderInlineLabels(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

/** Bolds inline labels like "Speed:" or "Narrative:" within text */
function renderInlineLabels(text: string): ReactNode {
  // Match "Word(s):" at the start of text
  const match = text.match(/^([A-Z][a-zA-Z\s]{0,30}:)\s*/)
  if (match) {
    return (
      <>
        <span className="font-semibold text-foreground">{match[1]}</span>{" "}
        {text.slice(match[0].length)}
      </>
    )
  }
  return text
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-500/20 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
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
  const stats = useMemo(() => computeStats(events), [events])

  const uniqueAgents = useMemo(() => {
    const names = new Set(events.map((e) => e.agent.name))
    return names.size
  }, [events])

  // Most recent event timestamp for "Modified" display
  const lastModifiedAt = useMemo(() => {
    if (events.length === 0) return null
    return events[events.length - 1].created_at
  }, [events])

  // ── Empty state ──
  if (mode === "empty") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/60">Select a journal to view</p>
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
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="flex items-start gap-3 mb-8">
            <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <Brain className="h-5 w-5 text-primary" weight="duotone" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Long-Term Memory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Aggregate overview of all recorded agent events
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-2xl font-semibold tabular-nums">
                {longTermSummary.totalEvents.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Events</p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-2xl font-semibold tabular-nums">
                {longTermSummary.totalWordCount.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Words</p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-sm font-medium" suppressHydrationWarning>
                {longTermSummary.oldestEventDate
                  ? new Date(longTermSummary.oldestEventDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Earliest Record</p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-sm font-medium" suppressHydrationWarning>
                {formatRelativeModified(longTermSummary.lastUpdated).replace("Modified ", "")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Last Updated</p>
            </div>
          </div>

          {events.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Events</h3>
              <div className="space-y-4">
                {events.slice(0, 10).map((event) => {
                  const { title, body } = extractTitle(event.message)
                  return (
                    <div key={event.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
                        <span className="text-xs text-muted-foreground/60">
                          {new Date(event.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground/40">&middot;</span>
                        <span className="text-xs text-muted-foreground/60">{event.agent.name}</span>
                      </div>
                      <p className="text-sm font-medium text-amber-400 mb-0.5">{title}</p>
                      {body && (
                        <p className="text-sm text-foreground/70 leading-relaxed">{body}</p>
                      )}
                    </div>
                  )
                })}
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
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Search Results</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {events.length} result{events.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </p>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/60 text-sm">
              No matching events found.
            </div>
          ) : (
            <div className="space-y-5">
              {events.map((event) => {
                const { title, body } = extractTitle(event.message)
                return (
                  <div key={event.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <span className="text-xs text-muted-foreground/60">
                        {formatTime(event.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground/60">
                        {new Date(event.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground/60">{event.agent.name}</span>
                    </div>
                    <p className="text-sm font-medium text-amber-400 mb-0.5">
                      {highlightMatch(title, searchQuery ?? "")}
                    </p>
                    {body && (
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        {highlightMatch(body, searchQuery ?? "")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Journal view ──
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground/50 mt-1 shrink-0" />
            <div>
              <h2 className="text-xl font-semibold">Journal: {journalDate}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {formatFullDate(journalDate!)} &middot; {formatBytes(stats.byteSize)} &middot;{" "}
                {stats.wordCount.toLocaleString("en-US")} words
              </p>
            </div>
          </div>
          <p
            className="text-xs text-muted-foreground/50 shrink-0 mt-1.5"
            suppressHydrationWarning
          >
            {formatRelativeModified(lastModifiedAt)}
          </p>
        </div>

        {/* Events as document flow */}
        {events.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/60 text-sm">
            No events for this date.
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => {
              const { title, body } = extractTitle(event.message)

              return (
                <div key={event.id}>
                  {/* Time + Title line */}
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 relative top-[3px]" />
                    <span className="text-sm text-muted-foreground/50 shrink-0">
                      {formatTime(event.created_at)}
                    </span>
                    <span className="text-sm text-muted-foreground/30">&mdash;</span>
                    <h3 className="text-sm font-semibold text-amber-400">
                      {title}
                    </h3>
                    {uniqueAgents > 1 && (
                      <span className="text-xs text-muted-foreground/40 ml-auto shrink-0">
                        {event.agent.name}
                      </span>
                    )}
                  </div>

                  {/* Body content */}
                  {body && <div className="pl-[26px]">{renderFormattedBody(body)}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
