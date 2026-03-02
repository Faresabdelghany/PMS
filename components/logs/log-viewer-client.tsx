"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { getAgentLogs, getAgentLogStats } from "@/lib/actions/agent-logs"
import type { AgentLogWithAgent, LogLevel } from "@/lib/actions/agent-logs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Terminal } from "@phosphor-icons/react/dist/ssr/Terminal"
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { Info } from "@phosphor-icons/react/dist/ssr/Info"
import { Bug } from "@phosphor-icons/react/dist/ssr/Bug"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise"

// ── Constants ─────────────────────────────────────────────────────────
const LOG_PAGE_SIZE = 100
const ALL_LEVELS: LogLevel[] = ["error", "warn", "info", "debug"]

// ── Level styling ─────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<
  LogLevel,
  { label: string; className: string; textClass: string; icon: React.ElementType }
> = {
  error: {
    label: "ERROR",
    className: "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20",
    textClass: "text-red-500",
    icon: XCircle,
  },
  warn: {
    label: "WARN",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
    textClass: "text-amber-500",
    icon: Warning,
  },
  info: {
    label: "INFO",
    className: "border-blue-400/30 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20",
    textClass: "text-foreground",
    icon: Info,
  },
  debug: {
    label: "DEBUG",
    className: "border-muted-foreground/30 bg-muted/30 text-muted-foreground hover:bg-muted/50",
    textClass: "text-muted-foreground",
    icon: Bug,
  },
}

// ── Component ─────────────────────────────────────────────────────────
interface LogViewerClientProps {
  orgId: string
}

export function LogViewerClient({ orgId }: LogViewerClientProps) {
  const [logs, setLogs] = useState<AgentLogWithAgent[]>([])
  const [stats, setStats] = useState<{
    debug: number
    info: number
    warn: number
    error: number
    total: number
  }>({ debug: 0, info: 0, warn: 0, error: 0, total: 0 })
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(ALL_LEVELS))
  const [search, setSearch] = useState("")
  const [autoScroll, setAutoScroll] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [isPending, startTransition] = useTransition()

  const scrollRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch logs ────────────────────────────────────────────────────
  const fetchLogs = useCallback(
    (offset = 0, append = false) => {
      startTransition(async () => {
        const [logsResult, statsResult] = await Promise.all([
          getAgentLogs(orgId, {
            search: search || undefined,
            limit: LOG_PAGE_SIZE,
            offset,
          }),
          offset === 0 ? getAgentLogStats(orgId) : Promise.resolve(null),
        ])

        if (logsResult.data) {
          setLogs((prev) => (append ? [...logsResult.data!, ...prev] : logsResult.data!))
          setHasMore(logsResult.data.length >= LOG_PAGE_SIZE)
        }

        if (statsResult && "data" in statsResult && statsResult.data) {
          setStats(statsResult.data)
        }
      })
    },
    [orgId, search]
  )

  // ── Initial load + refetch on filter changes ──────────────────────
  useEffect(() => {
    fetchLogs(0)
  }, [fetchLogs])

  // ── Debounced search ──────────────────────────────────────────────
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        // fetchLogs will be called by the useEffect reacting to `search` change via `fetchLogs` dep
      }, 300)
    },
    []
  )

  // ── Auto-scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // ── Toggle level filter ───────────────────────────────────────────
  const toggleLevel = useCallback((level: LogLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  // ── Load more (older logs) ────────────────────────────────────────
  const loadMore = useCallback(() => {
    fetchLogs(logs.length, true)
  }, [fetchLogs, logs.length])

  // ── Filter logs by active levels (client-side) ────────────────────
  const filteredLogs = logs.filter((log) => activeLevels.has(log.level))

  // ── Format timestamp ──────────────────────────────────────────────
  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" weight="fill" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Errors (24h)</p>
              <p className="text-lg font-semibold text-foreground">{stats.error}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10">
              <Warning className="h-4 w-4 text-amber-500" weight="fill" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warnings (24h)</p>
              <p className="text-lg font-semibold text-foreground">{stats.warn}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total (24h)</p>
              <p className="text-lg font-semibold text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level toggles */}
        <div className="flex items-center gap-1.5">
          {ALL_LEVELS.map((level) => {
            const config = LEVEL_CONFIG[level]
            const isActive = activeLevels.has(level)
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  isActive ? config.className : "border-border bg-transparent text-muted-foreground opacity-50"
                }`}
              >
                <config.icon className="h-3 w-3" weight={isActive ? "fill" : "regular"} />
                {config.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Auto-scroll toggle */}
        <div className="flex items-center gap-2">
          <label htmlFor="auto-scroll" className="text-xs text-muted-foreground whitespace-nowrap">
            Auto-scroll
          </label>
          <Switch
            id="auto-scroll"
            checked={autoScroll}
            onCheckedChange={setAutoScroll}
          />
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchLogs(0)}
          disabled={isPending}
          className="h-8 px-2"
        >
          <ArrowClockwise className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Terminal log viewer */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Agent Logs</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredLogs.length} entries
          </span>
        </div>

        {/* Load more (older logs at top) */}
        {hasMore && filteredLogs.length > 0 && (
          <div className="flex justify-center border-b border-border/50 bg-muted/20 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              disabled={isPending}
              className="h-6 text-xs text-muted-foreground"
            >
              {isPending ? "Loading..." : "Load older logs"}
            </Button>
          </div>
        )}

        {/* Scrollable log area */}
        <div
          ref={scrollRef}
          className="overflow-y-auto bg-muted/30 p-3 font-mono text-sm"
          style={{ maxHeight: "calc(100vh - 420px)", minHeight: "300px" }}
        >
          {filteredLogs.length === 0 ? (
            <EmptyState isPending={isPending} hasSearch={!!search} />
          ) : (
            <div className="flex flex-col gap-0.5">
              {/* Logs are fetched newest-first; render reversed so oldest is at top */}
              {[...filteredLogs].reverse().map((log) => (
                <LogLine key={log.id} log={log} formatTimestamp={formatTimestamp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Log line ──────────────────────────────────────────────────────────
function LogLine({
  log,
  formatTimestamp,
}: {
  log: AgentLogWithAgent
  formatTimestamp: (dateStr: string) => string
}) {
  const config = LEVEL_CONFIG[log.level]
  const agentName = log.agent?.name ?? "unknown"

  return (
    <div className="flex items-start gap-0 leading-5 hover:bg-muted/40 rounded px-1 -mx-1 transition-colors">
      <span className="text-muted-foreground shrink-0 select-none">
        [{formatTimestamp(log.created_at)}]
      </span>
      <span className="text-blue-400 shrink-0 mx-1 select-none">
        [{agentName}]
      </span>
      <span className={`shrink-0 mr-1 font-semibold select-none ${config.textClass}`}>
        [{config.label}]
      </span>
      <span className={config.textClass}>{log.message}</span>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({
  isPending,
  hasSearch,
}: {
  isPending: boolean
  hasSearch: boolean
}) {
  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ArrowClockwise className="h-6 w-6 animate-spin mb-2" />
        <p className="text-sm">Loading logs...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Terminal className="h-8 w-8 mb-3 opacity-50" />
      <p className="text-sm font-medium">
        {hasSearch ? "No logs match your search" : "No agent logs yet"}
      </p>
      <p className="text-xs mt-1 opacity-70">
        {hasSearch
          ? "Try adjusting your search term or level filters"
          : "Logs will appear here as agents execute tasks"}
      </p>
    </div>
  )
}
