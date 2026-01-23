import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getClientWithProjects } from "@/lib/actions/clients"
import { ClientDetailsContent } from "@/components/clients/ClientDetailsContent"

type PageProps = {
  params: Promise<{ id: string }>
}

async function getOrganizationId(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  return data?.organization_id || null
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  const organizationId = await getOrganizationId()

  if (!organizationId) {
    redirect("/login")
  }

  const result = await getClientWithProjects(id)

  if (result.error || !result.data) {
    notFound()
  }

  return <ClientDetailsContent client={result.data} />
}
