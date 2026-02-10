import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getClientWithProjects } from "@/lib/actions/clients"
import { ClientDetailsContent } from "@/components/clients/ClientDetailsContent"
import { getCachedActiveOrgFromKV } from "@/lib/server-cache"

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

  // Parallel fetch - both requests are independent
  // Use KV-cached org - instant hit from layout's cache warming (~5ms)
  const [org, result] = await Promise.all([
    getCachedActiveOrgFromKV(),
    getClientWithProjects(id),
  ])

  if (!org) {
    redirect("/login")
  }

  if (result.error || !result.data) {
    notFound()
  }

  return <ClientDetailsContent client={result.data} />
}
