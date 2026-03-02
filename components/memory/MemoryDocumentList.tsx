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
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-slate-800/90 p-3">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search memory..."
            className="h-9 rounded-md border-slate-700/80 bg-[#131a28] pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/30"
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
            "mb-4 w-full rounded-lg border p-3 text-left transition-colors",
            isLongTermSelected
              ? "border-indigo-500/40 bg-indigo-500/15"
              : "border-slate-700/80 bg-[#11182a] hover:bg-[#172038]"
          )}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20">
              <Brain className="h-4 w-4 text-indigo-300" weight="duotone" />
            </div>
            <span className="text-sm font-medium text-slate-100">Long-Term Memory</span>
            <span className="text-xs">&#x2728;</span>
          </div>
          <p
            className="pl-[38px] text-xs text-slate-400"
            suppressHydrationWarning
          >
            {longTermSummary.totalWordCount.toLocaleString("en-US")} words &middot; Updated{" "}
            {formatRelativeDate(longTermSummary.lastUpdated)}
          </p>
        </button>

        {/* Daily Journal header */}
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Daily Journal
          </span>
          <Badge className="border-0 bg-slate-700/70 px-1.5 py-0 text-[10px] font-medium text-slate-300 hover:bg-slate-700/70">
            {journals.length} entries
          </Badge>
        </div>

        {/* Time-grouped entries with collapsible sections */}
        {timeGroups.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
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
                        "h-3.5 w-3.5 text-slate-600 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <span className="text-xs font-medium text-slate-400">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-slate-600">
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
                            "w-full rounded-md border border-transparent px-3 py-2 text-left transition-colors",
                            selectedDate === journal.date && !isLongTermSelected
                              ? "border-slate-600 bg-slate-700/50"
                              : "hover:bg-slate-800/80"
                          )}
                        >
                          <p
                            className="truncate text-sm text-slate-100"
                            suppressHydrationWarning
                          >
                            {formatDate(journal.date)}
                          </p>
                          <p
                            className="mt-0.5 text-xs text-slate-500"
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
