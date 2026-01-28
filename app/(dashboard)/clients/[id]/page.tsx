import { notFound, redirect } from "next/navigation"
import { getClientWithProjects } from "@/lib/actions/clients"
import { ClientDetailsContent } from "@/components/clients/ClientDetailsContent"
import { cachedGetUserOrganizations } from "@/lib/request-cache"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Parallel fetch - both requests are independent
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const [orgsResult, result] = await Promise.all([
    cachedGetUserOrganizations(),
    getClientWithProjects(id),
  ])

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/login")
  }

  if (result.error || !result.data) {
    notFound()
  }

  return <ClientDetailsContent client={result.data} />
}
