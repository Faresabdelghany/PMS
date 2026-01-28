import { redirect } from "next/navigation"
import { ClientsContent } from "@/components/clients-content"
import { getClientsWithProjectCounts } from "@/lib/actions/clients"
import { getUserOrganizations } from "@/lib/actions/organizations"

export default async function Page() {
  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/login")
  }

  const organizationId = orgsResult.data[0].id
  const result = await getClientsWithProjectCounts(organizationId)
  const clients = result.data || []

  return <ClientsContent initialClients={clients} organizationId={organizationId} />
}
