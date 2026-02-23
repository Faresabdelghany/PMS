import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getBoard } from "@/lib/actions/boards"
import { getBoardWebhooks } from "@/lib/actions/board-webhooks"
import { BoardWebhooksClient } from "./webhooks-client"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
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
    <div className="flex flex-col flex-1">
      <PageHeader
        title={`Webhooks — ${board.name}`}
        actions={
          <>
            <Link href={`/boards/${boardId}/webhooks/new`}>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4" weight="bold" />
                Add Webhook
              </Button>
            </Link>
            <Link href={`/boards/${boardId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Board
              </Button>
            </Link>
          </>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        <BoardWebhooksClient webhooks={webhooks} boardId={boardId} />
      </div>
    </div>
  )
}
