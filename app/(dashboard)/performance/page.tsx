import type { Metadata } from "next"
import { Suspense } from "react"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { PerformancePageSkeleton, ChartsSkeleton } from "@/components/skeletons/performance-skeletons"
import { PerformanceStatCards } from "@/components/performance/PerformanceStatCards"
import { PerformanceCharts } from "@/components/performance/PerformanceCharts"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedPerformanceMetrics } from "@/lib/server-cache"

export const metadata: Metadata = {
  title: "Performance - PMS",
}

async function PerformanceContent({ orgId }: { orgId: string }) {
  const result = await getCachedPerformanceMetrics(orgId)

  if (result.error || !result.data) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <p className="text-muted-foreground">
          Failed to load performance data. Please try again later.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Performance" },
        ]}
      />
      {/* Header + stat cards render immediately for fast LCP (text-based) */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="text-muted-foreground">
          Track project progress, task completion, and team productivity
        </p>
      </div>
      <PerformanceStatCards metrics={result.data} />

      {/* Charts lazy-loaded separately — not on the LCP path */}
      <Suspense fallback={<ChartsSkeleton />}>
        <PerformanceCharts metrics={result.data} />
      </Suspense>
    </div>
  )
}

export default async function PerformancePage() {
  const { orgId } = await getPageOrganization()

  return (
    <Suspense fallback={<PerformancePageSkeleton />}>
      <PerformanceContent orgId={orgId} />
    </Suspense>
  )
}
