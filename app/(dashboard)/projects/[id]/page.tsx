import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { ProjectDetailsSkeleton } from "@/components/skeletons"
import { getPageOrganization } from "@/lib/page-auth"
import {
  getCachedProjectWithDetails,
  getCachedTasks,
  getCachedWorkstreamsWithTasks,
  getCachedClients,
  getCachedOrganizationMembers,
  getCachedTags,
  getCachedProjectReports,
} from "@/lib/server-cache"
import { transformProjectToUI } from "@/lib/transforms/project-details"
import type { ProjectDetailLean } from "@/components/projects/ProjectDetailsPage"

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
 * Fetches org-dependent data (clients, members, tags) for the given org.
 * Called in parallel with project data to eliminate the waterfall.
 */
async function fetchOrgData(orgId: string) {
  const [clients, members, tags] = await Promise.all([
    getCachedClients(orgId),
    getCachedOrganizationMembers(orgId),
    getCachedTags(orgId),
  ])
  return { clients, members, tags, orgId }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  const { orgId } = await getPageOrganization()

  // Start ALL queries as promises WITHOUT awaiting — Suspense streams data in
  const projectPromise = getCachedProjectWithDetails(id)
  const tasksPromise = getCachedTasks(id)
  const workstreamsPromise = getCachedWorkstreamsWithTasks(id)
  const orgDataPromise = fetchOrgData(orgId)
  const reportsPromise = getCachedProjectReports(id)

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
        reportsPromise={reportsPromise}
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
  reportsPromise,
  projectId,
}: {
  projectPromise: ReturnType<typeof getCachedProjectWithDetails>
  tasksPromise: ReturnType<typeof getCachedTasks>
  workstreamsPromise: ReturnType<typeof getCachedWorkstreamsWithTasks>
  orgDataPromise: ReturnType<typeof fetchOrgData>
  reportsPromise: ReturnType<typeof getCachedProjectReports>
  projectId: string
}) {
  const [projectResult, tasksResult, workstreamsResult, orgData, reportsResult] = await Promise.all([
    projectPromise,
    tasksPromise,
    workstreamsPromise,
    orgDataPromise,
    reportsPromise,
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

  // Strip heavy fields (scope, outcomes, features, metrics, notes, files)
  // from the raw project before serializing to the client component.
  // Only keep fields actually used by ProjectDetailsPage.
  const raw = projectResult.data
  const supabaseProject: ProjectDetailLean = {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    start_date: raw.start_date,
    end_date: raw.end_date,
    client_id: raw.client_id,
    client: raw.client,
    type_label: raw.type_label,
    tags: raw.tags,
    group_label: raw.group_label,
    label_badge: raw.label_badge,
    members: raw.members,
    organization_id: raw.organization_id,
    currency: raw.currency,
    deliverables: raw.deliverables,
  }

  return (
    <ProjectDetailsPage
      projectId={projectId}
      project={project}
      supabaseProject={supabaseProject}
      tasks={tasks}
      workstreams={workstreams}
      clients={clients}
      organizationMembers={organizationMembers}
      organizationTags={(tagsResult.data || []).map(t => ({ id: t.id, name: t.name, color: t.color }))}
      reports={reportsResult.data || []}
    />
  )
}
