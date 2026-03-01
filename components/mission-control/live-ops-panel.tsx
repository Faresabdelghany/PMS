"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LiveOpsSnapshot } from "@/lib/actions/mission-control"
import { OpsStatusBadge } from "./ops-status-badge"

function formatElapsed(startedAt: string) {
  const elapsedMs = Date.now() - new Date(startedAt).getTime()
  const totalMins = Math.max(0, Math.floor(elapsedMs / 60000))
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

export function LiveOpsPanel({ snapshot }: { snapshot: LiveOpsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Live Ops data unavailable.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-3" data-testid="mc-live-ops">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Now Playing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.nowPlaying.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions right now.</p>
          )}
          {snapshot.nowPlaying.map((session) => (
            <div key={session.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{session.agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.taskSummary ?? session.taskName ?? "No task summary"}
                  </p>
                </div>
                <OpsStatusBadge status={session.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Started {formatElapsed(session.startedAt)} ago</span>
                <span>Heartbeat {new Date(session.heartbeatAt).toLocaleTimeString()}</span>
                {session.taskId && (
                  <Link
                    href={`/tasks?task=${session.taskId}`}
                    className="text-primary hover:underline inline-flex items-center min-h-[44px] sm:min-h-0"
                  >
                    Open task
                  </Link>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.queue.length === 0 && (
              <p className="text-sm text-muted-foreground">Queue is empty.</p>
            )}
            {snapshot.queue.map((item, index) => (
              <div key={item.taskId} className="rounded-md border border-border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{index + 1}. {item.taskName}</p>
                  <span className="text-xs text-muted-foreground">{item.priority}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.dependencies.length} dependencies</span>
                  <Link href={`/tasks?task=${item.taskId}`} className="text-primary hover:underline inline-flex items-center min-h-[44px] sm:min-h-0">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blockers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.blockers.length === 0 && (
              <p className="text-sm text-muted-foreground">No blockers detected.</p>
            )}
            {snapshot.blockers.map((blocker) => (
              <div key={blocker.sessionId} className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-sm">
                <p className="font-medium text-red-700 dark:text-red-400">{blocker.agentName}</p>
                <p className="text-xs text-muted-foreground">{blocker.reason}</p>
                {blocker.taskId && (
                  <Link href={`/tasks?task=${blocker.taskId}`} className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px] sm:min-h-0">
                    Open task
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

