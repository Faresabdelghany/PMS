import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import {
  getCachedProjectDetails,
  getCachedProjectTasks,
  getCachedProjectWorkstreams,
  getCachedOrgData,
} from "@/lib/cached-data"
import { getCachedActiveOrganizationId } from "@/lib/server-cache"
import { ProjectDetailsSkeleton } from "@/components/skeletons"

type PageProps = {
  params: Promise<{ id: string }>
}

/**
 * Project Details Page
 *
 * Performance optimizations:
 * 1. Cross-request caching via 'use cache' in getCachedProjectDetails etc.
 *    - Project data: 5min stale, 15min revalidate (realtimeBacked profile)
 *    - Org data: 15min stale, 30min revalidate (semiStatic profile)
 *
 * 2. Parallel fetching - all queries start simultaneously:
 *    - Project details (includes scope, outcomes, features, deliverables, metrics, notes, files)
 *    - Tasks for project
 *    - Workstreams with tasks
 *    - Organization data (clients, members, tags) - speculative fetch using primary org
 *
 * 3. Suspense streaming - page shell renders immediately while data loads
 *
 * Cache invalidation:
 * - Project mutations call revalidateTag(CacheTags.project(id))
 * - Task mutations call revalidateTag(CacheTags.tasks(projectId))
 * - Real-time subscriptions push updates after initial cached load
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Suspense boundary enables streaming - show skeleton while data loads
  return (
    <Suspense fallback={<ProjectDetailsSkeleton />}>
      <ProjectContent projectId={id} />
    </Suspense>
  )
}

/**
 * Async component that fetches and renders project data
 * Separated to enable Suspense boundary at page level
 */
async function ProjectContent({ projectId }: { projectId: string }) {
  // Start ALL queries in parallel - no waterfall!
  // Each query uses 'use cache' for cross-request caching with stale-while-revalidate
  const [projectResult, tasksResult, workstreamsResult, orgId] = await Promise.all([
    getCachedProjectDetails(projectId),
    getCachedProjectTasks(projectId),
    getCachedProjectWorkstreams(projectId),
    getCachedActiveOrganizationId(),
  ])

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const organizationId = projectResult.data.organization_id

  // Fetch org data - use speculative orgId if available, otherwise use project's org
  // This optimizes for the common case (single org) while handling multi-org users
  const targetOrgId = orgId === organizationId ? orgId : organizationId
  const orgData = await getCachedOrgData(targetOrgId)

  // If we speculatively fetched the wrong org, fetch the correct one
  // This is rare (only for users with multiple orgs viewing a project from non-primary org)
  let clientsData = orgData.clients.data
  let membersData = orgData.members.data
  let tagsData = orgData.tags.data

  if (orgId && orgId !== organizationId) {
    const correctOrgData = await getCachedOrgData(organizationId)
    clientsData = correctOrgData.clients.data
    membersData = correctOrgData.members.data
    tagsData = correctOrgData.tags.data
  }

  // Map clients to the format expected by ProjectWizard
  const clients = (clientsData || []).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  return (
    <ProjectDetailsPage
      projectId={projectId}
      supabaseProject={projectResult.data}
      tasks={tasksResult.data || []}
      workstreams={workstreamsResult.data || []}
      clients={clients}
      organizationMembers={membersData || []}
      organizationTags={tagsData || []}
    />
  )
}
