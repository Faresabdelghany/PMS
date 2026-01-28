import { redirect } from "next/navigation"
import { ClientsContent } from "@/components/clients-content"
import { cachedGetUserOrganizations, cachedGetClientsWithProjectCounts } from "@/lib/request-cache"

export default async function Page() {
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/login")
  }

  const organizationId = orgsResult.data[0].id
  const result = await cachedGetClientsWithProjectCounts(organizationId)
  const clients = result.data || []

  return <ClientsContent initialClients={clients} organizationId={organizationId} />
}
