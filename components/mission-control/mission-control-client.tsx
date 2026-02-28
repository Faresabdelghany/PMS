"use client"

import { useEffect, useState, useTransition } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getAgentCalendarWeek,
  getLiveOpsSnapshot,
  type AgentCalendarWeek,
  type LiveOpsSnapshot,
} from "@/lib/actions/mission-control"
import { LiveOpsPanel } from "./live-ops-panel"
import { AgentCalendarWeekView } from "./agent-calendar-week"

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
  const [isPending, startTransition] = useTransition()

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

  return (
    <div className="space-y-6 p-6">
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
        <TabsContent value="calendar" className="mt-4">
          <AgentCalendarWeekView calendar={calendar} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

