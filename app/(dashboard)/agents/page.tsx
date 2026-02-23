import type { Metadata } from "next"
import { Suspense } from "react"
import { AgentsTable } from "@/components/agents/agents-table"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgents } from "@/lib/actions/agents"
import type { AgentWithSupervisor } from "@/lib/supabase/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = {
  title: "Agents - PMS",
}

export default async function Page() {
  const { orgId } = await getPageOrganization()
  const agentsPromise = getAgents(orgId)

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Agents"
        actions={
          <Link href="/agents/new">
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" weight="bold" />
              New Agent
            </Button>
          </Link>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        <Suspense fallback={<PageSkeleton />}>
          <AgentsStreamed agentsPromise={agentsPromise} orgId={orgId} />
        </Suspense>
      </div>
    </div>
  )
}

async function AgentsStreamed({
  agentsPromise,
  orgId,
}: {
  agentsPromise: ReturnType<typeof getAgents>
  orgId: string
}) {
  const result = await agentsPromise

  const agents: AgentWithSupervisor[] = (result.data || []).map((a) => ({
    id: a.id,
    organization_id: a.organization_id,
    name: a.name,
    role: a.role,
    description: a.description,
    agent_type: a.agent_type,
    squad: a.squad,
    status: a.status,
    ai_provider: a.ai_provider,
    ai_model: a.ai_model,
    ai_api_key_encrypted: null,
    system_prompt: null,
    capabilities: a.capabilities,
    skills: a.skills,
    reports_to: a.reports_to,
    last_active_at: a.last_active_at,
    performance_notes: null,
    avatar_url: a.avatar_url,
    sort_order: a.sort_order,
    is_active: a.is_active,
    created_at: a.created_at,
    updated_at: a.updated_at,
    supervisor: a.supervisor,
  }))

  return <AgentsTable agents={agents} organizationId={orgId} />
}
