import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { ProjectsContent } from "@/components/projects-content"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getProjects, type ProjectWithRelations } from "@/lib/actions/projects"
import { getClients } from "@/lib/actions/clients"

export default async function Page() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch projects for the organization
  const projectsResult = await getProjects(organization.id)
  const projects = projectsResult.data ?? []

  // Fetch clients for project creation
  const clientsResult = await getClients(organization.id)
  const clients = clientsResult.data ?? []

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ProjectsContent
          initialProjects={projects}
          clients={clients}
          organizationId={organization.id}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
