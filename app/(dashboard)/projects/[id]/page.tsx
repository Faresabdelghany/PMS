import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { getProjectWithDetails } from "@/lib/actions/projects"
import { getTasks } from "@/lib/actions/tasks"
import { getWorkstreamsWithTasks } from "@/lib/actions/workstreams"
import { getClients } from "@/lib/actions/clients"
import { getOrganizationMembers } from "@/lib/actions/organizations"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Fetch project first to get organization_id
  const projectResult = await getProjectWithDetails(id)

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const organizationId = projectResult.data.organization_id

  // Fetch tasks, workstreams, clients, and org members in parallel
  const [tasksResult, workstreamsResult, clientsResult, membersResult] = await Promise.all([
    getTasks(id),
    getWorkstreamsWithTasks(id),
    getClients(organizationId),
    getOrganizationMembers(organizationId),
  ])

  // Map clients to the format expected by ProjectWizard
  const clients = (clientsResult.data || []).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  return (
    <ProjectDetailsPage
      projectId={id}
      supabaseProject={projectResult.data}
      tasks={tasksResult.data || []}
      workstreams={workstreamsResult.data || []}
      clients={clients}
      organizationMembers={membersResult.data || []}
    />
  )
}
