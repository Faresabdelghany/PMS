import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { PerformancePageSkeleton, ChartsSkeleton } from "@/components/skeletons/performance-skeletons"
import { PerformanceStatCards } from "@/components/performance/PerformanceStatCards"
import { PerformanceCharts } from "@/components/performance/PerformanceCharts"
import { getCachedPerformanceMetrics, getCachedActiveOrgFromKV } from "@/lib/server-cache"

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
  // Use KV-cached org - instant hit from layout's cache warming (~5ms)
  const org = await getCachedActiveOrgFromKV()

  if (!org) {
    redirect("/login")
  }

  const organizationId = org.id

  return (
    <Suspense fallback={<PerformancePageSkeleton />}>
      <PerformanceContent orgId={organizationId} />
    </Suspense>
  )
}
