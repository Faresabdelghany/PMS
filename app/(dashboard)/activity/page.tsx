import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getActivityFeed } from "@/lib/actions/activity"
import { getAgents } from "@/lib/actions/agents"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Badge } from "@/components/ui/badge"
import { Pulse } from "@phosphor-icons/react/dist/ssr/Pulse"

export const metadata: Metadata = {
  title: "Activity - PMS",
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string; date?: string }>
}) {
  const { orgId } = await getPageOrganization()
  const { agentId, date } = await searchParams

  const activityPromise = getActivityFeed(orgId, {
    agentId: agentId || undefined,
    date: date || undefined,
    limit: 100,
  })
  const agentsPromise = getAgents(orgId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Pulse className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground">Timeline of all agent activities across your organization</p>
        </div>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <ActivityContent
          activityPromise={activityPromise}
          agentsPromise={agentsPromise}
          currentAgentId={agentId}
          currentDate={date}
        />
      </Suspense>
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
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Filter by agent:</span>
        <a href="/activity">
          <Badge variant={!currentAgentId ? "default" : "outline"} className="cursor-pointer">
            All Agents
          </Badge>
        </a>
        {agents.map((agent) => (
          <a key={agent.id} href={`/activity?agentId=${agent.id}`}>
            <Badge
              variant={currentAgentId === agent.id ? "default" : "outline"}
              className="cursor-pointer"
            >
              {agent.name}
            </Badge>
          </a>
        ))}
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Pulse className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No activity yet. Agents will appear here once they start working.</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            {activities.map((activity, idx) => {
              const isFirst = idx === 0
              const prevActivity = idx > 0 ? activities[idx - 1] : null
              const currDate = new Date(activity.created_at).toLocaleDateString()
              const prevDate = prevActivity ? new Date(prevActivity.created_at).toLocaleDateString() : null
              const showDateSeparator = isFirst || currDate !== prevDate

              return (
                <div key={activity.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 py-3">
                      <div className="relative z-10 ml-[1.125rem] flex h-3 w-3 items-center justify-center" />
                      <span className="text-xs font-medium text-muted-foreground bg-background px-2">
                        {new Date(activity.created_at).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="flex items-start gap-4 py-3 pl-4 pr-2 rounded-lg hover:bg-muted/40 transition-colors">
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{activity.agent?.name || "Unknown Agent"}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {activity.activity_type}
                        </Badge>
                      </div>
                      <p className="text-sm mt-0.5">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(activity.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
