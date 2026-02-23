import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getBoardGroups } from "@/lib/actions/board-groups"
import { BoardGroupsClient } from "./board-groups-client"

export const metadata: Metadata = { title: "Board Groups - PMS" }

export default async function BoardGroupsPage() {
  const { orgId } = await getPageOrganization()
  const result = await getBoardGroups(orgId)
  const groups = result.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Board Groups</h1>
        <p className="text-sm text-muted-foreground">
          Organize boards into logical groups
        </p>
      </div>
      <BoardGroupsClient groups={groups} orgId={orgId} />
    </div>
  )
}
