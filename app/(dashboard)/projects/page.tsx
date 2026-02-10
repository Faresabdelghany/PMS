import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cachedGetUser } from "@/lib/request-cache"
import { getCachedProjects, getCachedClients } from "@/lib/server-cache"
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { ProjectsContent } from "@/components/projects-content"
import { ProjectsListSkeleton } from "@/components/skeletons"
import type { OrganizationWithRole } from "@/hooks/use-organization"

export const metadata: Metadata = {
  title: "Projects - PMS",
}

export default async function Page() {
  // Reuse layout's cached auth (React cache() dedup — ~0ms)
  const { user, supabase } = await cachedGetUser()

  if (!user) {
    redirect("/login")
  }

  // Read org ID from KV cache — same key + shape as layout, so this is an instant cache hit
  // Layout already populated this cache entry, avoiding a redundant DB query
  const organizations = await cacheGet(
    CacheKeys.userOrgs(user.id),
    async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`role, organization:organizations(*)`)
        .eq("user_id", user.id)

      if (error || !data) return []

      return data
        .filter((m) => m.organization)
        .map((m) => ({
          ...(m.organization as unknown as OrganizationWithRole),
          role: m.role as "admin" | "member",
        }))
    },
    CacheTTL.ORGS
  )

  if (!organizations.length) {
    redirect("/onboarding")
  }

  const orgId = organizations[0].id

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
      clients={clientsResult.data ?? []}
      organizationId={orgId}
    />
  )
}
