// Gateway WebSocket frame protocol types
// See: specs/001-gateway-live-connection/contracts/server-actions.md
// See: specs/001-gateway-live-connection/contracts/hooks.md

// --- Outbound (PMS → Gateway) ---

export type GatewayRequest = {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

// --- Inbound (Gateway → PMS) ---

export type GatewayResponse = {
  type: 'res'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

export type GatewayEvent = {
  type: 'event'
  method: string
  params?: Record<string, unknown>
}

export type GatewayFrame = GatewayResponse | GatewayEvent

// --- Server Action Types ---

export type GatewayConnectionInfo = {
  url: string
  token: string
  gatewayId: string
}

export type StatusBarCounts = {
  onlineAgents: number
  totalAgents: number
  activeSessions: number
}
