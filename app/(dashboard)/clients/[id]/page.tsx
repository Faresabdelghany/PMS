import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ClientDetailsContent } from "@/components/clients/ClientDetailsContent"
import { getCachedClientWithProjects } from "@/lib/server-cache"
import { ClientDetailsSkeleton } from "@/components/skeletons"

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getCachedClientWithProjects(id)
  const name = result.data?.name ?? "Client"
  return { title: `${name} - PMS` }
}

async function ClientDetailStreamed({ id }: { id: string }) {
  // Auth is handled by the dashboard layout — no need for getPageOrganization()
  // since this entity detail page derives context from the client ID, not org ID
  const result = await getCachedClientWithProjects(id)

  if (result.error || !result.data) {
    notFound()
  }

  return <ClientDetailsContent client={result.data} />
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<ClientDetailsSkeleton />}>
      <ClientDetailStreamed id={id} />
    </Suspense>
  )
}
