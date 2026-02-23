import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getMCTags } from "@/lib/actions/mc-tags"
import { TagsClient } from "./tags-client"
import { PageHeader } from "@/components/ui/page-header"

export const metadata: Metadata = {
  title: "Mission Control Tags - PMS",
}

export default async function TagsPage() {
  const { orgId } = await getPageOrganization()
  const tagsResult = await getMCTags(orgId)
  const tags = tagsResult.data || []

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Mission Control Tags" />
      <div className="p-6 flex flex-col gap-6">
        <TagsClient tags={tags} orgId={orgId} />
      </div>
    </div>
  )
}
