import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getApprovals } from "@/lib/actions/approvals"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { ApprovalsClient } from "./approvals-client"

export const metadata: Metadata = {
  title: "Approvals - PMS",
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { orgId } = await getPageOrganization()
  const { status } = await searchParams

  const validStatus = (status === "pending" || status === "approved" || status === "rejected") ? status : undefined

  const approvalsResult = await getApprovals(orgId, validStatus as any)

  const approvals = approvalsResult.data || []

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Approvals"
      />
      <div className="p-6 flex flex-col gap-6">
        <Suspense fallback={<PageSkeleton />}>
          <ApprovalsClient approvals={approvals} currentStatus={validStatus} />
        </Suspense>
      </div>
    </div>
  )
}
