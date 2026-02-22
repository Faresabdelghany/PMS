"use client"

import { useState } from "react"
import { toast } from "sonner"
import { WifiHigh } from "@phosphor-icons/react/dist/ssr/WifiHigh"
import { Button } from "@/components/ui/button"

interface GatewayTestButtonProps {
  gatewayUrl: string
}

export function GatewayTestButton({ gatewayUrl }: GatewayTestButtonProps) {
  const [testing, setTesting] = useState(false)

  async function testConnection() {
    setTesting(true)
    try {
      const encodedUrl = encodeURIComponent(gatewayUrl)
      const res = await fetch(`/api/gateway?url=${encodedUrl}&path=/`)
      if (res.ok) {
        toast.success("Gateway is reachable ✓")
      } else {
        toast.error(`Gateway returned status ${res.status}`)
      }
    } catch (err) {
      toast.error("Connection failed — gateway may be offline")
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
