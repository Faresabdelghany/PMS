"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  GatewayConnectParams,
  GatewayEvent,
  GatewayFrame,
  GatewayRequest,
  GatewayResponse,
} from "@/lib/types/gateway"
import {
  GATEWAY_HEARTBEAT_INTERVAL_MS,
  GATEWAY_MISSED_PONG_THRESHOLD,
  GATEWAY_PROTOCOL_VERSION,
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

type GatewayAuthMode = 'none' | 'token' | 'password' | 'basic'

type UseGatewayWebSocketConfig = {
  url: string | null
  token: string | null
  authMode?: GatewayAuthMode
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

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0" ||
      parsed.hostname === "::1"
    )
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1")
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

function buildConnectParams(credential: string | null): GatewayConnectParams {
  return {
    minProtocol: GATEWAY_PROTOCOL_VERSION,
    maxProtocol: GATEWAY_PROTOCOL_VERSION,
    client: {
      id: "gateway-client",
      version: "1.0.0",
      platform: "web",
      mode: "ui",
      displayName: "PMS Dashboard",
    },
    role: "operator",
    // Send credential as both token and password — gateway checks only the
    // field that matches its configured auth mode.
    ...(credential ? { auth: { token: credential, password: credential } } : {}),
  }
}

export function useGatewayWebSocket({
  url,
  token,
  authMode = "token",
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
  const handshakeCompleteRef = useRef(false)
  const connectRequestIdRef = useRef<string | null>(null)
  const connectRef = useRef<() => void>(() => {})
  const configRef = useRef<{ url: string | null; token: string | null; authMode: GatewayAuthMode; enabled: boolean }>({
    url,
    token,
    authMode,
    enabled: resolvedEnabled,
  })
  const onEventRef = useRef(onEvent)
  const onResponseRef = useRef(onResponse)

  useEffect(() => {
    configRef.current = { url, token, authMode, enabled: resolvedEnabled }
  }, [url, token, authMode, resolvedEnabled])

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
    if (!socket || socket.readyState !== WebSocket.OPEN || !handshakeCompleteRef.current) return

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

    // Skip localhost URLs in production — they trigger CSP violations on Vercel
    if (process.env.NODE_ENV === "production" && isLocalhostUrl(currentUrl)) {
      setStatus("disconnected")
      setError("Gateway is configured for local development only")
      return
    }

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
    handshakeCompleteRef.current = false
    connectRequestIdRef.current = null

    setStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting")

    let socket: WebSocket
    try {
      logGatewayDebug(debugEnabledRef.current, "Connecting websocket", { url: currentUrl })
      // Auth token is sent in the connect frame, NOT as a URL query parameter
      socket = new WebSocket(currentUrl)
    } catch {
      setError("Invalid gateway WebSocket URL")
      setStatus("disconnected")
      scheduleReconnect()
      return
    }

    wsRef.current = socket

    socket.onopen = () => {
      logGatewayDebug(debugEnabledRef.current, "WebSocket transport connected, sending connect handshake")

      // First frame MUST be a "connect" request per OpenClaw gateway protocol
      const connectId = createRequestId()
      connectRequestIdRef.current = connectId

      const connectFrame: GatewayRequest = {
        type: "req",
        id: connectId,
        method: "connect",
        params: buildConnectParams(currentToken) as unknown as Record<string, unknown>,
      }

      logGatewayDebug(debugEnabledRef.current, "Outbound connect frame", connectFrame)
      socket.send(JSON.stringify(connectFrame))
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

      // Handle the connect handshake response (hello-ok)
      if (!handshakeCompleteRef.current && frame.id === connectRequestIdRef.current) {
        if (frame.error || !frame.ok) {
          logGatewayDebug(debugEnabledRef.current, "Connect handshake failed", frame.error)

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

          setError(frame.error?.message ?? "Gateway handshake failed")
          setStatus("disconnected")
          socket.close(1000, "Handshake failed")
          scheduleReconnect()
          return
        }

        // Handshake succeeded — now we're fully connected
        handshakeCompleteRef.current = true
        connectRequestIdRef.current = null
        reconnectAttemptRef.current = 0
        missedPongsRef.current = 0
        pendingPingsRef.current.clear()
        setError(null)
        setStatus("connected")
        logGatewayDebug(debugEnabledRef.current, "Connect handshake OK — gateway connected")

        // Start heartbeat pings now that handshake is done
        sendPing()
        heartbeatIntervalRef.current = setInterval(sendPing, GATEWAY_HEARTBEAT_INTERVAL_MS)

        onResponseRef.current?.(frame)
        return
      }

      // Handle auth errors on any response
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

      // Handle ping/pong RTT measurement
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
      handshakeCompleteRef.current = false
      connectRequestIdRef.current = null
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
    handshakeCompleteRef.current = false
    connectRequestIdRef.current = null
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
    handshakeCompleteRef.current = false
    connectRequestIdRef.current = null
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
    if (!socket || socket.readyState !== WebSocket.OPEN || !handshakeCompleteRef.current) {
      setError("Gateway is not connected")
      logGatewayDebug(debugEnabledRef.current, "Send blocked (socket not connected or handshake incomplete)", frame)
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
