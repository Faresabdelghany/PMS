import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { ProjectDetailsSkeleton } from "@/components/skeletons"
import {
  getCachedProjectWithDetails,
  getCachedTasks,
  getCachedWorkstreamsWithTasks,
  getCachedClients,
  getCachedOrganizationMembers,
  getCachedTags,
  getCachedActiveOrganizationId,
} from "@/lib/server-cache"
import { transformProjectToUI } from "@/lib/transforms/project-details"

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getCachedProjectWithDetails(id)
  const name = result.data?.name ?? "Project"
  return { title: `${name} - PMS` }
}

/**
 * Fetches org-dependent data (clients, members, tags) using the user's active org.
 * This helper allows org data to be fetched in parallel with project data,
 * eliminating the waterfall where we'd wait for project to get the org ID.
 */
async function fetchOrgData() {
  const orgId = await getCachedActiveOrganizationId()
  if (!orgId) {
    return { clients: { data: null }, members: { data: null }, tags: { data: null }, orgId: null }
  }
  const [clients, members, tags] = await Promise.all([
    getCachedClients(orgId),
    getCachedOrganizationMembers(orgId),
    getCachedTags(orgId),
  ])
  return { clients, members, tags, orgId }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Start ALL queries as promises WITHOUT awaiting — Suspense streams data in
  const projectPromise = getCachedProjectWithDetails(id)
  const tasksPromise = getCachedTasks(id)
  const workstreamsPromise = getCachedWorkstreamsWithTasks(id)
  const orgDataPromise = fetchOrgData()

  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
        <div className="flex-1 bg-background px-6 py-4 rounded-b-lg">
          <div className="mx-auto w-full max-w-7xl">
            <ProjectDetailsSkeleton />
          </div>
        </div>
      </div>
    }>
      <ProjectDetailStreamed
        projectPromise={projectPromise}
        tasksPromise={tasksPromise}
        workstreamsPromise={workstreamsPromise}
        orgDataPromise={orgDataPromise}
        projectId={id}
      />
    </Suspense>
  )
}

async function ProjectDetailStreamed({
  projectPromise,
  tasksPromise,
  workstreamsPromise,
  orgDataPromise,
  projectId,
}: {
  projectPromise: ReturnType<typeof getCachedProjectWithDetails>
  tasksPromise: ReturnType<typeof getCachedTasks>
  workstreamsPromise: ReturnType<typeof getCachedWorkstreamsWithTasks>
  orgDataPromise: ReturnType<typeof fetchOrgData>
  projectId: string
}) {
  const [projectResult, tasksResult, workstreamsResult, orgData] = await Promise.all([
    projectPromise,
    tasksPromise,
    workstreamsPromise,
    orgDataPromise,
  ])

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const organizationId = projectResult.data.organization_id

  // Use speculatively fetched org data if it matches the project's org
  // Otherwise, fetch the correct org data (rare case for users with multiple orgs)
  let clientsResult = orgData.clients
  let membersResult = orgData.members
  let tagsResult = orgData.tags

  if (orgData.orgId !== organizationId) {
    const [correctClients, correctMembers, correctTags] = await Promise.all([
      getCachedClients(organizationId),
      getCachedOrganizationMembers(organizationId),
      getCachedTags(organizationId),
    ])
    clientsResult = correctClients
    membersResult = correctMembers
    tagsResult = correctTags
  }

  // Map clients to the format expected by ProjectWizard
  const clients = (clientsResult.data || []).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  const tasks = tasksResult.data || []
  const workstreams = workstreamsResult.data || []
  const organizationMembers = membersResult.data || []

  // Pre-compute UI transform on the server to avoid blocking the client render.
  const project = transformProjectToUI(projectResult.data, tasks, workstreams, organizationMembers)

  return (
    <ProjectDetailsPage
      projectId={projectId}
      project={project}
      supabaseProject={projectResult.data}
      tasks={tasks}
      workstreams={workstreams}
      clients={clients}
      organizationMembers={organizationMembers}
      organizationTags={tagsResult.data || []}
    />
  )
}
