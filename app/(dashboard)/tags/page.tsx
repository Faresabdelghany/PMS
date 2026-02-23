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
    <div className="flex flex-col flex-1">
      <PageHeader title="Mission Control Tags" />
      <div className="p-6 flex flex-col gap-6">
        <TagsClient tags={tags} orgId={orgId} />
      </div>
    </div>
  )
}
