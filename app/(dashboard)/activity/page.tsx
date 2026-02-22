import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getActivityFeed } from "@/lib/actions/activity"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export const metadata: Metadata = {
  title: "Activity - PMS",
}

const TYPE_COLORS: Record<string, string> = {
  task_created: "bg-blue-500/10 text-blue-600",
  task_completed: "bg-emerald-500/10 text-emerald-600",
  code_review: "bg-violet-500/10 text-violet-600",
  deployment: "bg-amber-500/10 text-amber-600",
  security_scan: "bg-red-500/10 text-red-600",
  report: "bg-cyan-500/10 text-cyan-600",
}

export default async function ActivityPage() {
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Timeline of all agent actions and system events
        </p>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <ActivityContent orgId={orgId} />
      </Suspense>
    </div>
  )
}

async function ActivityContent({ orgId }: { orgId: string }) {
  const result = await getActivityFeed(orgId)
  const activities = result.data || []

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No activity yet. Agent actions will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className="flex gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          {/* Timeline dot */}
          <div className="flex flex-col items-center pt-1">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            {index < activities.length - 1 && (
              <div className="mt-1 w-px flex-1 bg-border" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-sm">{activity.agent_name}</span>
              <span className="text-xs text-muted-foreground">{activity.agent_role}</span>
              <Badge
                variant="secondary"
                className={`text-xs ${TYPE_COLORS[activity.activity_type] || "bg-muted"}`}
              >
                {activity.activity_type.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm">{activity.title}</p>
            {activity.description && (
              <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
            )}
            <p className="text-xs text-muted-foreground/60 mt-2">
              {new Date(activity.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
