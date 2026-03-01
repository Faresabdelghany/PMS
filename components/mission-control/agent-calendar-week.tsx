"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { addDays, format, parseISO, startOfWeek } from "date-fns"
import { Play, Pause, Lightning } from "@phosphor-icons/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AgentCalendarWeek, CalendarEntry } from "@/lib/actions/mission-control"
import {
  toggleScheduledRunPause,
  triggerScheduledRun,
} from "@/lib/actions/mission-control"

const statusClassMap: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  skipped: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  running: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  pending: "bg-muted text-muted-foreground border-border",
}

function entriesByDay(week: AgentCalendarWeek) {
  const grouped = new Map<string, AgentCalendarWeek["entries"]>()
  for (const entry of week.entries) {
    const key = format(parseISO(entry.nextRunAt), "yyyy-MM-dd")
    const bucket = grouped.get(key) ?? []
    bucket.push(entry)
    grouped.set(key, bucket)
  }
  return grouped
}

function RunEntryCard({
  entry,
  orgId,
  onUpdate,
}: {
  entry: CalendarEntry
  orgId: string
  onUpdate: (id: string, isPaused: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [triggerPending, startTriggerTransition] = useTransition()

  function handleTogglePause() {
    startTransition(async () => {
      const result = await toggleScheduledRunPause(orgId, entry.id, !entry.isPaused)
      if (result.data) {
        onUpdate(entry.id, result.data.paused)
      }
    })
  }

  function handleTrigger() {
    startTriggerTransition(async () => {
      await triggerScheduledRun(orgId, entry.id)
    })
  }

  return (
    <div
      className={`rounded-md border p-2 text-xs transition-opacity ${
        entry.isPaused ? "opacity-60 border-dashed border-border" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${statusClassMap[entry.status] ?? ""}`}>
              {entry.status}
            </Badge>
            {entry.isPaused && (
              <Badge variant="muted" className="text-[10px] px-1 py-0">
                paused
              </Badge>
            )}
          </div>
          <p className="mt-1 font-medium truncate">{entry.agentName}</p>
          <p className="text-muted-foreground">
            {format(parseISO(entry.nextRunAt), "HH:mm")} · {entry.taskType}
          </p>
          <p className="text-muted-foreground truncate">{entry.scheduleExpr}</p>
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                onClick={handleTogglePause}
                disabled={isPending}
                aria-label={entry.isPaused ? "Resume run" : "Pause run"}
              >
                {entry.isPaused ? (
                  <Play className="h-3 w-3" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{entry.isPaused ? "Resume" : "Pause"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                onClick={handleTrigger}
                disabled={triggerPending || entry.isPaused || !entry.agentId}
                aria-label="Trigger run now"
              >
                <Lightning className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Trigger now</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {entry.taskId && (
        <Link
          href={`/tasks?task=${entry.taskId}`}
          className="mt-1 inline-flex items-center text-primary hover:underline min-h-[44px] sm:min-h-0"
        >
          Open task
        </Link>
      )}
    </div>
  )
}

interface AgentCalendarWeekViewProps {
  calendar: AgentCalendarWeek | null
  orgId: string
}

export function AgentCalendarWeekView({ calendar, orgId }: AgentCalendarWeekViewProps) {
  const [entries, setEntries] = useState(calendar?.entries ?? [])

  // Keep entries in sync when calendar prop changes
  const [prevCalendar, setPrevCalendar] = useState(calendar)
  if (calendar !== prevCalendar) {
    setPrevCalendar(calendar)
    setEntries(calendar?.entries ?? [])
  }

  if (!calendar) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Calendar data unavailable.
      </div>
    )
  }

  function handleEntryUpdate(id: string, isPaused: boolean) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isPaused } : e))
    )
  }

  const weekStart = startOfWeek(parseISO(calendar.weekStart), { weekStartsOn: 1 })
  const calendarWithEntries: AgentCalendarWeek = { ...calendar, entries }
  const grouped = entriesByDay(calendarWithEntries)

  return (
    <Card data-testid="mc-calendar">
      <CardHeader>
        <CardTitle>Week Schedule</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => {
          const day = addDays(weekStart, index)
          const key = format(day, "yyyy-MM-dd")
          const dayEntries = grouped.get(key) ?? []
          const isToday = format(new Date(), "yyyy-MM-dd") === key

          return (
            <div
              key={key}
              className={`rounded-md border p-2 min-h-[80px] xl:min-h-[140px] ${
                isToday ? "border-primary/40 bg-primary/5" : "border-border"
              }`}
            >
              <p
                className={`text-xs font-medium ${
                  isToday ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {format(day, "EEE dd")}
              </p>
              <div className="mt-2 space-y-2">
                {dayEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground">No runs</p>
                )}
                {dayEntries.map((entry) => (
                  <RunEntryCard
                    key={entry.id}
                    entry={entry}
                    orgId={orgId}
                    onUpdate={handleEntryUpdate}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
