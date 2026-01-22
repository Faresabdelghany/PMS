import { notFound, redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { ClientDetailsPage } from "@/components/clients/ClientDetailsPage"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getClientWithProjects } from "@/lib/actions/clients"
import { getProjects } from "@/lib/actions/projects"
import { getUserOrganizations } from "@/lib/actions/organizations"

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

  // Fetch client with project count
  const clientResult = await getClientWithProjects(id)
  if (clientResult.error || !clientResult.data) {
    notFound()
  }

  // Fetch related projects for this client
  const projectsResult = await getProjects(organization.id, { clientId: id })
  const relatedProjects = projectsResult.data ?? []

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ClientDetailsPage
          client={clientResult.data}
          relatedProjects={relatedProjects}
          organizationId={organization.id}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
