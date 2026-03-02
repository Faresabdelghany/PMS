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

/** Connect frame params sent as the first message after WebSocket opens. */
export type GatewayConnectParams = {
  minProtocol: number
  maxProtocol: number
  client: {
    id: string
    version: string
    platform: string
    mode: string
    displayName?: string
  }
  role?: string
  auth?: {
    token?: string
    password?: string
  }
}

// --- Inbound (Gateway → PMS) ---

export type GatewayResponse = {
  type: 'res'
  id: string
  ok?: boolean
  result?: unknown
  payload?: GatewayHelloOk | unknown
  error?: { code: number; message: string }
}

export type GatewayHelloOk = {
  type: 'hello-ok'
  protocol: number
  server: {
    version: string
    connId: string
  }
  features: {
    methods: string[]
    events: string[]
  }
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
  authMode: 'none' | 'token' | 'password' | 'basic'
  gatewayId: string
}

export type StatusBarCounts = {
  onlineAgents: number
  totalAgents: number
  activeSessions: number
}
