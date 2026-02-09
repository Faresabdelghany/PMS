"use client"

import dynamic from "next/dynamic"
import { ChartSkeleton } from "@/components/skeletons/performance-skeletons"
import type { PerformanceMetrics } from "@/lib/actions/analytics"

// Lazy-load each chart individually so recharts JS doesn't block LCP
const ProjectStatusPieChart = dynamic(
  () => import("./ProjectStatusPieChart").then(m => ({ default: m.ProjectStatusPieChart })),
  { loading: () => <ChartSkeleton height={300} /> }
)

const TaskVelocityChart = dynamic(
  () => import("./TaskVelocityChart").then(m => ({ default: m.TaskVelocityChart })),
  { loading: () => <ChartSkeleton height={300} /> }
)

const TeamProductivityChart = dynamic(
  () => import("./TeamProductivityChart").then(m => ({ default: m.TeamProductivityChart })),
  { loading: () => <ChartSkeleton height={350} /> }
)

type PerformanceChartsProps = {
  metrics: PerformanceMetrics
}

export function PerformanceCharts({ metrics }: PerformanceChartsProps) {
  return (
    <>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <ProjectStatusPieChart projectStats={metrics.projectStats} />
        <TaskVelocityChart weeklyTrends={metrics.weeklyTrends} />
      </div>
      <TeamProductivityChart teamProductivity={metrics.teamProductivity} />
    </>
  )
}
