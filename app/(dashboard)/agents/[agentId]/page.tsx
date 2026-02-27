import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgentById, getAgentActivities } from "@/lib/actions/agents"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed"

export const metadata: Metadata = {
  title: "Agent Detail - PMS",
}

const STATUS_STYLES: Record<string, string> = {
  online: "bg-emerald-500/10 text-emerald-600",
  busy: "bg-amber-500/10 text-amber-600",
  idle: "bg-slate-500/10 text-slate-600",
  offline: "bg-red-500/10 text-red-600",
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-col flex-1">
      <Suspense fallback={<PageSkeleton />}>
        <AgentDetail agentId={agentId} orgId={orgId} />
      </Suspense>
    </div>
  )
}

async function AgentDetail({ agentId, orgId }: { agentId: string; orgId: string }) {
  const [agentResult, activitiesResult] = await Promise.all([
    getAgentById(agentId),
    getAgentActivities(agentId),
  ])

  const agent = agentResult.data
  if (!agent) return notFound()

  const activities = activitiesResult.data || []

  return (
    <>
      <PageHeader
        title={agent.name}
        actions={
          <>
            <Link href={`/agents/${agentId}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <Link href="/agents">
              <Button variant="ghost" size="sm">Back</Button>
            </Link>
          </>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        {/* Status + role */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={STATUS_STYLES[agent.status] || ""}>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {agent.status}
          </Badge>
          <p className="text-sm text-muted-foreground">{agent.role}</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Type &amp; Squad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">{agent.agent_type}</Badge>
                <Badge variant="outline" className="capitalize">{agent.squad}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">AI Model</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm">{agent.ai_model || "Not set"}</p>
              <p className="text-xs text-muted-foreground mt-1">{agent.ai_provider || "No provider"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reports To</CardTitle>
            </CardHeader>
            <CardContent>
              {agent.supervisor ? (
                <Link href={`/agents/${agent.reports_to}`} className="text-sm hover:underline">
                  {agent.supervisor.name}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">No supervisor (top-level)</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {agent.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{agent.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Capabilities & Skills */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {((agent.capabilities as any[]) || []).length > 0 ? (
                  ((agent.capabilities as any[]) || []).map((cap: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{cap}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No capabilities set</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {((agent.skills as any[]) || []).length > 0 ? (
                  ((agent.skills as any[]) || []).map((skill: any, i: number) => {
                    const name = typeof skill === "string" ? skill : skill?.name || String(skill)
                    return <Badge key={i} variant="outline" className="text-xs">{name}</Badge>
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No skills assigned</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentActivityFeed activities={activities} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
