import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ClientsContent } from "@/components/clients-content"
import { getCachedClientsWithProjectCounts, getCachedActiveOrgFromKV } from "@/lib/server-cache"
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
  // Use KV-cached org - instant hit from layout's cache warming (~5ms)
  const org = await getCachedActiveOrgFromKV()

  if (!org) {
    redirect("/login")
  }

  const organizationId = org.id

  return (
    <Suspense fallback={<ClientsListSkeleton />}>
      <ClientsList orgId={organizationId} />
    </Suspense>
  )
}
