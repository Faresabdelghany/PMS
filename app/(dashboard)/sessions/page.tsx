import { getPageOrganization } from "@/lib/page-auth"
import { getAgentSessions } from "@/lib/actions/sessions"
import { SessionsContent } from "@/components/sessions/SessionsContent"

export default async function SessionsPage() {
  const { orgId } = await getPageOrganization()
  const result = await getAgentSessions(orgId)

  return <SessionsContent initialSessions={result.data ?? []} orgId={orgId} />
}
