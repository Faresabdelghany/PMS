import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedProjects, getCachedClients } from "@/lib/server-cache"
import { ProjectsContent } from "@/components/projects-content"
import { ProjectsListSkeleton } from "@/components/skeletons"

export const metadata: Metadata = {
  title: "Projects - PMS",
}

export default async function Page() {
  const { orgId } = await getPageOrganization()

  // Start both fetches in parallel — no sequential waterfall
  const projectsPromise = getCachedProjects(orgId)
  const clientsPromise = getCachedClients(orgId)

  return (
    <Suspense fallback={<ProjectsListSkeleton />}>
      <ProjectsListStreamed
        projectsPromise={projectsPromise}
        clientsPromise={clientsPromise}
        orgId={orgId}
      />
    </Suspense>
  )
}

async function ProjectsListStreamed({
  projectsPromise,
  clientsPromise,
  orgId,
}: {
  projectsPromise: ReturnType<typeof getCachedProjects>
  clientsPromise: ReturnType<typeof getCachedClients>
  orgId: string
}) {
  const [projectsResult, clientsResult] = await Promise.all([
    projectsPromise,
    clientsPromise,
  ])

  return (
    <ProjectsContent
      initialProjects={projectsResult.data ?? []}
      initialHasMore={projectsResult.hasMore ?? false}
      initialCursor={projectsResult.nextCursor ?? null}
      clients={clientsResult.data ?? []}
      organizationId={orgId}
    />
  )
}
