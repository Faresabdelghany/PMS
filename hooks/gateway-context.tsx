"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { getGatewayConnectionInfo } from "@/lib/actions/gateways"
import { getStatusBarCounts } from "@/lib/actions/agents"
import { useGatewayWebSocket } from "@/hooks/use-gateway-websocket"
import { usePooledRealtime } from "@/hooks/realtime-context"
import type { GatewayRequest } from "@/lib/types/gateway"

type GatewayStatus = "not-configured" | "connecting" | "connected" | "disconnected" | "reconnecting"

type GatewayStatusContextValue = {
  gatewayStatus: GatewayStatus
  rtt: number | null
  lastEventAt: Date | null
  error: string | null
  onlineAgentCount: number
  totalAgentCount: number
  activeSessionCount: number
}

type GatewayActionsContextValue = {
  sendCommand: (agentId: string, command: string, payload?: Record<string, unknown>) => void
  reconnect: () => void
}

const GatewayStatusContext = createContext<GatewayStatusContextValue | null>(null)
const GatewayActionsContext = createContext<GatewayActionsContextValue | null>(null)

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function GatewayProvider({
  children,
  orgId,
}: {
  children: ReactNode
  orgId: string
}) {
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null)
  const [gatewayToken, setGatewayToken] = useState<string | null>(null)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [onlineAgentCount, setOnlineAgentCount] = useState(0)
  const [totalAgentCount, setTotalAgentCount] = useState(0)
  const [activeSessionCount, setActiveSessionCount] = useState(0)
  const [realtimeLastEventAt, setRealtimeLastEventAt] = useState<Date | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadGatewayConnectionInfo() {
      setIsLoadingConfig(true)
      setConfigError(null)

      const result = await getGatewayConnectionInfo(orgId)
      if (!isActive) return

      if (result.error) {
        setConfigError(result.error)
        setGatewayUrl(null)
        setGatewayToken(null)
        setIsLoadingConfig(false)
        return
      }

      if (!result.data) {
        setGatewayUrl(null)
        setGatewayToken(null)
        setIsLoadingConfig(false)
        return
      }

      setGatewayUrl(result.data.url)
      setGatewayToken(result.data.token)
      setIsLoadingConfig(false)
    }

    void loadGatewayConnectionInfo()

    return () => {
      isActive = false
    }
  }, [orgId])

  const fetchCounts = useCallback(async () => {
    const result = await getStatusBarCounts(orgId)
    if (result.error || !result.data) {
      setOnlineAgentCount(0)
      setTotalAgentCount(0)
      setActiveSessionCount(0)
      return
    }

    setOnlineAgentCount(result.data.onlineAgents)
    setTotalAgentCount(result.data.totalAgents)
    setActiveSessionCount(result.data.activeSessions)
  }, [orgId])

  useEffect(() => {
    void fetchCounts()
  }, [fetchCounts])

  const markRealtimeEvent = useCallback(() => {
    const now = new Date()
    setRealtimeLastEventAt((previous) => {
      if (!previous) return now
      return now.getTime() > previous.getTime() ? now : previous
    })
  }, [])

  const debouncedFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedFetchCounts = useCallback(() => {
    if (debouncedFetchTimerRef.current) {
      clearTimeout(debouncedFetchTimerRef.current)
    }
    debouncedFetchTimerRef.current = setTimeout(() => {
      debouncedFetchTimerRef.current = null
      void fetchCounts()
    }, 500)
  }, [fetchCounts])

  useEffect(() => {
    return () => {
      if (debouncedFetchTimerRef.current) {
        clearTimeout(debouncedFetchTimerRef.current)
      }
    }
  }, [])

  const handleRealtimeChange = useCallback(() => {
    markRealtimeEvent()
    debouncedFetchCounts()
  }, [debouncedFetchCounts, markRealtimeEvent])

  usePooledRealtime({
    table: "agents",
    filter: `organization_id=eq.${orgId}`,
    enabled: Boolean(orgId),
    onInsert: handleRealtimeChange,
    onUpdate: handleRealtimeChange,
    onDelete: handleRealtimeChange,
  })

  usePooledRealtime({
    table: "agent_sessions" as any,
    filter: `organization_id=eq.${orgId}`,
    enabled: Boolean(orgId),
    onInsert: handleRealtimeChange,
    onUpdate: handleRealtimeChange,
    onDelete: handleRealtimeChange,
  })

  const gatewayWebSocket = useGatewayWebSocket({
    url: gatewayUrl,
    token: gatewayToken,
    enabled: Boolean(gatewayUrl),
  })

  const gatewayStatus = useMemo<GatewayStatus>(() => {
    if (isLoadingConfig) return "connecting"
    if (!gatewayUrl) return "not-configured"

    if (gatewayWebSocket.status === "connected") return "connected"
    if (gatewayWebSocket.status === "connecting") return "connecting"
    if (gatewayWebSocket.status === "reconnecting") return "reconnecting"
    return "disconnected"
  }, [gatewayUrl, gatewayWebSocket.status, isLoadingConfig])

  const mergedLastEventAt = useMemo(() => {
    const socketLastEventAt = gatewayWebSocket.lastEventAt
    if (!socketLastEventAt) return realtimeLastEventAt
    if (!realtimeLastEventAt) return socketLastEventAt
    return socketLastEventAt.getTime() >= realtimeLastEventAt.getTime()
      ? socketLastEventAt
      : realtimeLastEventAt
  }, [gatewayWebSocket.lastEventAt, realtimeLastEventAt])

  const statusValue = useMemo<GatewayStatusContextValue>(
    () => ({
      gatewayStatus,
      rtt: gatewayWebSocket.rtt,
      lastEventAt: mergedLastEventAt,
      error: configError ?? gatewayWebSocket.error,
      onlineAgentCount,
      totalAgentCount,
      activeSessionCount,
    }),
    [
      activeSessionCount,
      configError,
      gatewayStatus,
      gatewayWebSocket.error,
      gatewayWebSocket.rtt,
      mergedLastEventAt,
      onlineAgentCount,
      totalAgentCount,
    ]
  )

  const sendCommand = useCallback(
    (agentId: string, command: string, payload: Record<string, unknown> = {}) => {
      if (gatewayStatus !== "connected") {
        console.error("[Gateway] Cannot send command while disconnected", {
          command,
          agentId,
          gatewayStatus,
        })
        return
      }

      const frame: GatewayRequest = {
        type: "req",
        id: createRequestId(),
        method: `agent.${command}`,
        params: { agentId, ...payload },
      }

      gatewayWebSocket.send(frame)
    },
    [gatewayStatus, gatewayWebSocket]
  )

  const actionsValue = useMemo<GatewayActionsContextValue>(
    () => ({
      sendCommand,
      reconnect: gatewayWebSocket.reconnect,
    }),
    [gatewayWebSocket.reconnect, sendCommand]
  )

  return (
    <GatewayActionsContext.Provider value={actionsValue}>
      <GatewayStatusContext.Provider value={statusValue}>
        {children}
      </GatewayStatusContext.Provider>
    </GatewayActionsContext.Provider>
  )
}

export function useGateway() {
  const statusContext = useContext(GatewayStatusContext)
  const actionsContext = useContext(GatewayActionsContext)

  if (!statusContext || !actionsContext) {
    throw new Error("useGateway must be used within a GatewayProvider")
  }

  return { ...statusContext, ...actionsContext }
}
