import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClientsContent } from "@/components/clients-content"
import { getClientsWithProjectCounts, type ClientWithProjectCount } from "@/lib/actions/clients"

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

export default async function Page() {
  const organizationId = await getOrganizationId()

  if (!organizationId) {
    redirect("/login")
  }

  const result = await getClientsWithProjectCounts(organizationId)
  const clients = result.data || []

  return <ClientsContent initialClients={clients} />
}
