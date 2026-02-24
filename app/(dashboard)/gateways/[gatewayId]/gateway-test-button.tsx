"use client"

import { useState } from "react"
import { toast } from "sonner"
import { WifiHigh } from "@phosphor-icons/react/dist/ssr/WifiHigh"
import { Button } from "@/components/ui/button"
interface GatewayTestButtonProps {
  gatewayId: string
  gatewayUrl: string
}

export function GatewayTestButton({ gatewayId, gatewayUrl }: GatewayTestButtonProps) {
  const [testing, setTesting] = useState(false)

  async function testConnection() {
    setTesting(true)
    try {
      // Read the gateway's DB status (kept fresh by heartbeat events from OpenClaw)
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("gateways" as any)
        .select("status, last_seen_at")
        .eq("id", gatewayId)
        .single()

      const gw = data as { status: string; last_seen_at: string | null } | null
      const isOnline = gw?.status === "online"
      const lastSeen = gw?.last_seen_at ? new Date(gw.last_seen_at) : null
      const staleMs = lastSeen ? Date.now() - lastSeen.getTime() : Infinity
      // Consider online if heartbeat within the last 2 minutes
      if (isOnline && staleMs < 120_000) {
        toast.success("Gateway is reachable (last heartbeat " + Math.round(staleMs / 1000) + "s ago)")
      } else {
        toast.error("Gateway appears offline — no recent heartbeat")
      }
    } catch {
      toast.error("Could not check gateway status")
    } finally {
      setTesting(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
      <WifiHigh className="h-4 w-4 mr-1" />
      {testing ? "Testing..." : "Test Connection"}
    </Button>
  )
}
