"use client"

import { PerformanceStatCards } from "./PerformanceStatCards"
import { PerformanceCharts } from "./PerformanceCharts"
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

      {/* Charts (lazy-loaded) */}
      <PerformanceCharts metrics={metrics} />
    </div>
  )
}
