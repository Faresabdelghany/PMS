"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Folder,
  CheckCircle,
  Clock,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr"
import type { PerformanceMetrics } from "@/lib/actions/analytics"

type PerformanceStatCardsProps = {
  metrics: PerformanceMetrics
}

export function PerformanceStatCards({ metrics }: PerformanceStatCardsProps) {
  const { projectStats, taskStats } = metrics

  // Calculate average weekly velocity from trends
  const totalCompleted = metrics.weeklyTrends.reduce(
    (sum, week) => sum + week.tasksCompleted,
    0
  )
  const avgVelocity = Math.round(totalCompleted / Math.max(metrics.weeklyTrends.length, 1))

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          <Folder className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{projectStats.total}</div>
          <p className="text-xs text-muted-foreground">
            {projectStats.completionRate}% completion rate
          </p>
        </CardContent>
      </Card>

      {/* Active Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{taskStats.total}</div>
          <p className="text-xs text-muted-foreground">
            {taskStats.overdueCount > 0 ? (
              <span className="text-destructive">
                {taskStats.overdueCount} overdue
              </span>
            ) : (
              "No overdue tasks"
            )}
          </p>
        </CardContent>
      </Card>

      {/* Completed This Week */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Completed This Week
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{taskStats.completedThisWeek}</div>
          <p className="text-xs text-muted-foreground">
            {taskStats.completedThisMonth} this month
          </p>
        </CardContent>
      </Card>

      {/* Team Velocity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Team Velocity</CardTitle>
          <TrendUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgVelocity}</div>
          <p className="text-xs text-muted-foreground">tasks/week average</p>
        </CardContent>
      </Card>
    </div>
  )
}
