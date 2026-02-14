import { getCachedProjects, getCachedClients } from "@/lib/server-cache"
import { ProjectsContent } from "@/components/projects-content"

export async function CachedProjectsList({ orgId }: { orgId: string }) {
  const [projectsResult, clientsResult] = await Promise.all([
    getCachedProjects(orgId),
    getCachedClients(orgId),
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
