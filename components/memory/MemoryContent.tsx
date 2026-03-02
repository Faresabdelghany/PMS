"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { PageHeader } from "@/components/ui/page-header"
import { MemoryDocumentList } from "./MemoryDocumentList"
import { MemoryDocumentViewer } from "./MemoryDocumentViewer"
import {
  getJournalContent,
  searchMemories,
  type MemoryJournalSummary,
  type MemoryJournalEvent,
  type MemoryLongTermSummary,
} from "@/lib/actions/memory"
import { MEMORY_SEARCH_DEBOUNCE_MS } from "@/lib/constants"

interface MemoryContentProps {
  initialJournals: MemoryJournalSummary[]
  longTermSummary: MemoryLongTermSummary | null
  orgId: string
}

export function MemoryContent({ initialJournals, longTermSummary, orgId }: MemoryContentProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isLongTermSelected, setIsLongTermSelected] = useState(false)
  const [events, setEvents] = useState<MemoryJournalEvent[]>([])
  const [searchResults, setSearchResults] = useState<MemoryJournalEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-select most recent journal on mount
  useEffect(() => {
    if (initialJournals.length > 0 && !selectedDate && !isLongTermSelected) {
      handleSelectDate(initialJournals[0].date)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (!search) {
      setDebouncedSearch("")
      setSearchResults([])
      return
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, MEMORY_SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [search])

  // Execute search when debounced value changes
  useEffect(() => {
    if (!debouncedSearch) return
    let cancelled = false
    setIsLoading(true)
    searchMemories(orgId, debouncedSearch).then((result) => {
      if (cancelled) return
      setSearchResults(result.data ?? [])
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [debouncedSearch, orgId])

  const handleSelectDate = useCallback(async (date: string) => {
    setSelectedDate(date)
    setIsLongTermSelected(false)
    setMobileSidebarOpen(false)
    setIsLoading(true)
    const result = await getJournalContent(orgId, date)
    setEvents(result.data ?? [])
    setIsLoading(false)
  }, [orgId])

  const handleSelectLongTerm = useCallback(() => {
    setIsLongTermSelected(true)
    setSelectedDate(null)
    setMobileSidebarOpen(false)
  }, [])

  // Determine viewer mode
  let viewerMode: "journal" | "long-term" | "search" | "empty" = "empty"
  let viewerEvents = events
  if (debouncedSearch) {
    viewerMode = "search"
    viewerEvents = searchResults
  } else if (isLongTermSelected) {
    viewerMode = "long-term"
    viewerEvents = events
  } else if (selectedDate) {
    viewerMode = "journal"
    viewerEvents = events
  }

  const defaultSummary: MemoryLongTermSummary = {
    totalEvents: 0,
    totalWordCount: 0,
    oldestEventDate: null,
    lastUpdated: null,
  }

  const sidebar = (
    <MemoryDocumentList
      journals={initialJournals}
      longTermSummary={longTermSummary ?? defaultSummary}
      selectedDate={selectedDate}
      onSelectDate={handleSelectDate}
      onSelectLongTerm={handleSelectLongTerm}
      isLongTermSelected={isLongTermSelected}
      search={search}
      onSearchChange={setSearch}
    />
  )

  return (
    <div className="mx-2 my-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/90 bg-[#070a11] text-slate-100">
      <PageHeader
        title="Memory"
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        }
      />

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden w-[280px] shrink-0 border-r border-slate-800/90 bg-[#0b0f18] md:flex">
          {sidebar}
        </div>

        {/* Mobile sidebar (Sheet) */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-72 border-r border-slate-800/90 bg-[#0b0f18] p-0">
            <SheetTitle className="sr-only">Memory Navigation</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        {/* Content */}
        <div className="flex min-w-0 flex-1 bg-[#0b0f18]">
          <MemoryDocumentViewer
            mode={viewerMode}
            journalDate={selectedDate ?? undefined}
            events={viewerEvents}
            longTermSummary={longTermSummary ?? defaultSummary}
            isLoading={isLoading}
            searchQuery={debouncedSearch}
          />
        </div>
      </div>
    </div>
  )
}
