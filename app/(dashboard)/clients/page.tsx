import type { Metadata } from "next"
import { Suspense } from "react"
import { ClientsContent } from "@/components/clients-content"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedClientsWithProjectCounts } from "@/lib/server-cache"
import { ClientsListSkeleton } from "@/components/skeletons"

export const metadata: Metadata = {
  title: "Clients - PMS",
}

async function ClientsList({ orgId }: { orgId: string }) {
  const result = await getCachedClientsWithProjectCounts(orgId)
  const clients = result.data || []
  return <ClientsContent initialClients={clients} organizationId={orgId} />
}

export default async function Page() {
  const { orgId } = await getPageOrganization()

  return (
    <Suspense fallback={<ClientsListSkeleton />}>
      <ClientsList orgId={orgId} />
    </Suspense>
  )
}
