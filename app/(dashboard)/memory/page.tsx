import { getPageOrganization } from "@/lib/page-auth"
import { getMemoryJournals, getMemoryLongTermSummary } from "@/lib/actions/memory"
import { MemoryContent } from "@/components/memory/MemoryContent"

export default async function MemoryPage() {
  const { orgId } = await getPageOrganization()
  const [journalsResult, summaryResult] = await Promise.all([
    getMemoryJournals(orgId),
    getMemoryLongTermSummary(orgId),
  ])

  return (
    <MemoryContent
      initialJournals={journalsResult.data ?? []}
      longTermSummary={summaryResult.data ?? null}
      orgId={orgId}
    />
  )
}
