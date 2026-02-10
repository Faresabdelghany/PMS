import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getReport } from "@/lib/actions/reports"
import { ReportDetailContent } from "@/components/reports/ReportDetailContent"
import { ReportDetailSkeleton } from "@/components/skeletons"

export const metadata: Metadata = {
  title: "Report - PMS",
}

type PageProps = { params: Promise<{ id: string }> }

async function ReportDetail({ reportId }: { reportId: string }) {
  const result = await getReport(reportId)

  if (result.error || !result.data) {
    notFound()
  }

  return <ReportDetailContent report={result.data} />
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<ReportDetailSkeleton />}>
      <ReportDetail reportId={id} />
    </Suspense>
  )
}
