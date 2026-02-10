import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ReportsListContent } from "@/components/reports/ReportsListContent"
import { getReports } from "@/lib/actions/reports"
import { getCachedActiveOrgFromKV } from "@/lib/server-cache"
import { ReportsListSkeleton } from "@/components/skeletons"

export const metadata: Metadata = {
  title: "Reports - PMS",
}

async function ReportsList({ orgId }: { orgId: string }) {
  const result = await getReports(orgId)
  const reports = result.data || []
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
