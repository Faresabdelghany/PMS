"use client"

import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { DailyCompletions, TaskStatusDistribution } from "@/lib/actions/dashboard"

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; name?: string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function CompletionsBarChart({ data }: { data: DailyCompletions[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasks Completed</CardTitle>
        <CardDescription>Daily completed tasks over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                width={32}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="count"
                name="Completed"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatusAreaChart({ data }: { data: TaskStatusDistribution[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Task Status Distribution</CardTitle>
        <CardDescription>Status breakdown of tasks over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                width={32}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="todo"
                name="To Do"
                stackId="status"
                fill="var(--chart-3)"
                stroke="var(--chart-3)"
                fillOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="inProgress"
                name="In Progress"
                stackId="status"
                fill="var(--chart-1)"
                stroke="var(--chart-1)"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="done"
                name="Done"
                stackId="status"
                fill="var(--chart-2)"
                stroke="var(--chart-2)"
                fillOpacity={0.7}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
