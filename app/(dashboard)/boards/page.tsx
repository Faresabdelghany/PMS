import type { Metadata } from "next"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getBoards } from "@/lib/actions/boards"
import { getBoardGroups } from "@/lib/actions/board-groups"
import type { Board } from "@/lib/actions/boards"
import type { BoardGroup } from "@/lib/actions/board-groups"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Kanban } from "@phosphor-icons/react/dist/ssr/Kanban"
import { Robot } from "@phosphor-icons/react/dist/ssr/Robot"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"

export const metadata: Metadata = {
  title: "Boards - PMS",
}

const STATUS_BADGE: Record<Board["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
}

function BoardCard({ board }: { board: Board }) {
  return (
    <div className="relative group">
      <Link href={`/boards/${board.id}`}>
        <Card className="h-full hover:border-primary/30 transition-colors cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base font-semibold">{board.name}</CardTitle>
              <Badge variant="outline" className={`${STATUS_BADGE[board.status]} text-xs`}>
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
      <Link
        href={`/boards/${board.id}/edit`}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm">
          <PencilSimple className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  )
}

export default async function BoardsPage() {
  const { orgId } = await getPageOrganization()
  const [boardsResult, groupsResult] = await Promise.all([
    getBoards(orgId),
    getBoardGroups(orgId),
  ])

  const boards = (boardsResult.data || []) as (Board & { board_group_id?: string | null })[]
  const groups = groupsResult.data || []

  // Partition boards by group
  const boardsByGroup = new Map<string, typeof boards>()
  const ungrouped: typeof boards = []

  for (const board of boards) {
    const gid = board.board_group_id
    if (gid) {
      if (!boardsByGroup.has(gid)) boardsByGroup.set(gid, [])
      boardsByGroup.get(gid)!.push(board)
    } else {
      ungrouped.push(board)
    }
  }

  const hasGroups = groups.length > 0

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
      ) : hasGroups ? (
        <div className="flex flex-col gap-8">
          {groups.map((group) => {
            const groupBoards = boardsByGroup.get(group.id) ?? []
            if (groupBoards.length === 0) return null
            return (
              <div key={group.id}>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.name}
                  </h2>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupBoards.map((board) => (
                    <BoardCard key={board.id} board={board} />
                  ))}
                </div>
              </div>
            )
          })}

          {ungrouped.length > 0 && (
            <div>
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Ungrouped
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ungrouped.map((board) => (
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}
    </div>
  )
}
