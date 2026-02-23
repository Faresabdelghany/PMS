import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getGateway } from "@/lib/actions/gateways"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { GatewayTestButton } from "./gateway-test-button"

export const metadata: Metadata = {
  title: "Gateway Detail - PMS",
}

export default async function GatewayDetailPage({
  params,
}: {
  params: Promise<{ gatewayId: string }>
}) {
  const { gatewayId } = await params
  const result = await getGateway(gatewayId)

  if (!result.data) return notFound()

  const gateway = result.data

  const statusColor = {
    online: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    offline: "bg-red-500/10 text-red-600 border-red-500/20",
    unknown: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  }[gateway.status]

  const statusDot = {
    online: "bg-emerald-500",
    offline: "bg-red-500",
    unknown: "bg-slate-400",
  }[gateway.status]

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title={gateway.name}
        actions={
          <>
            <GatewayTestButton gatewayId={gatewayId} gatewayUrl={gateway.url} />
            <Link href={`/gateways/${gatewayId}/edit`}>
              <Button variant="outline" size="sm">
                <PencilSimple className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </Link>
            <Link href="/gateways">
              <Button variant="ghost" size="sm">Back</Button>
            </Link>
          </>
        }
      />
      <div className="p-6 max-w-2xl flex flex-col gap-6">
        {/* Status + URL */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={statusColor}>
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className="capitalize">{gateway.status}</span>
          </Badge>
          <p className="text-sm text-muted-foreground font-mono">{gateway.url}</p>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Authentication</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize">{gateway.auth_mode}</Badge>
            </CardContent>
          </Card>

          {gateway.workspace_root && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Workspace Root</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono">{gateway.workspace_root}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Seen</CardTitle>
            </CardHeader>
            <CardContent>
              {gateway.last_seen_at ? (
                <p className="text-sm">{new Date(gateway.last_seen_at).toLocaleString()}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Never</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{new Date(gateway.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
