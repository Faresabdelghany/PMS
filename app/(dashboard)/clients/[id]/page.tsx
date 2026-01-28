import { notFound, redirect } from "next/navigation"
import { getClientWithProjects } from "@/lib/actions/clients"
import { ClientDetailsContent } from "@/components/clients/ClientDetailsContent"
import { getUserOrganizations } from "@/lib/actions/organizations"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/login")
  }

  const result = await getClientWithProjects(id)

  if (result.error || !result.data) {
    notFound()
  }

  return <ClientDetailsContent client={result.data} />
}
