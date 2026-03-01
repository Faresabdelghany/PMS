import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgentCalendarWeek } from "@/lib/actions/mission-control"
import { AgentCalendarClient } from "@/components/mission-control/agent-calendar-client"

export const metadata: Metadata = {
  title: "Agent Calendar - PMS",
}

export default async function AgentCalendarPage() {
  const { orgId } = await getPageOrganization()
  const result = await getAgentCalendarWeek(orgId)
  return <AgentCalendarClient orgId={orgId} initialCalendar={result.data ?? null} />
}
