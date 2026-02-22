import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getMCTags } from "@/lib/actions/mc-tags"
import { TagsClient } from "./tags-client"
import { Tag } from "@phosphor-icons/react/dist/ssr/Tag"

export const metadata: Metadata = {
  title: "Mission Control Tags - PMS",
}

export default async function TagsPage() {
  const { orgId } = await getPageOrganization()
  const tagsResult = await getMCTags(orgId)
  const tags = tagsResult.data || []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mission Control Tags</h1>
          <p className="text-sm text-muted-foreground">
            Organize your workspace with tags
          </p>
        </div>
      </div>

      <TagsClient tags={tags} orgId={orgId} />
    </div>
  )
}
