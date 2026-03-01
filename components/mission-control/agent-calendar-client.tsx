"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { ListBullets, CalendarBlank } from "@phosphor-icons/react"
import {
  getAgentCalendarWeek,
  getAgentCalendarMonth,
  type AgentCalendarWeek,
  type AgentCalendarMonth,
} from "@/lib/actions/mission-control"
import { AgentCalendarWeekView } from "./agent-calendar-week"
import { AgentCalendarMonthView } from "./agent-calendar-month"

type CalendarView = "week" | "month"

interface AgentCalendarClientProps {
  orgId: string
  initialCalendar: AgentCalendarWeek | null
}

export function AgentCalendarClient({ orgId, initialCalendar }: AgentCalendarClientProps) {
  const [calendar, setCalendar] = useState<AgentCalendarWeek | null>(initialCalendar)
  const [monthCalendar, setMonthCalendar] = useState<AgentCalendarMonth | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarView>("week")
  const [isPending, startTransition] = useTransition()
  const [isMonthLoading, startMonthTransition] = useTransition()

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(async () => {
        const result = await getAgentCalendarWeek(orgId)
        if (result.data) setCalendar(result.data)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [orgId])

  function handleViewChange(view: CalendarView) {
    setCalendarView(view)
    if (view === "month" && !monthCalendar) {
      startMonthTransition(async () => {
        const result = await getAgentCalendarMonth(orgId)
        if (result.data) setMonthCalendar(result.data)
      })
    }
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Scheduled agent runs and upcoming tasks.
          {isPending ? " Refreshing..." : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant={calendarView === "week" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleViewChange("week")}
          aria-label="Week view"
        >
          <ListBullets className="h-4 w-4 mr-1.5" />
          Week
        </Button>
        <Button
          variant={calendarView === "month" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleViewChange("month")}
          aria-label="Month view"
        >
          <CalendarBlank className="h-4 w-4 mr-1.5" />
          Month
        </Button>
      </div>
      {calendarView === "week" && (
        <AgentCalendarWeekView calendar={calendar} orgId={orgId} />
      )}
      {calendarView === "month" && (
        isMonthLoading ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground animate-pulse">
            Loading month view...
          </div>
        ) : (
          <AgentCalendarMonthView calendar={monthCalendar} />
        )
      )}
    </div>
  )
}
