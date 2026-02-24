import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"
import { getGatewayStatus } from "@/lib/actions/agent-events"

interface GatewayStatusCardProps {
  orgId: string
}

export async function GatewayStatusCard({ orgId }: GatewayStatusCardProps) {
  const { status, lastHeartbeat } = await getGatewayStatus(orgId)

  const statusConfig = {
    online: {
      dot: "bg-emerald-500",
      label: "Online",
      desc: lastHeartbeat
        ? `Last heartbeat: ${new Date(lastHeartbeat).toLocaleTimeString()}`
        : "Gateway is active",
    },
    offline: {
      dot: "bg-red-500",
      label: "Offline",
      desc: "No recent heartbeat — start OpenClaw",
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
