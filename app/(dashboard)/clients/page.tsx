import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ClientsContent } from "@/components/clients-content"
import { cachedGetUserOrganizations } from "@/lib/request-cache"
import { getCachedClientsWithProjectCounts } from "@/lib/server-cache"
import { ClientsListSkeleton } from "@/components/skeletons"

async function ClientsList({ orgId }: { orgId: string }) {
  const result = await getCachedClientsWithProjectCounts(orgId)
  const clients = result.data || []
  return <ClientsContent initialClients={clients} organizationId={orgId} />
}

export default async function Page() {
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/login")
  }

  const organizationId = orgsResult.data[0].id

  return (
    <Suspense fallback={<ClientsListSkeleton />}>
      <ClientsList orgId={organizationId} />
    </Suspense>
  )
}
