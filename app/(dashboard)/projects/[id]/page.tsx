import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import {
  getCachedProjectWithDetails,
  getCachedTasks,
  getCachedWorkstreamsWithTasks,
  getCachedClients,
  getCachedOrganizationMembers,
  getCachedTags,
} from "@/lib/server-cache"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Start all project-id-dependent queries in parallel immediately
  // Using cached functions for request-level deduplication
  const [projectResult, tasksResult, workstreamsResult] = await Promise.all([
    getCachedProjectWithDetails(id),
    getCachedTasks(id),
    getCachedWorkstreamsWithTasks(id),
  ])

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const organizationId = projectResult.data.organization_id

  // Now fetch org-dependent data (clients, members, tags) in parallel
  // These are cached and may be shared with other components in the same request
  const [clientsResult, membersResult, tagsResult] = await Promise.all([
    getCachedClients(organizationId),
    getCachedOrganizationMembers(organizationId),
    getCachedTags(organizationId),
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
      organizationTags={tagsResult.data || []}
    />
  )
}
