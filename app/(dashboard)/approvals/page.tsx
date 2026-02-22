import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getApprovals } from "@/lib/actions/approvals"
import { PageSkeleton } from "@/components/ui/page-skeleton"
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review and act on agent approval requests</p>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <ApprovalsClient approvals={approvals} currentStatus={validStatus} />
      </Suspense>
    </div>
  )
}
