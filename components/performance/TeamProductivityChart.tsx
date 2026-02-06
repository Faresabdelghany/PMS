"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import type { PerformanceMetrics } from "@/lib/actions/analytics"

type TeamProductivityChartProps = {
  teamProductivity: PerformanceMetrics["teamProductivity"]
}

function CustomTick({ x, y, payload, data }: {
  x?: number
  y?: number
  payload?: { value: string }
  data: PerformanceMetrics["teamProductivity"]
}) {
  const member = data.find((m) => m.userName === payload?.value)
  if (!member) return null

  const initials = member.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-55} y={-12} width={50} height={24}>
        <div className="flex items-center justify-end gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarImage
              src={getOptimizedAvatarUrl(member.avatarUrl, 40) || undefined}
              alt={member.userName}
            />
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </foreignObject>
    </g>
  )
}

export function TeamProductivityChart({
  teamProductivity,
}: TeamProductivityChartProps) {
  const hasData = teamProductivity.some((member) => member.tasksCompleted > 0)

  if (teamProductivity.length === 0 || !hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Productivity</CardTitle>
          <CardDescription>Tasks completed by team members this month</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-muted-foreground">No productivity data yet</p>
        </CardContent>
      </Card>
    )
  }

  // Prepare data for chart
  const chartData = teamProductivity.map((member) => ({
    name: member.userName,
    tasksCompleted: member.tasksCompleted,
    avatarUrl: member.avatarUrl,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Productivity</CardTitle>
        <CardDescription>Tasks completed by team members this month</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 60,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={(props) => <CustomTick {...props} data={teamProductivity} />}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--popover-foreground))",
              }}
              labelStyle={{ color: "hsl(var(--popover-foreground))" }}
              formatter={(value: number) => [value, "Tasks Completed"]}
            />
            <Bar
              dataKey="tasksCompleted"
              fill="hsl(var(--chart-2))"
              radius={[0, 4, 4, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
