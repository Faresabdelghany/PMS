"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"
import type { PerformanceMetrics } from "@/lib/actions/analytics"
import { PROJECT_STATUS_LABELS } from "@/lib/constants/status"

type ProjectStatusPieChartProps = {
  projectStats: PerformanceMetrics["projectStats"]
}

const STATUS_COLORS: Record<string, string> = {
  backlog: "hsl(var(--muted-foreground))",
  planned: "hsl(var(--chart-3))",
  active: "hsl(var(--chart-2))",
  cancelled: "hsl(var(--destructive))",
  completed: "hsl(var(--chart-1))",
}

export function ProjectStatusPieChart({ projectStats }: ProjectStatusPieChartProps) {
  const data = Object.entries(projectStats.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] || status,
      value: count,
      status,
    }))

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Status Distribution</CardTitle>
          <CardDescription>Projects by their current status</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No projects yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Status Distribution</CardTitle>
        <CardDescription>Projects by their current status</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.status}`}
                  fill={STATUS_COLORS[entry.status] || "hsl(var(--muted))"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--popover-foreground))" }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
