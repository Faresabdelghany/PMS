import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Pulse } from "@phosphor-icons/react/dist/ssr/Pulse"
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { getPageOrganization } from "@/lib/page-auth"
import { getActivityFeed } from "@/lib/actions/activity"
import { getAgents } from "@/lib/actions/agents"
import { cn } from "@/lib/utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Activity — PMS",
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
  const groupedActivities = groupActivitiesByDate(activities)

  const todayCount = activities.filter((activity) => isSameDay(activity.created_at, new Date())).length

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
            <span className="rounded-md border bg-muted/40 px-2 py-1">{todayCount} today</span>
            {currentAgentId && <span className="rounded-md border bg-muted/40 px-2 py-1">Filtered view</span>}
          </div>
        </CardContent>
      </Card>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Pulse className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No activity yet. Agents will appear here once they start working.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupedActivities.map((group) => (
              <section key={group.dateKey} className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="relative space-y-1 pl-8">
                  <div className="absolute bottom-2 left-[11px] top-2 w-px bg-border" />

                  {group.items.map((activity) => {
                    const visual = getActivityVisual(activity.activity_type)

                    return (
                      <article
                        key={activity.id}
                        className="relative rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-muted/30"
                      >
                        <div
                          className={cn(
                            "absolute left-[-24px] top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border bg-background",
                            visual.dotClass,
                          )}
                        >
                          {visual.icon}
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{activity.agent?.name || "Unknown Agent"}</span>
                              <Badge variant="secondary" className="text-[11px] leading-4">
                                {activity.activity_type}
                              </Badge>
                            </div>
                            <p className="text-sm leading-snug">{activity.title}</p>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{activity.description}</p>
                            )}
                          </div>

                          <time className="shrink-0 text-right text-xs text-muted-foreground" dateTime={activity.created_at}>
                            <span className="block">{formatActivityTime(activity.created_at)}</span>
                            <span className="block text-[11px] text-muted-foreground/80">{formatRelativeTime(activity.created_at)}</span>
                          </time>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      )}
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

function formatActivityTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelativeTime(timestamp: string) {
  const createdAt = new Date(timestamp)
  const diffMs = Date.now() - createdAt.getTime()
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function isSameDay(left: string, right: Date) {
  const leftDate = new Date(left)

  return (
    leftDate.getFullYear() === right.getFullYear() &&
    leftDate.getMonth() === right.getMonth() &&
    leftDate.getDate() === right.getDate()
  )
}

function groupActivitiesByDate<T extends { created_at: string }>(
  activities: T[],
): Array<{ dateKey: string; label: string; items: T[] }> {
  const grouped = new Map<string, { label: string; items: T[] }>()

  for (const activity of activities) {
    const date = new Date(activity.created_at)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        label: date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        items: [],
      })
    }

    grouped.get(dateKey)?.items.push(activity)
  }

  return [...grouped.entries()].map(([dateKey, value]) => ({
    dateKey,
    label: value.label,
    items: value.items,
  }))
}

function getActivityVisual(activityType: string) {
  const normalizedType = activityType.toLowerCase()

  if (normalizedType.includes("error") || normalizedType.includes("fail")) {
    return {
      dotClass: "border-red-500/40 text-red-500",
      icon: <WarningCircle className="h-3.5 w-3.5" weight="fill" />,
    }
  }

  if (normalizedType.includes("complete") || normalizedType.includes("done") || normalizedType.includes("success")) {
    return {
      dotClass: "border-emerald-500/40 text-emerald-500",
      icon: <CheckCircle className="h-3.5 w-3.5" weight="fill" />,
    }
  }

  if (normalizedType.includes("create") || normalizedType.includes("start")) {
    return {
      dotClass: "border-blue-500/40 text-blue-500",
      icon: <Sparkle className="h-3.5 w-3.5" weight="fill" />,
    }
  }

  return {
    dotClass: "border-primary/40 text-primary",
    icon: <Clock className="h-3.5 w-3.5" weight="fill" />,
  }
}
