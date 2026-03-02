"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  GatewayEvent,
  GatewayFrame,
  GatewayRequest,
  GatewayResponse,
} from "@/lib/types/gateway"
import {
  GATEWAY_HEARTBEAT_INTERVAL_MS,
  GATEWAY_MISSED_PONG_THRESHOLD,
  GATEWAY_RECONNECT_DELAYS_MS,
} from "@/lib/constants"

type GatewayWebSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"

type GatewayWebSocketState = {
  status: GatewayWebSocketStatus
  rtt: number | null
  lastEventAt: Date | null
  error: string | null
}

type GatewayWebSocketActions = {
  send: (frame: GatewayRequest) => void
  reconnect: () => void
  disconnect: () => void
}

type UseGatewayWebSocketConfig = {
  url: string | null
  token: string | null
  onEvent?: (event: GatewayEvent) => void
  onResponse?: (response: GatewayResponse) => void
  enabled?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseGatewayFrame(raw: string): GatewayFrame | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return null
    }

    if (parsed.type === "res" && typeof parsed.id === "string") {
      return parsed as unknown as GatewayResponse
    }

    if (parsed.type === "event" && typeof parsed.method === "string") {
      return parsed as unknown as GatewayEvent
    }

    return null
  } catch {
    return null
  }
}

function buildSocketUrl(baseUrl: string, token: string | null): string {
  if (!token) return baseUrl

  try {
    const parsed = new URL(baseUrl)
    parsed.searchParams.set("token", token)
    return parsed.toString()
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?"
    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`
  }
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function warnMalformedFrame(raw: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[GatewayWS] Ignoring malformed frame:", raw)
  }
}

function isGatewayDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_GATEWAY_WS_DEBUG === "1") return true
  if (typeof window === "undefined") return false

  try {
    const debugFlag = window.localStorage.getItem("pms.gateway.debug")
    return debugFlag === "1" || debugFlag?.toLowerCase() === "true"
  } catch {
    return false
  }
}

function logGatewayDebug(enabled: boolean, message: string, data?: unknown) {
  if (!enabled) return
  if (typeof data === "undefined") {
    console.log(`[GatewayWS][debug] ${message}`)
    return
  }
  console.log(`[GatewayWS][debug] ${message}`, data)
}

function isAuthErrorMessage(message: string | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes("auth") ||
    normalized.includes("token") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  )
}

function isAuthResponseError(error: GatewayResponse["error"] | undefined): boolean {
  if (!error) return false
  return error.code === 401 || error.code === 403 || isAuthErrorMessage(error.message)
}

function isAuthCloseEvent(event: CloseEvent): boolean {
  return (
    event.code === 1008 ||
    event.code === 4001 ||
    event.code === 4401 ||
    event.code === 4403 ||
    isAuthErrorMessage(event.reason)
  )
}

export function useGatewayWebSocket({
  url,
  token,
  onEvent,
  onResponse,
  enabled,
}: UseGatewayWebSocketConfig): GatewayWebSocketState & GatewayWebSocketActions {
  const resolvedEnabled = enabled ?? Boolean(url)

  const [status, setStatus] = useState<GatewayWebSocketStatus>("idle")
  const [rtt, setRtt] = useState<number | null>(null)
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const missedPongsRef = useRef(0)
  const pendingPingsRef = useRef<Map<string, number>>(new Map())
  const manualDisconnectRef = useRef(false)
  const authFailedRef = useRef(false)
  const debugEnabledRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})
  const configRef = useRef<{ url: string | null; token: string | null; enabled: boolean }>({
    url,
    token,
    enabled: resolvedEnabled,
  })
  const onEventRef = useRef(onEvent)
  const onResponseRef = useRef(onResponse)

  useEffect(() => {
    configRef.current = { url, token, enabled: resolvedEnabled }
  }, [url, token, resolvedEnabled])

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    onResponseRef.current = onResponse
  }, [onResponse])

  useEffect(() => {
    debugEnabledRef.current = isGatewayDebugEnabled()
    logGatewayDebug(
      debugEnabledRef.current,
      `Debug logging enabled for gateway websocket (${configRef.current.url ?? "no-url"})`
    )
  }, [])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    pendingPingsRef.current.clear()
    missedPongsRef.current = 0
  }, [])

  const scheduleReconnect = useCallback(() => {
    const { url: currentUrl, enabled: isEnabled } = configRef.current
    if (!currentUrl || !isEnabled || manualDisconnectRef.current || authFailedRef.current) return

    clearReconnectTimer()

    const delayIndex = Math.min(
      reconnectAttemptRef.current,
      GATEWAY_RECONNECT_DELAYS_MS.length - 1
    )
    const delay = GATEWAY_RECONNECT_DELAYS_MS[delayIndex]
    reconnectAttemptRef.current += 1
    setStatus("reconnecting")
    logGatewayDebug(debugEnabledRef.current, `Scheduling reconnect in ${delay}ms`)

    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current()
    }, delay)
  }, [clearReconnectTimer])

  const sendPing = useCallback(() => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    if (pendingPingsRef.current.size > 0) {
      missedPongsRef.current += 1
    }

    if (missedPongsRef.current >= GATEWAY_MISSED_PONG_THRESHOLD) {
      setError("Gateway heartbeat timeout")
      setStatus("disconnected")
      socket.close()
      return
    }

    const pingId = createRequestId()
    pendingPingsRef.current.set(pingId, Date.now())

    const pingFrame: GatewayRequest = {
      type: "req",
      id: pingId,
      method: "ping",
    }

    logGatewayDebug(debugEnabledRef.current, "Outbound frame", pingFrame)
    socket.send(JSON.stringify(pingFrame))
  }, [])

  const connect = useCallback(() => {
    const { url: currentUrl, token: currentToken, enabled: isEnabled } = configRef.current
    if (!currentUrl || !isEnabled || manualDisconnectRef.current) return

    const existingSocket = wsRef.current
    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    clearReconnectTimer()
    clearHeartbeat()

    setStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting")

    let socket: WebSocket
    try {
      logGatewayDebug(debugEnabledRef.current, "Connecting websocket", { url: currentUrl })
      socket = new WebSocket(buildSocketUrl(currentUrl, currentToken))
    } catch {
      setError("Invalid gateway WebSocket URL")
      setStatus("disconnected")
      scheduleReconnect()
      return
    }

    wsRef.current = socket

    socket.onopen = () => {
      reconnectAttemptRef.current = 0
      missedPongsRef.current = 0
      pendingPingsRef.current.clear()
      setError(null)
      setStatus("connected")
      logGatewayDebug(debugEnabledRef.current, "WebSocket connected")

      sendPing()
      heartbeatIntervalRef.current = setInterval(sendPing, GATEWAY_HEARTBEAT_INTERVAL_MS)
    }

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        logGatewayDebug(debugEnabledRef.current, "Inbound raw frame", event.data)
      }
      const frame = parseGatewayFrame(event.data)

      if (!frame) {
        warnMalformedFrame(event.data)
        return
      }
      logGatewayDebug(debugEnabledRef.current, "Inbound parsed frame", frame)

      if (frame.type === "event") {
        const now = new Date()
        setLastEventAt(now)
        onEventRef.current?.(frame)
        return
      }

      if (isAuthResponseError(frame.error)) {
        authFailedRef.current = true
        manualDisconnectRef.current = true
        clearReconnectTimer()
        clearHeartbeat()
        setError("Auth Failed")
        setStatus("disconnected")
        socket.close(1008, "Auth failed")
        return
      }

      const pingSentAt = pendingPingsRef.current.get(frame.id)
      if (typeof pingSentAt === "number") {
        pendingPingsRef.current.delete(frame.id)
        missedPongsRef.current = 0
        setRtt(Date.now() - pingSentAt)
      }

      onResponseRef.current?.(frame)
    }

    socket.onerror = () => {
      setError("Gateway connection error")
      logGatewayDebug(debugEnabledRef.current, "WebSocket error event")
    }

    socket.onclose = (event) => {
      wsRef.current = null
      clearHeartbeat()
      setStatus("disconnected")
      logGatewayDebug(debugEnabledRef.current, "WebSocket closed", {
        code: event.code,
        reason: event.reason || "(none)",
        wasClean: event.wasClean,
      })

      if (isAuthCloseEvent(event) || authFailedRef.current) {
        authFailedRef.current = true
        setError("Auth Failed")
        return
      }

      if (!manualDisconnectRef.current) {
        scheduleReconnect()
      }
    }
  }, [clearHeartbeat, clearReconnectTimer, scheduleReconnect, sendPing])

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true
    clearReconnectTimer()
    clearHeartbeat()
    logGatewayDebug(debugEnabledRef.current, "Manual disconnect requested")

    const socket = wsRef.current
    if (
      socket &&
      (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
    ) {
      socket.close(1000, "Client disconnect")
    }
    wsRef.current = null
    setStatus("disconnected")
  }, [clearHeartbeat, clearReconnectTimer])

  const reconnect = useCallback(() => {
    manualDisconnectRef.current = false
    authFailedRef.current = false
    reconnectAttemptRef.current = 0
    setError(null)
    clearReconnectTimer()
    clearHeartbeat()
    logGatewayDebug(debugEnabledRef.current, "Manual reconnect requested")

    const socket = wsRef.current
    if (
      socket &&
      (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
    ) {
      socket.close(1000, "Client reconnect")
    }
    wsRef.current = null
    connectRef.current()
  }, [clearHeartbeat, clearReconnectTimer])

  const send = useCallback((frame: GatewayRequest) => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Gateway is not connected")
      logGatewayDebug(debugEnabledRef.current, "Send blocked (socket not connected)", frame)
      return
    }

    logGatewayDebug(debugEnabledRef.current, "Outbound frame", frame)
    socket.send(JSON.stringify(frame))
  }, [])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    if (!resolvedEnabled || !url) {
      authFailedRef.current = false
      disconnect()
      setStatus("idle")
      setRtt(null)
      setError(null)
      return
    }

    manualDisconnectRef.current = false
    authFailedRef.current = false
    reconnectAttemptRef.current = 0
    connectRef.current()

    return () => {
      manualDisconnectRef.current = true
      clearReconnectTimer()
      clearHeartbeat()
      logGatewayDebug(debugEnabledRef.current, "Unmount cleanup: closing websocket")

      const socket = wsRef.current
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
      ) {
        socket.close(1000, "Component unmount")
      }
      wsRef.current = null
    }
  }, [url, token, resolvedEnabled, disconnect, clearHeartbeat, clearReconnectTimer])

  useEffect(() => {
    if (!resolvedEnabled || !url) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      if (manualDisconnectRef.current || authFailedRef.current) return

      const socket = wsRef.current
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
      ) {
        return
      }

      reconnect()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [resolvedEnabled, reconnect, url])

  return {
    status,
    rtt,
    lastEventAt,
    error,
    send,
    reconnect,
    disconnect,
  }
}
