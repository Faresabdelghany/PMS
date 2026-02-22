"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"

type GatewayStatus = "checking" | "online" | "offline"

export function GatewayStatusCard() {
  const [status, setStatus] = useState<GatewayStatus>("checking")

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch("/api/gateway?path=/", {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        })
        if (!cancelled) {
          setStatus(res.ok ? "online" : "offline")
        }
      } catch {
        if (!cancelled) setStatus("offline")
      }
    }

    void check()
    return () => { cancelled = true }
  }, [])

  const statusConfig = {
    checking: {
      dot: "bg-amber-400 animate-pulse",
      label: "Checking...",
      desc: "Pinging local gateway",
    },
    online: {
      dot: "bg-emerald-500",
      label: "Online",
      desc: "Gateway is reachable at localhost:18789",
    },
    offline: {
      dot: "bg-red-500",
      label: "Offline",
      desc: "Gateway not reachable — start OpenClaw",
    },
  }

  const config = statusConfig[status]

  return (
    <Link href="/gateways">
      <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gateway Status</CardTitle>
          <PlugsConnected className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${config.dot}`} />
            <span className="text-2xl font-bold">{config.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{config.desc}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
