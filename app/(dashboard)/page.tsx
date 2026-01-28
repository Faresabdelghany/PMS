import { redirect } from "next/navigation"
import { ProjectsContent } from "@/components/projects-content"
import { cachedGetUserOrganizations, cachedGetProjects, cachedGetClients } from "@/lib/request-cache"

export default async function Page() {
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch projects and clients in parallel
  const [projectsResult, clientsResult] = await Promise.all([
    cachedGetProjects(organization.id),
    cachedGetClients(organization.id),
  ])
  const projects = projectsResult.data ?? []
  const clients = clientsResult.data ?? []

  return (
    <ProjectsContent
      initialProjects={projects}
      clients={clients}
      organizationId={organization.id}
    />
  )
}
