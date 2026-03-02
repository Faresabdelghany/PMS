"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Clock, Users, Wifi, WifiOff } from "lucide-react"
import { useGateway } from "@/hooks/gateway-context"
import { useSidebar } from "@/components/ui/sidebar"
import {
  LAST_EVENT_WARNING_THRESHOLD_MS,
  LATENCY_GREEN_THRESHOLD_MS,
  LATENCY_YELLOW_THRESHOLD_MS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

type GatewayStatusView = {
  label: string
  dotClassName: string
  Icon: typeof Wifi
}

const GATEWAY_STATUS_STYLES: Record<
  "not-configured" | "connecting" | "connected" | "disconnected" | "reconnecting",
  GatewayStatusView
> = {
  "not-configured": {
    label: "No Gateway Configured",
    dotClassName: "bg-muted-foreground/50",
    Icon: WifiOff,
  },
  connecting: {
    label: "Connecting...",
    dotClassName: "bg-[color:var(--chart-3)] animate-pulse",
    Icon: Wifi,
  },
  connected: {
    label: "Connected",
    dotClassName: "bg-[color:var(--chart-1)]",
    Icon: Wifi,
  },
  disconnected: {
    label: "Disconnected",
    dotClassName: "bg-destructive",
    Icon: WifiOff,
  },
  reconnecting: {
    label: "Reconnecting...",
    dotClassName: "bg-[color:var(--chart-3)] animate-pulse",
    Icon: Wifi,
  },
}

function getLatencyClassName(rtt: number): string {
  if (rtt < LATENCY_GREEN_THRESHOLD_MS) return "text-[color:var(--chart-1)]"
  if (rtt <= LATENCY_YELLOW_THRESHOLD_MS) return "text-[color:var(--chart-3)]"
  return "text-destructive"
}

function formatRelativeTime(diffMs: number): string {
  const seconds = Math.floor(diffMs / 1000)
  if (seconds <= 1) return "just now"
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function GatewayStatusBar() {
  const { gatewayStatus, rtt, lastEventAt, onlineAgentCount, totalAgentCount, activeSessionCount } =
    useGateway()
  const { state: sidebarState } = useSidebar()
  const [nowMs, setNowMs] = useState(() => Date.now())

  const statusView = GATEWAY_STATUS_STYLES[gatewayStatus]
  const showLatency = gatewayStatus === "connected" && typeof rtt === "number"

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const isLastEventStale = useMemo(() => {
    if (!lastEventAt) return false
    return nowMs - lastEventAt.getTime() > LAST_EVENT_WARNING_THRESHOLD_MS
  }, [lastEventAt, nowMs])

  const lastEventText = useMemo(() => {
    if (!lastEventAt) return "No events yet"
    const elapsedMs = Math.max(0, nowMs - lastEventAt.getTime())
    return `Last event: ${formatRelativeTime(elapsedMs)}`
  }, [lastEventAt, nowMs])

  if (sidebarState === "collapsed") {
    return (
      <div className="mb-2 flex items-center justify-center py-1">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", statusView.dotClassName)}
          aria-label={statusView.label}
          title={statusView.label}
        />
      </div>
    )
  }

  return (
    <div className="mb-2 rounded-md border border-border/40 bg-background/50 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusView.dotClassName)} />
        <statusView.Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-muted-foreground">{statusView.label}</span>
        {showLatency && (
          <span className={cn("ml-auto font-medium", getLatencyClassName(rtt))}>
            {Math.round(rtt)}ms
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div
          className={cn(
            "flex items-center gap-1",
            totalAgentCount > 0 && onlineAgentCount === 0 && "text-destructive"
          )}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>{onlineAgentCount}/{totalAgentCount} online</span>
        </div>

        <div className="flex items-center gap-1">
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span>{activeSessionCount} active</span>
        </div>
      </div>

      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-xs",
          isLastEventStale ? "text-amber-500" : "text-muted-foreground"
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>{lastEventText}</span>
      </div>
    </div>
  )
}
