import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getLiveOpsSnapshot } from "@/lib/actions/mission-control"
import { LiveOpsClient } from "@/components/mission-control/live-ops-client"

export const metadata: Metadata = {
  title: "Live Ops - PMS",
}

export default async function LiveOpsPage() {
  const { orgId } = await getPageOrganization()
  const result = await getLiveOpsSnapshot(orgId)
  return <LiveOpsClient orgId={orgId} initialLiveOps={result.data ?? null} />
}
