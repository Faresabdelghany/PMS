import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getActivityFeed } from "@/lib/actions/activity"
import { getAgents } from "@/lib/actions/agents"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ActivityTimeline, ActivityTodayCount } from "@/components/activity/activity-timeline"

export const metadata: Metadata = {
  title: "Activity — PMS",
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string | string[]; date?: string | string[] }>
}) {
  const { orgId } = await getPageOrganization()
  const params = await searchParams
  const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId
  const date = Array.isArray(params.date) ? params.date[0] : params.date

  const activityPromise = getActivityFeed(orgId, {
    agentId: agentId || undefined,
    date: date || undefined,
    limit: 100,
  })
  const agentsPromise = getAgents(orgId)

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Activity" />
      <div className="p-6 flex flex-col gap-6">
        <Suspense fallback={<PageSkeleton />}>
          <ActivityContent
            activityPromise={activityPromise}
            agentsPromise={agentsPromise}
            currentAgentId={agentId}
            currentDate={date}
          />
        </Suspense>
      </div>
    </div>
  )
}

async function ActivityContent({
  activityPromise,
  agentsPromise,
  currentAgentId,
  currentDate,
}: {
  activityPromise: ReturnType<typeof getActivityFeed>
  agentsPromise: ReturnType<typeof getAgents>
  currentAgentId?: string
  currentDate?: string
}) {
  const [activityResult, agentsResult] = await Promise.all([activityPromise, agentsPromise])

  const activities = activityResult.data || []
  const agents = agentsResult.data || []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter by agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Link href={buildActivityHref(undefined, currentDate)}>
              <Badge variant={!currentAgentId ? "default" : "outline"} className="cursor-pointer px-3 py-1.5">
                All Agents
              </Badge>
            </Link>
            {agents.map((agent) => (
              <Link key={agent.id} href={buildActivityHref(agent.id, currentDate)}>
                <Badge
                  variant={currentAgentId === agent.id ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5"
                >
                  {agent.name}
                </Badge>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border bg-muted/40 px-2 py-1">{activities.length} events</span>
            <ActivityTodayCount activities={activities} />
            {currentAgentId && <span className="rounded-md border bg-muted/40 px-2 py-1">Filtered view</span>}
          </div>
        </CardContent>
      </Card>

      {/* Timeline — rendered client-side for correct user timezone */}
      <ActivityTimeline activities={activities} />
    </div>
  )
}

function buildActivityHref(agentId?: string, date?: string) {
  const params = new URLSearchParams()

  if (agentId) params.set("agentId", agentId)
  if (date) params.set("date", date)

  const query = params.toString()
  return query ? `/activity?${query}` : "/activity"
}
