"use client"

import { useMemo } from "react"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  parseISO,
  isSameMonth,
  isSameDay,
} from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AgentCalendarMonth } from "@/lib/actions/mission-control"

interface DaySummary {
  total: number
  success: number
  failed: number
  running: number
  paused: number
}

function computeDaySummaries(entries: AgentCalendarMonth["entries"]) {
  const map = new Map<string, DaySummary>()
  for (const entry of entries) {
    const key = format(parseISO(entry.nextRunAt), "yyyy-MM-dd")
    const summary = map.get(key) ?? { total: 0, success: 0, failed: 0, running: 0, paused: 0 }
    summary.total++
    if (entry.isPaused) summary.paused++
    if (entry.status === "success") summary.success++
    else if (entry.status === "failed") summary.failed++
    else if (entry.status === "running") summary.running++
    map.set(key, summary)
  }
  return map
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

interface AgentCalendarMonthViewProps {
  calendar: AgentCalendarMonth | null
}

export function AgentCalendarMonthView({ calendar }: AgentCalendarMonthViewProps) {
  const today = new Date()

  const calendarDays = useMemo(() => {
    if (!calendar) return []
    const monthStart = parseISO(calendar.monthStart)
    const gridStart = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
    const days: Date[] = []
    let current = gridStart
    while (current <= gridEnd) {
      days.push(current)
      current = addDays(current, 1)
    }
    return days
  }, [calendar])

  const summaries = useMemo(() => {
    if (!calendar) return new Map<string, DaySummary>()
    return computeDaySummaries(calendar.entries)
  }, [calendar])

  if (!calendar) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Calendar data unavailable.
      </div>
    )
  }

  const monthDate = parseISO(calendar.monthStart)

  return (
    <Card data-testid="mc-calendar-month">
      <CardHeader>
        <CardTitle>{format(monthDate, "MMMM yyyy")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="p-1 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const summary = summaries.get(key)
            const inMonth = isSameMonth(day, monthDate)
            const isToday = isSameDay(day, today)

            return (
              <div
                key={key}
                className={`rounded-md border p-1.5 min-h-[60px] text-xs ${
                  !inMonth
                    ? "bg-muted/30 border-transparent text-muted-foreground/50"
                    : isToday
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                }`}
              >
                <p
                  className={`text-[10px] font-medium ${
                    isToday ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </p>
                {summary && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {summary.success > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          >
                            {summary.success}
                          </Badge>
                        )}
                        {summary.failed > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-red-500/10 text-red-600 border-red-500/20"
                          >
                            {summary.failed}
                          </Badge>
                        )}
                        {summary.running > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/20"
                          >
                            {summary.running}
                          </Badge>
                        )}
                        {summary.paused > 0 && (
                          <Badge
                            variant="muted"
                            className="text-[9px] px-1 py-0"
                          >
                            {summary.paused}p
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-0.5">
                        <p className="font-medium">{format(day, "EEE, MMM d")}</p>
                        <p>{summary.total} total runs</p>
                        {summary.success > 0 && <p>{summary.success} succeeded</p>}
                        {summary.failed > 0 && <p>{summary.failed} failed</p>}
                        {summary.running > 0 && <p>{summary.running} running</p>}
                        {summary.paused > 0 && <p>{summary.paused} paused</p>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
