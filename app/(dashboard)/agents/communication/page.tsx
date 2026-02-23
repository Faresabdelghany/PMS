import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgents } from "@/lib/actions/agents"
import { PageHeader } from "@/components/ui/page-header"
import { AgentNetworkClient } from "@/components/agents/AgentNetworkClient"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Agent Network — PMS",
  description: "Visual org chart of the AI agent hierarchy and communication flow.",
}

function AgentNetworkSkeleton() {
  return (
    <div className="flex-1 p-8 flex flex-col items-center gap-6 animate-pulse">
      {/* Root node */}
      <Skeleton className="h-16 w-40 rounded-xl" />
      {/* Connector */}
      <Skeleton className="h-6 w-px" />
      {/* Level 2 */}
      <div className="flex gap-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-32 rounded-xl" />
        ))}
      </div>
      {/* Connector */}
      <Skeleton className="h-6 w-px" />
      {/* Level 3 */}
      <div className="flex gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-14 w-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

async function AgentNetworkData({ orgId }: { orgId: string }) {
  const result = await getAgents(orgId)
  const agents = result.data ?? []
  return <AgentNetworkClient agents={agents} orgId={orgId} />
}

export default async function AgentCommunicationPage() {
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Agent Network" />
      <Suspense fallback={<AgentNetworkSkeleton />}>
        <AgentNetworkData orgId={orgId} />
      </Suspense>
    </div>
  )
}
