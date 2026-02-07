import { Suspense } from "react"
import dynamic from "next/dynamic"
import { redirect } from "next/navigation"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { PerformancePageSkeleton } from "@/components/skeletons/performance-skeletons"
import { cachedGetUserOrganizations } from "@/lib/request-cache"
import { getCachedPerformanceMetrics } from "@/lib/server-cache"

// Lazy-load recharts-heavy dashboard component
const PerformanceDashboard = dynamic(
  () => import("@/components/performance").then(m => ({ default: m.PerformanceDashboard })),
  { loading: () => <PerformancePageSkeleton /> }
)

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
      <PerformanceDashboard metrics={result.data} />
    </div>
  )
}

export default async function PerformancePage() {
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/login")
  }

  const organizationId = orgsResult.data[0].id

  return (
    <Suspense fallback={<PerformancePageSkeleton />}>
      <PerformanceContent orgId={organizationId} />
    </Suspense>
  )
}
