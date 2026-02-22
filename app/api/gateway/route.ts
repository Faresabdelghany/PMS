import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_GATEWAY_URL = "http://localhost:18789"
const REQUEST_TIMEOUT_MS = 3000

/**
 * GET /api/gateway
 *
 * Proxies requests to an OpenClaw gateway instance.
 *
 * Query params:
 *   url  — base URL of the gateway (default: http://localhost:18789)
 *   path — path to fetch on the gateway  (default: /)
 *
 * Returns the gateway's JSON response, or an error payload if offline.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const gatewayUrl = searchParams.get("url") || DEFAULT_GATEWAY_URL
  const path = searchParams.get("path") || "/"

  // Normalise — strip trailing slash from base, ensure leading slash on path
  const base = gatewayUrl.replace(/\/$/, "")
  const normalPath = path.startsWith("/") ? path : `/${path}`
  const targetUrl = `${base}${normalPath}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PMS-Gateway-Proxy/1.0",
      },
      cache: "no-store",
    })
    clearTimeout(timeout)

    // Try to parse as JSON; fall back to text
    const contentType = response.headers.get("content-type") ?? ""
    let body: unknown
    if (contentType.includes("application/json")) {
      body = await response.json()
    } else {
      body = { raw: await response.text() }
    }

    return NextResponse.json(body, { status: response.status })
  } catch (err) {
    clearTimeout(timeout)

    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"))

    return NextResponse.json(
      {
        error: "Gateway offline",
        status: "offline",
        ...(isTimeout ? { reason: "timeout" } : {}),
      },
      { status: 503 }
    )
  }
}

// Allow CORS for local dev tooling
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
