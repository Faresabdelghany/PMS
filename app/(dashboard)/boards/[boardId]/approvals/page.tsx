import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPageOrganization } from "@/lib/page-auth"
import { getBoard } from "@/lib/actions/boards"
import { getApprovals } from "@/lib/actions/approvals"
import { ApprovalsClient } from "@/app/(dashboard)/approvals/approvals-client"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"

export const metadata: Metadata = { title: "Board Approvals - PMS" }

export default async function BoardApprovalsPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const { orgId } = await getPageOrganization()

  const [boardResult, approvalsResult] = await Promise.all([
    getBoard(boardId),
    getApprovals(orgId),
  ])

  if (!boardResult.data) return notFound()

  const board = boardResult.data
  const allApprovals = approvalsResult.data ?? []

  // Filter to approvals for this board's agent
  const approvals = board.agent_id
    ? allApprovals.filter((a) => a.agent_id === board.agent_id)
    : []

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title={`Approvals — ${board.name}`}
        actions={
          <Link href={`/boards/${boardId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Board
            </Button>
          </Link>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        {!board.agent_id && (
          <p className="text-sm text-muted-foreground">No agent assigned to this board</p>
        )}
        <ApprovalsClient approvals={approvals} currentStatus={undefined} />
      </div>
    </div>
  )
}
