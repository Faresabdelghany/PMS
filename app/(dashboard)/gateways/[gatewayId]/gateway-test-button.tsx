"use client"

import { useState } from "react"
import { toast } from "sonner"
import { WifiHigh } from "@phosphor-icons/react/dist/ssr/WifiHigh"
import { Button } from "@/components/ui/button"
import { updateGateway } from "@/lib/actions/gateways"

interface GatewayTestButtonProps {
  gatewayId: string
  gatewayUrl: string
}

export function GatewayTestButton({ gatewayId, gatewayUrl }: GatewayTestButtonProps) {
  const [testing, setTesting] = useState(false)

  async function testConnection() {
    setTesting(true)
    try {
      const encodedUrl = encodeURIComponent(gatewayUrl)
      const res = await fetch(`/api/gateway?url=${encodedUrl}&path=/`)
      if (res.ok) {
        toast.success("Gateway is reachable ✓")
        // Update gateway status in DB
        await updateGateway(gatewayId, {
          status: "online",
          last_seen_at: new Date().toISOString(),
        })
      } else {
        toast.error(`Gateway returned status ${res.status}`)
        await updateGateway(gatewayId, {
          status: "offline",
        })
      }
    } catch {
      toast.error("Connection failed — gateway may be offline")
      await updateGateway(gatewayId, {
        status: "offline",
      })
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
