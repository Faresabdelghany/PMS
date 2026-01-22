import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { OrganizationProvider } from "@/components/providers/organization-provider"
import type { OrganizationWithRole } from "@/hooks/use-organization"

async function getOrganizations(): Promise<OrganizationWithRole[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      role,
      organization:organizations(*)
    `)
    .eq("user_id", user.id)

  if (error || !data) {
    return []
  }

  return data
    .filter((m) => m.organization)
    .map((m) => ({
      ...(m.organization as unknown as OrganizationWithRole),
      role: m.role as "admin" | "member",
    }))
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const organizations = await getOrganizations()

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  return (
    <OrganizationProvider initialOrganizations={organizations}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Suspense fallback={null}>{children}</Suspense>
        </SidebarInset>
      </SidebarProvider>
    </OrganizationProvider>
  )
}
