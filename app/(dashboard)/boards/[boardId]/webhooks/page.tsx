import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getBoard } from "@/lib/actions/boards"
import { getBoardWebhooks } from "@/lib/actions/board-webhooks"
import { BoardWebhooksClient } from "./webhooks-client"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = { title: "Board Webhooks - PMS" }

export default async function BoardWebhooksPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const [boardResult, webhooksResult] = await Promise.all([
    getBoard(boardId),
    getBoardWebhooks(boardId),
  ])

  if (!boardResult.data) return notFound()

  const board = boardResult.data
  const webhooks = webhooksResult.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/boards/${boardId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Board
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Webhooks — {board.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage webhook endpoints for this board
            </p>
          </div>
        </div>
        <Link href={`/boards/${boardId}/webhooks/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Webhook
          </Button>
        </Link>
      </div>

      <BoardWebhooksClient webhooks={webhooks} boardId={boardId} />
    </div>
  )
}
