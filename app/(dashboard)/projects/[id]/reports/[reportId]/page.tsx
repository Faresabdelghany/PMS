import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getReport, getReportActionItems } from "@/lib/actions/reports"
import { getCachedOrganizationMembers, getCachedTags, getCachedWorkstreamsWithTasks } from "@/lib/server-cache"
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

  // Fetch org members, action items, tags, and workstreams in parallel
  const [membersResult, actionItemsResult, tagsResult, workstreamsResult] = await Promise.all([
    getCachedOrganizationMembers(report.organization_id),
    actionItemsPromise,
    getCachedTags(report.organization_id),
    getCachedWorkstreamsWithTasks(projectId),
  ])

  // Pass raw org members (full format for TaskQuickCreateModal)
  const rawMembers = membersResult.data || []

  // Minimal tags for client component
  const tags = (tagsResult.data || []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }))

  const workstreams = (workstreamsResult.data || []).map((ws) => ({
    id: ws.id,
    name: ws.name,
  }))

  return (
    <ReportDetailContent
      report={report}
      organizationMembers={rawMembers}
      actionItems={actionItemsResult.data || []}
      projectId={projectId}
      organizationId={report.organization_id}
      reportId={reportId}
      organizationTags={tags}
      projectWorkstreams={workstreams}
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
