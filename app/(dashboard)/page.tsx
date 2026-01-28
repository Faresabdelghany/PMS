import { redirect } from "next/navigation"
import { ProjectsContent } from "@/components/projects-content"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getProjects } from "@/lib/actions/projects"
import { getClients } from "@/lib/actions/clients"

export default async function Page() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch projects and clients in parallel
  const [projectsResult, clientsResult] = await Promise.all([
    getProjects(organization.id),
    getClients(organization.id),
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
