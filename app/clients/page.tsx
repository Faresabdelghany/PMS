import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { ClientsContent } from "@/components/clients-content"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getClients, getClientsWithProjectCounts } from "@/lib/actions/clients"

export default async function Page() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch clients for the organization with project counts
  const clientsResult = await getClientsWithProjectCounts(organization.id)
  const clients = clientsResult.data ?? []

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ClientsContent
          initialClients={clients}
          organizationId={organization.id}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
