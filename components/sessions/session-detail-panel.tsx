"use client"

import { useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { Play } from "@phosphor-icons/react/dist/ssr/Play"
import { Pause } from "@phosphor-icons/react/dist/ssr/Pause"
import { Stop } from "@phosphor-icons/react/dist/ssr/Stop"
import { Timer } from "@phosphor-icons/react/dist/ssr/Timer"
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  terminateSession,
  updateSessionStatus,
  type AgentSessionWithAgent,
  type SessionStatus,
} from "@/lib/actions/sessions"

// ── Status badge config ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; className: string }
> = {
  running: {
    label: "Running",
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
  },
  blocked: {
    label: "Blocked",
    className: "bg-red-500/15 text-red-600 border-red-500/25",
  },
  waiting: {
    label: "Waiting",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/25",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground border-border",
  },
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffMs = end - start

  if (diffMs < 0) return "0s"

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return count.toString()
}

// ── Metric row ──────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm text-foreground ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

interface SessionDetailPanelProps {
  session: AgentSessionWithAgent | null
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSessionUpdated: () => void
}

export function SessionDetailPanel({
  session,
  orgId,
  open,
  onOpenChange,
  onSessionUpdated,
}: SessionDetailPanelProps) {
  const [isPending, startTransition] = useTransition()

  if (!session) return null

  const statusConfig = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.completed
  const isBlocked = session.status === "blocked"

  const handlePause = () => {
    startTransition(async () => {
      const result = await updateSessionStatus(orgId, session.id, "waiting")
      if (!result.error) {
        onSessionUpdated()
      }
    })
  }

  const handleResume = () => {
    startTransition(async () => {
      const result = await updateSessionStatus(orgId, session.id, "running")
      if (!result.error) {
        onSessionUpdated()
      }
    })
  }

  const handleTerminate = () => {
    startTransition(async () => {
      const result = await terminateSession(orgId, session.id)
      if (!result.error) {
        onSessionUpdated()
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg">
              {session.agent?.name ?? "Unknown Agent"}
            </SheetTitle>
            <Badge variant="outline" className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          </div>
          <SheetDescription>
            {session.agent?.role ?? "Agent session details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          {/* Task info */}
          {session.task && (
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Linked Task
                </p>
                <p className="text-sm text-foreground font-medium">
                  {session.task.name}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metrics */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Metrics
            </p>
            <div className="rounded-lg border border-border px-4">
              <MetricRow
                label="Started"
                value={formatDistanceToNow(new Date(session.started_at), {
                  addSuffix: true,
                })}
              />
              <Separator />
              <MetricRow
                label="Duration"
                value={formatDuration(session.started_at, session.ended_at)}
                mono
              />
              <Separator />
              <MetricRow
                label="Input Tokens"
                value={formatTokens(session.input_tokens)}
                mono
              />
              <Separator />
              <MetricRow
                label="Output Tokens"
                value={formatTokens(session.output_tokens)}
                mono
              />
              <Separator />
              <MetricRow
                label="Total Tokens"
                value={formatTokens(
                  session.input_tokens + session.output_tokens
                )}
                mono
              />
              {session.ended_at && (
                <>
                  <Separator />
                  <MetricRow
                    label="Ended"
                    value={formatDistanceToNow(new Date(session.ended_at), {
                      addSuffix: true,
                    })}
                  />
                </>
              )}
            </div>
          </div>

          {/* Blocker reason */}
          {isBlocked && session.blocker_reason && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Blocker
              </p>
              <Card className="border-red-500/25 bg-red-500/5">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-start gap-2">
                    <Warning
                      weight="fill"
                      className="h-4 w-4 text-red-500 mt-0.5 shrink-0"
                    />
                    <p className="text-sm text-red-600">
                      {session.blocker_reason}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error message */}
          {session.error_msg && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Error
              </p>
              <Card className="border-red-500/25 bg-red-500/5">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-start gap-2">
                    <Warning
                      weight="fill"
                      className="h-4 w-4 text-red-500 mt-0.5 shrink-0"
                    />
                    <p className="text-sm text-red-600 font-mono break-all">
                      {session.error_msg}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Control buttons */}
          {session.status !== "completed" && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Controls
              </p>
              <div className="flex items-center gap-2">
                {session.status === "running" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePause}
                    disabled={isPending}
                  >
                    <Pause weight="fill" className="h-4 w-4 mr-1.5" />
                    Pause
                  </Button>
                )}

                {(session.status === "waiting" || isBlocked) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResume}
                    disabled={isPending}
                  >
                    <Play weight="fill" className="h-4 w-4 mr-1.5" />
                    Resume
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/25"
                  onClick={handleTerminate}
                  disabled={isPending}
                >
                  <Stop weight="fill" className="h-4 w-4 mr-1.5" />
                  Terminate
                </Button>

                {isPending && (
                  <ArrowsClockwise className="h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
            </div>
          )}

          {/* Session ID (subtle) */}
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] text-muted-foreground/60 font-mono truncate">
              Session: {session.id}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
