import type { Metadata } from "next"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getBoards } from "@/lib/actions/boards"
import type { Board } from "@/lib/actions/boards"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Kanban } from "@phosphor-icons/react/dist/ssr/Kanban"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"

export const metadata: Metadata = {
  title: "Boards - PMS",
}

const STATUS_BADGE: Record<Board["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
}

export default async function BoardsPage() {
  const { orgId } = await getPageOrganization()
  const boardsResult = await getBoards(orgId)
  const boards = boardsResult.data || []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Kanban className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
            <p className="text-sm text-muted-foreground">Agent work boards connecting agents to gateways</p>
          </div>
        </div>
        <Link href="/boards/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Board
          </Button>
        </Link>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <Kanban className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No boards yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
            Create a board to connect an agent with a gateway for mission control.
          </p>
          <Link href="/boards/new">
            <Button size="sm" variant="outline">Create your first board</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link key={board.id} href={`/boards/${board.id}`}>
              <Card className="h-full hover:border-primary/30 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">{board.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`${STATUS_BADGE[board.status]} text-xs`}
                    >
                      <span className="capitalize">{board.status}</span>
                    </Badge>
                  </div>
                  {board.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{board.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Robot className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-mono">{board.agent_id || "No agent"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PlugsConnected className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-mono">{board.gateway_id || "No gateway"}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
