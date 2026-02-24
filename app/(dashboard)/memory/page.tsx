import { getPageOrganization } from "@/lib/page-auth"
import { getAgentMemoryCards } from "@/lib/actions/memory"
import { MemoryContent } from "@/components/memory/MemoryContent"

export default async function MemoryPage() {
  const { orgId } = await getPageOrganization()
  const result = await getAgentMemoryCards(orgId)

  return <MemoryContent initialCards={result.data ?? []} orgId={orgId} />
}
