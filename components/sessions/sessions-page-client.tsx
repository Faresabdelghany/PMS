"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { Timer } from "@phosphor-icons/react/dist/ssr/Timer"
import { Play } from "@phosphor-icons/react/dist/ssr/Play"
import { Pause } from "@phosphor-icons/react/dist/ssr/Pause"
import { Stop } from "@phosphor-icons/react/dist/ssr/Stop"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SessionDetailPanel } from "@/components/sessions/session-detail-panel"
import {
  getSessions,
  getSessionStats,
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

// ── Stats cards ─────────────────────────────────────────────────────

interface SessionStats {
  running: number
  blocked: number
  waiting: number
  completed: number
  total: number
}

function StatsCards({ stats }: { stats: SessionStats }) {
  const cards = [
    {
      label: "Running",
      value: stats.running,
      className: "text-emerald-600",
    },
    {
      label: "Blocked",
      value: stats.blocked,
      className: "text-red-600",
    },
    {
      label: "Waiting",
      value: stats.waiting,
      className: "text-amber-600",
    },
    {
      label: "Total",
      value: stats.total,
      className: "text-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-4 pb-4 px-4">
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className={`text-2xl font-semibold mt-1 ${card.className}`}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────

function SessionsTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 px-4">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-border">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

interface SessionsPageClientProps {
  orgId: string
}

export function SessionsPageClient({ orgId }: SessionsPageClientProps) {
  const [sessions, setSessions] = useState<AgentSessionWithAgent[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] =
    useState<AgentSessionWithAgent | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  // ── Fetch sessions and stats ────────────────────────────────────
  const fetchData = useCallback(() => {
    startTransition(async () => {
      const filters: { status?: SessionStatus; limit?: number } = {
        limit: 100,
      }
      if (statusFilter !== "all") {
        filters.status = statusFilter as SessionStatus
      }

      const [sessionsResult, statsResult] = await Promise.all([
        getSessions(orgId, filters),
        getSessionStats(orgId),
      ])

      if (sessionsResult.data) {
        setSessions(sessionsResult.data)
      }
      if (statsResult.data) {
        setStats(statsResult.data)
      }
      setLoading(false)
    })
  }, [orgId, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Client-side search filter ───────────────────────────────────
  const filteredSessions = sessions.filter((session) => {
    if (!search) return true
    const term = search.toLowerCase()
    const agentName = session.agent?.name?.toLowerCase() ?? ""
    const agentRole = session.agent?.role?.toLowerCase() ?? ""
    const taskTitle = session.task?.title?.toLowerCase() ?? ""
    return (
      agentName.includes(term) ||
      agentRole.includes(term) ||
      taskTitle.includes(term)
    )
  })

  // ── Handle session update from detail panel ─────────────────────
  const handleSessionUpdated = useCallback(() => {
    fetchData()
    setSelectedSession(null)
  }, [fetchData])

  // ── Render ──────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Sessions"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isPending}
          >
            <Timer className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        }
      >
        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agent or task..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-56 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {isPending && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Loading...
            </span>
          )}
        </div>
      </PageHeader>

      <div className="p-6 flex flex-col gap-6">
        {loading ? (
          <SessionsTableSkeleton />
        ) : (
          <>
            {/* Stats overview */}
            {stats && <StatsCards stats={stats} />}

            {/* Sessions table */}
            {filteredSessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Timer className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {sessions.length === 0
                      ? "No sessions yet. Sessions are created when agents start working on tasks."
                      : "No sessions match your filters."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px]">Agent</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[200px]">Task</TableHead>
                      <TableHead className="w-[140px]">Started</TableHead>
                      <TableHead className="w-[100px]">Duration</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Tokens
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => {
                      const statusConfig =
                        STATUS_CONFIG[session.status] ?? STATUS_CONFIG.completed
                      return (
                        <TableRow
                          key={session.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedSession(session)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-sm text-foreground">
                                {session.agent?.name ?? "Unknown Agent"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {session.agent?.role ?? ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusConfig.className}
                            >
                              {session.status === "running" && (
                                <Play
                                  weight="fill"
                                  className="h-3 w-3 mr-1"
                                />
                              )}
                              {session.status === "blocked" && (
                                <Stop
                                  weight="fill"
                                  className="h-3 w-3 mr-1"
                                />
                              )}
                              {session.status === "waiting" && (
                                <Pause
                                  weight="fill"
                                  className="h-3 w-3 mr-1"
                                />
                              )}
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate max-w-[180px] inline-block">
                              {session.task?.title ?? "No task linked"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(session.started_at),
                                { addSuffix: true }
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono text-muted-foreground">
                              {formatDuration(
                                session.started_at,
                                session.ended_at
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-mono text-muted-foreground">
                              {formatTokens(
                                session.input_tokens + session.output_tokens
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail panel slide-over */}
      <SessionDetailPanel
        session={selectedSession}
        orgId={orgId}
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null)
        }}
        onSessionUpdated={handleSessionUpdated}
      />
    </>
  )
}
