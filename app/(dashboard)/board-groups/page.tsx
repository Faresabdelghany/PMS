import type { Metadata } from "next"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getBoardGroups } from "@/lib/actions/board-groups"
import { BoardGroupsClient } from "./board-groups-client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = { title: "Board Groups - PMS" }

export default async function BoardGroupsPage() {
  const { orgId } = await getPageOrganization()
  const result = await getBoardGroups(orgId)
  const groups = result.data ?? []

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Board Groups"
        actions={
          <Link href="/board-groups/new">
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" weight="bold" />
              New Group
            </Button>
          </Link>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        <BoardGroupsClient groups={groups} orgId={orgId} />
      </div>
    </div>
  )
}
