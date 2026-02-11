import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ReportsListContent } from "@/components/reports/ReportsListContent"
import { getReports } from "@/lib/actions/reports"
import { getCachedActiveOrgFromKV } from "@/lib/server-cache"
import { ReportsListSkeleton } from "@/components/skeletons/report-skeletons"

export const metadata: Metadata = {
  title: "Reports - PMS",
}

async function ReportsList({ orgId }: { orgId: string }) {
  const result = await getReports(orgId)
  // Strip server-only fields (organization_id, created_by, created_at, updated_at) for smaller RSC payload
  const reports = (result.data || []).map((r) => ({
    id: r.id,
    title: r.title,
    period_type: r.period_type,
    period_start: r.period_start,
    period_end: r.period_end,
    author: r.author,
    project_count: r.project_count,
    status_summary: r.status_summary,
  }))
  return <ReportsListContent initialReports={reports} organizationId={orgId} />
}

export default async function Page() {
  const org = await getCachedActiveOrgFromKV()

  if (!org) {
    redirect("/login")
  }

  return (
    <Suspense fallback={<ReportsListSkeleton />}>
      <ReportsList orgId={org.id} />
    </Suspense>
  )
}
