import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgents } from "@/lib/actions/agents"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export const metadata: Metadata = {
  title: "Skills - PMS",
}

export default async function SkillsPage() {
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Skills and capabilities assigned to your AI agents
        </p>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <SkillsContent orgId={orgId} />
      </Suspense>
    </div>
  )
}

async function SkillsContent({ orgId }: { orgId: string }) {
  const result = await getAgents(orgId)
  const agents = result.data || []

  // Collect all unique skills across agents
  const skillMap = new Map<string, string[]>()
  for (const agent of agents) {
    const skills = Array.isArray(agent.skills) ? agent.skills : []
    for (const skill of skills) {
      const skillName = typeof skill === "string" ? skill : (skill as any)?.name || String(skill)
      if (!skillMap.has(skillName)) {
        skillMap.set(skillName, [])
      }
      skillMap.get(skillName)!.push(agent.name)
    }
  }

  const sortedSkills = [...skillMap.entries()].sort((a, b) => b[1].length - a[1].length)

  // Also show agents with their capabilities
  const agentsWithSkills = agents.filter(
    (a) =>
      (Array.isArray(a.skills) && a.skills.length > 0) ||
      (Array.isArray(a.capabilities) && a.capabilities.length > 0)
  )

  return (
    <div className="space-y-6">
      {/* Skills overview */}
      {sortedSkills.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Skills ({sortedSkills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sortedSkills.map(([skill, agentNames]) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="text-sm py-1 px-3"
                  title={`Used by: ${agentNames.join(", ")}`}
                >
                  {skill}
                  <span className="ml-1.5 text-xs text-muted-foreground">×{agentNames.length}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No skills assigned yet. Update agent skills in the database.</p>
          </CardContent>
        </Card>
      )}

      {/* Per-agent breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agentsWithSkills.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                <Badge variant="outline" className="text-xs capitalize">{agent.squad}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(agent.skills) ? agent.skills : []).map((skill: any, i: number) => {
                  const name = typeof skill === "string" ? skill : skill?.name || String(skill)
                  return (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {name}
                    </Badge>
                  )
                })}
                {(Array.isArray(agent.capabilities) ? agent.capabilities : []).map((cap: string, i: number) => (
                  <Badge key={`cap-${i}`} variant="outline" className="text-xs text-muted-foreground">
                    {cap}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
