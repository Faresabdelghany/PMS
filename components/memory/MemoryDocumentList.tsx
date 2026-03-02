"use client"

import { useMemo, useState } from "react"
import { ChevronRight, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Brain } from "@phosphor-icons/react/dist/ssr/Brain"
import { cn } from "@/lib/utils"
import type { MemoryJournalSummary, MemoryLongTermSummary } from "@/lib/actions/memory"

interface MemoryDocumentListProps {
  journals: MemoryJournalSummary[]
  longTermSummary: MemoryLongTermSummary
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onSelectLongTerm: () => void
  isLongTermSelected: boolean
  search: string
  onSearchChange: (value: string) => void
}

interface TimeGroup {
  label: string
  entries: MemoryJournalSummary[]
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z")
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `about ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function getISOWeekUTC(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7
    )
  )
}

const INITIALLY_EXPANDED = new Set(["Today", "Yesterday", "This Week"])

function groupJournalsByTime(journals: MemoryJournalSummary[]): TimeGroup[] {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const yesterdayDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
  )
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10)
  const thisWeek = getISOWeekUTC(now)
  const thisYear = now.getUTCFullYear()
  const thisMonth = now.getUTCMonth()

  const groups = new Map<string, MemoryJournalSummary[]>()
  const groupOrder: string[] = []

  for (const journal of journals) {
    const jDate = new Date(journal.date + "T12:00:00Z")
    let key: string

    if (journal.date === todayStr) {
      key = "Today"
    } else if (journal.date === yesterdayStr) {
      key = "Yesterday"
    } else if (getISOWeekUTC(jDate) === thisWeek && jDate.getUTCFullYear() === thisYear) {
      key = "This Week"
    } else if (jDate.getUTCMonth() === thisMonth && jDate.getUTCFullYear() === thisYear) {
      key = "This Month"
    } else {
      key = jDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    }

    if (!groups.has(key)) {
      groups.set(key, [])
      groupOrder.push(key)
    }
    groups.get(key)!.push(journal)
  }

  return groupOrder.map((label) => ({
    label,
    entries: groups.get(label)!,
  }))
}

// ── Component ─────────────────────────────────────────────────────────

export function MemoryDocumentList({
  journals,
  longTermSummary,
  selectedDate,
  onSelectDate,
  onSelectLongTerm,
  isLongTermSelected,
  search,
  onSearchChange,
}: MemoryDocumentListProps) {
  const timeGroups = useMemo(() => groupJournalsByTime(journals), [journals])

  // Track which groups are expanded — default first few open
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(INITIALLY_EXPANDED)
  )

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search memory..."
            className="pl-9 h-9 text-sm bg-muted/40 border-border/60"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        {/* Long-Term Memory card */}
        <button
          type="button"
          onClick={onSelectLongTerm}
          className={cn(
            "w-full text-left rounded-lg p-3 mb-4 transition-colors border",
            isLongTermSelected
              ? "bg-accent border-border"
              : "bg-primary/5 border-primary/10 hover:bg-primary/10"
          )}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-primary" weight="duotone" />
            </div>
            <span className="text-sm font-medium">Long-Term Memory</span>
            <span className="text-xs">&#x2728;</span>
          </div>
          <p
            className="text-xs text-muted-foreground pl-[38px]"
            suppressHydrationWarning
          >
            {longTermSummary.totalWordCount.toLocaleString("en-US")} words &middot; Updated{" "}
            {formatRelativeDate(longTermSummary.lastUpdated)}
          </p>
        </button>

        {/* Daily Journal header */}
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Daily Journal
          </span>
          <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0 font-medium border-0 hover:bg-primary/20">
            {journals.length} entries
          </Badge>
        </div>

        {/* Time-grouped entries with collapsible sections */}
        {timeGroups.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No journal entries yet.
          </div>
        ) : (
          <div className="space-y-0.5">
            {timeGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.label)

              return (
                <div key={group.label}>
                  {/* Group header — clickable to toggle */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center gap-1.5 w-full py-1.5 text-left group"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <span className="text-xs font-medium text-muted-foreground/70">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      ({group.entries.length})
                    </span>
                  </button>

                  {/* Entries — collapsed/expanded */}
                  {isExpanded && (
                    <div className="ml-1">
                      {group.entries.map((journal) => (
                        <button
                          key={journal.date}
                          type="button"
                          onClick={() => onSelectDate(journal.date)}
                          className={cn(
                            "w-full text-left rounded-md px-3 py-2 transition-colors",
                            selectedDate === journal.date && !isLongTermSelected
                              ? "bg-accent"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <p
                            className="text-sm text-foreground/90 truncate"
                            suppressHydrationWarning
                          >
                            {formatDate(journal.date)}
                          </p>
                          <p
                            className="text-xs text-muted-foreground/60 mt-0.5"
                            suppressHydrationWarning
                          >
                            {formatBytes(journal.byteSize)} &middot;{" "}
                            {journal.wordCount.toLocaleString("en-US")} words
                          </p>
                        </button>
                      ))}
                    </div>
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
