import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgentCalendarWeek, getLiveOpsSnapshot } from "@/lib/actions/mission-control"
import { MissionControlClient } from "@/components/mission-control/mission-control-client"

export const metadata: Metadata = {
  title: "Mission Control - PMS",
}

export default async function MissionControlPage() {
  const { orgId } = await getPageOrganization()
  const [liveOpsResult, calendarResult] = await Promise.all([
    getLiveOpsSnapshot(orgId),
    getAgentCalendarWeek(orgId),
  ])

  return (
    <MissionControlClient
      orgId={orgId}
      initialLiveOps={liveOpsResult.data ?? null}
      initialCalendar={calendarResult.data ?? null}
    />
  )
}

