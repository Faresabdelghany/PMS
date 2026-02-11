import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getReport, getReportActionItems } from "@/lib/actions/reports"
import { getCachedOrganizationMembers } from "@/lib/server-cache"
import { ReportDetailContent } from "@/components/reports/ReportDetailContent"
import { ReportDetailSkeleton } from "@/components/skeletons"

export const metadata: Metadata = {
  title: "Report - PMS",
}

type PageProps = { params: Promise<{ id: string; reportId: string }> }

async function ReportDetail({ projectId, reportId }: { projectId: string; reportId: string }) {
  // Start action items fetch in parallel with report fetch (no waterfall)
  const actionItemsPromise = getReportActionItems(reportId)
  const result = await getReport(reportId)

  if (result.error || !result.data) {
    notFound()
  }

  const report = result.data

  // Fetch org members in parallel with already-started action items
  const [membersResult, actionItemsResult] = await Promise.all([
    getCachedOrganizationMembers(report.organization_id),
    actionItemsPromise,
  ])

  const members = (membersResult.data || []).map((m: any) => ({
    id: m.user_id,
    name: m.profile?.full_name || m.profile?.email || "Unknown",
    email: m.profile?.email || "",
    avatarUrl: m.profile?.avatar_url || null,
  }))

  return (
    <ReportDetailContent
      report={report}
      organizationMembers={members}
      actionItems={actionItemsResult.data || []}
      projectId={projectId}
    />
  )
}

export default async function Page({ params }: PageProps) {
  const { id, reportId } = await params

  return (
    <Suspense fallback={<ReportDetailSkeleton />}>
      <ReportDetail projectId={id} reportId={reportId} />
    </Suspense>
  )
}
