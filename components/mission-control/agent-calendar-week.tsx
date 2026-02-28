"use client"

import Link from "next/link"
import { addDays, format, parseISO, startOfWeek } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AgentCalendarWeek } from "@/lib/actions/mission-control"

const statusIconMap: Record<string, string> = {
  success: "✅",
  failed: "❌",
  skipped: "⏭",
  running: "🔄",
  pending: "⏳",
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

export function AgentCalendarWeekView({ calendar }: { calendar: AgentCalendarWeek | null }) {
  if (!calendar) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Calendar data unavailable.
      </div>
    )
  }

  const weekStart = startOfWeek(parseISO(calendar.weekStart), { weekStartsOn: 1 })
  const grouped = entriesByDay(calendar)

  return (
    <Card data-testid="mc-calendar">
      <CardHeader>
        <CardTitle>Week Schedule</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => {
          const day = addDays(weekStart, index)
          const key = format(day, "yyyy-MM-dd")
          const dayEntries = grouped.get(key) ?? []

          return (
            <div key={key} className="rounded-md border border-border p-2 min-h-[140px]">
              <p className="text-xs font-medium text-muted-foreground">
                {format(day, "EEE dd")}
              </p>
              <div className="mt-2 space-y-2">
                {dayEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground">No runs</p>
                )}
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="rounded border border-border p-2 text-xs">
                    <p className="font-medium truncate">
                      {statusIconMap[entry.status] ?? "⏳"} {entry.agentName}
                    </p>
                    <p className="text-muted-foreground">{format(parseISO(entry.nextRunAt), "HH:mm")} · {entry.taskType}</p>
                    <p className="text-muted-foreground truncate">{entry.scheduleExpr}</p>
                    {entry.taskId && (
                      <Link href={`/tasks?task=${entry.taskId}`} className="text-primary hover:underline">
                        Open run task
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

