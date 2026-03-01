"use client"

import { useEffect, useState, useTransition } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CalendarBlank, ListBullets } from "@phosphor-icons/react"
import {
  getAgentCalendarWeek,
  getAgentCalendarMonth,
  getLiveOpsSnapshot,
  type AgentCalendarWeek,
  type AgentCalendarMonth,
  type LiveOpsSnapshot,
} from "@/lib/actions/mission-control"
import { LiveOpsPanel } from "./live-ops-panel"
import { AgentCalendarWeekView } from "./agent-calendar-week"
import { AgentCalendarMonthView } from "./agent-calendar-month"

type CalendarView = "week" | "month"

interface MissionControlClientProps {
  orgId: string
  initialLiveOps: LiveOpsSnapshot | null
  initialCalendar: AgentCalendarWeek | null
}

export function MissionControlClient({
  orgId,
  initialLiveOps,
  initialCalendar,
}: MissionControlClientProps) {
  const [liveOps, setLiveOps] = useState<LiveOpsSnapshot | null>(initialLiveOps)
  const [calendar, setCalendar] = useState<AgentCalendarWeek | null>(initialCalendar)
  const [monthCalendar, setMonthCalendar] = useState<AgentCalendarMonth | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarView>("week")
  const [isPending, startTransition] = useTransition()
  const [isMonthLoading, startMonthTransition] = useTransition()

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(async () => {
        const [liveResult, calendarResult] = await Promise.all([
          getLiveOpsSnapshot(orgId),
          getAgentCalendarWeek(orgId),
        ])

        if (liveResult.data) setLiveOps(liveResult.data)
        if (calendarResult.data) setCalendar(calendarResult.data)
      })
    }, 5000)

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
        <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
        <p className="text-sm text-muted-foreground">
          Live operations and scheduled agent runs. Auto-refresh every 5 seconds.
          {isPending ? " Refreshing..." : ""}
        </p>
      </div>

      <Tabs defaultValue="live-ops">
        <TabsList>
          <TabsTrigger value="live-ops">Live Ops</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="live-ops" className="mt-4">
          <LiveOpsPanel snapshot={liveOps} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4 space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
