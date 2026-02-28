export const HEARTBEAT_PROTOCOL = {
  intervalSeconds: 30,
  timeoutSeconds: 90,
  blockedAfterSeconds: 120,
} as const

export type HeartbeatSessionStatus = "running" | "blocked" | "waiting" | "completed"

export function isHeartbeatStale(heartbeatAt: string | null, timeoutSeconds = HEARTBEAT_PROTOCOL.timeoutSeconds): boolean {
  if (!heartbeatAt) return true
  const diffMs = Date.now() - new Date(heartbeatAt).getTime()
  return diffMs > timeoutSeconds * 1000
}

