"use client"

import { PerformanceStatCards } from "./PerformanceStatCards"
import { ProjectStatusPieChart } from "./ProjectStatusPieChart"
import { TaskVelocityChart } from "./TaskVelocityChart"
import { TeamProductivityChart } from "./TeamProductivityChart"
import type { PerformanceMetrics } from "@/lib/actions/analytics"

type PerformanceDashboardProps = {
  metrics: PerformanceMetrics
}

export function PerformanceDashboard({ metrics }: PerformanceDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="text-muted-foreground">
          Track project progress, task completion, and team productivity
        </p>
      </div>

      {/* Stat Cards */}
      <PerformanceStatCards metrics={metrics} />

      {/* Charts Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <ProjectStatusPieChart projectStats={metrics.projectStats} />
        <TaskVelocityChart weeklyTrends={metrics.weeklyTrends} />
      </div>

      {/* Team Productivity Chart */}
      <TeamProductivityChart teamProductivity={metrics.teamProductivity} />
    </div>
  )
}
