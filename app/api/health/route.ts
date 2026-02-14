import { NextResponse } from "next/server"
import { isKVAvailable } from "@/lib/cache/client"

/**
 * Health check endpoint for uptime monitoring (UptimeRobot, Datadog, etc.)
 * Returns 200 when the app is running and key services are reachable.
 *
 * GET /api/health
 */
export async function GET() {
  const start = Date.now()

  const checks: Record<string, "ok" | "degraded" | "down"> = {
    app: "ok",
    kv: isKVAvailable() ? "ok" : "degraded",
  }

  const status = Object.values(checks).every((v) => v === "ok")
    ? "healthy"
    : "degraded"

  return NextResponse.json(
    {
      status,
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      latency: Date.now() - start,
    },
    { status: status === "healthy" ? 200 : 200 }
  )
}

// Prevent caching
export const dynamic = "force-dynamic"
