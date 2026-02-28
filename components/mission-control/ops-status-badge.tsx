"use client"

import { Badge } from "@/components/ui/badge"

type OpsStatus = "running" | "blocked" | "waiting" | "completed"

const statusClassMap: Record<OpsStatus, string> = {
  running: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  blocked: "bg-red-500/10 text-red-600 border-red-500/20",
  waiting: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
}

export function OpsStatusBadge({ status }: { status: OpsStatus }) {
  return (
    <Badge variant="outline" className={statusClassMap[status]}>
      {status}
    </Badge>
  )
}

