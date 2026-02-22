import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getBoard } from "@/lib/actions/boards"
import { getAgent } from "@/lib/actions/agents"
import { getGateway } from "@/lib/actions/gateways"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"

export const metadata: Metadata = {
  title: "Board Detail - PMS",
}

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const result = await getBoard(boardId)

  if (!result.data) return notFound()

  const board = result.data

  // Resolve agent and gateway names in parallel
  const [agentResult, gatewayResult] = await Promise.all([
    board.agent_id ? getAgent(board.agent_id) : Promise.resolve({ data: null }),
    board.gateway_id ? getGateway(board.gateway_id) : Promise.resolve({ data: null }),
  ])
  const agentName = agentResult.data?.name ?? board.agent_id
  const gatewayName = gatewayResult.data?.name ?? board.gateway_id

  const statusColor = {
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  }[board.status]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/boards">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Boards
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{board.name}</h1>
              <Badge variant="outline" className={statusColor}>
                <span className="capitalize">{board.status}</span>
              </Badge>
            </div>
            {board.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{board.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Robot className="h-4 w-4" /> Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {board.agent_id ? (
              <Link href={`/agents/${board.agent_id}`} className="hover:underline">
                <p className="text-sm font-medium">{agentName}</p>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No agent assigned</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <PlugsConnected className="h-4 w-4" /> Gateway
            </CardTitle>
          </CardHeader>
          <CardContent>
            {board.gateway_id ? (
              <Link href={`/gateways/${board.gateway_id}`} className="hover:underline">
                <p className="text-sm font-medium">{gatewayName}</p>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No gateway assigned</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{new Date(board.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{new Date(board.updated_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
