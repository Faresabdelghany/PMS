import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getClientWithProjects } from "@/lib/actions/clients"
import { ClientDetailsContent } from "@/components/clients/ClientDetailsContent"
import { getPageOrganization } from "@/lib/page-auth"

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getClientWithProjects(id)
  const name = result.data?.name ?? "Client"
  return { title: `${name} - PMS` }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  await getPageOrganization()

  const result = await getClientWithProjects(id)

  if (result.error || !result.data) {
    notFound()
  }

  return <ClientDetailsContent client={result.data} />
}
