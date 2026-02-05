import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import {
  getCachedProjectWithDetails,
  getCachedTasks,
  getCachedWorkstreamsWithTasks,
  getCachedClients,
  getCachedOrganizationMembers,
  getCachedTags,
  getCachedActiveOrganizationId,
} from "@/lib/server-cache"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Get user's active organization ID for speculative parallel fetching
  // This eliminates the waterfall by starting org-dependent queries immediately
  const speculativeOrgId = await getCachedActiveOrganizationId()

  // Start ALL queries in parallel - no waterfall!
  // Project + Tasks + Workstreams are project-dependent
  // Clients + Members + Tags are org-dependent (using speculative org ID)
  // If the project belongs to a different org, the org data will be stale but unused
  const [
    projectResult,
    tasksResult,
    workstreamsResult,
    clientsResult,
    membersResult,
    tagsResult,
  ] = await Promise.all([
    getCachedProjectWithDetails(id),
    getCachedTasks(id),
    getCachedWorkstreamsWithTasks(id),
    // Speculatively fetch org data using the user's primary org
    speculativeOrgId ? getCachedClients(speculativeOrgId) : Promise.resolve({ data: null }),
    speculativeOrgId ? getCachedOrganizationMembers(speculativeOrgId) : Promise.resolve({ data: null }),
    speculativeOrgId ? getCachedTags(speculativeOrgId) : Promise.resolve({ data: null }),
  ])

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const organizationId = projectResult.data.organization_id

  // If the project belongs to a different org than the speculative one,
  // fetch the correct org data (rare case for users with multiple orgs)
  let finalClientsResult = clientsResult
  let finalMembersResult = membersResult
  let finalTagsResult = tagsResult

  if (speculativeOrgId !== organizationId) {
    // Fetch org-dependent data for the actual org in parallel
    const [correctClients, correctMembers, correctTags] = await Promise.all([
      getCachedClients(organizationId),
      getCachedOrganizationMembers(organizationId),
      getCachedTags(organizationId),
    ])
    finalClientsResult = correctClients
    finalMembersResult = correctMembers
    finalTagsResult = correctTags
  }

  // Map clients to the format expected by ProjectWizard
  const clients = (finalClientsResult.data || []).map((c) => ({
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
      organizationMembers={finalMembersResult.data || []}
      organizationTags={finalTagsResult.data || []}
    />
  )
}
