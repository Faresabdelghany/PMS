import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedProjects } from "@/lib/server-cache"
import { getAgents } from "@/lib/actions/agents"
import { PageHeader } from "@/components/ui/page-header"
import { NewTaskForm } from "@/components/tasks/NewTaskForm"

export const metadata: Metadata = {
  title: "New Task — Mission Control",
}

export default async function NewTaskPage() {
  const { orgId } = await getPageOrganization()

  const [projectsResult, agentsResult] = await Promise.all([
    getCachedProjects(orgId),
    getAgents(orgId),
  ])

  const projects = (projectsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }))

  const agents = (agentsResult.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    squad: a.squad,
    status: a.status,
    avatar_url: a.avatar_url,
  }))

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="New Task" description="Create a task and optionally assign it to an AI agent" />
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        <NewTaskForm projects={projects} agents={agents} orgId={orgId} />
      </div>
    </div>
  )
}
