"use client"

import { useEffect, useState, useTransition } from "react"
import { getLiveOpsSnapshot, type LiveOpsSnapshot } from "@/lib/actions/mission-control"
import { LiveOpsPanel } from "./live-ops-panel"

interface LiveOpsClientProps {
  orgId: string
  initialLiveOps: LiveOpsSnapshot | null
}

export function LiveOpsClient({ orgId, initialLiveOps }: LiveOpsClientProps) {
  const [liveOps, setLiveOps] = useState<LiveOpsSnapshot | null>(initialLiveOps)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(async () => {
        const result = await getLiveOpsSnapshot(orgId)
        if (result.data) setLiveOps(result.data)
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [orgId])

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Live Ops</h1>
        <p className="text-sm text-muted-foreground">
          Real-time agent sessions, queue, and blockers. Auto-refresh every 5s.
          {isPending ? " Refreshing..." : ""}
        </p>
      </div>
      <LiveOpsPanel snapshot={liveOps} />
    </div>
  )
}
