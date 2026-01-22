import { notFound, redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getProject } from "@/lib/actions/projects"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getClients } from "@/lib/actions/clients"
import { getTasks } from "@/lib/actions/tasks"
import { getWorkstreams } from "@/lib/actions/workstreams"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Get user's organizations
  const orgsResult = await getUserOrganizations()
  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }
  const organization = orgsResult.data[0]

  // Fetch project
  const projectResult = await getProject(id)
  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  // Fetch related data
  const [clientsResult, tasksResult, workstreamsResult] = await Promise.all([
    getClients(organization.id),
    getTasks(id),
    getWorkstreams(id),
  ])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ProjectDetailsPage
          project={projectResult.data}
          clients={clientsResult.data ?? []}
          tasks={tasksResult.data ?? []}
          workstreams={workstreamsResult.data ?? []}
          organizationId={organization.id}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
