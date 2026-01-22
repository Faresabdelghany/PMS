import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { OrganizationProvider } from "@/components/providers/organization-provider"
import { UserProvider } from "@/components/providers/user-provider"
import type { OrganizationWithRole } from "@/hooks/use-organization"
import type { Profile, Project } from "@/lib/supabase/types"

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

async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  return data
}

async function getActiveProjects(organizationId: string): Promise<Project[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["active", "planned"])
    .order("updated_at", { ascending: false })
    .limit(5)

  return data || []
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

  const [organizations, profile] = await Promise.all([
    getOrganizations(),
    getUserProfile(user.id),
  ])

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  // Get active projects for the first organization
  const activeProjects = await getActiveProjects(organizations[0].id)

  return (
    <UserProvider
      initialUser={{ id: user.id, email: user.email || "" }}
      initialProfile={profile}
    >
      <OrganizationProvider initialOrganizations={organizations}>
        <SidebarProvider>
          <AppSidebar activeProjects={activeProjects} />
          <SidebarInset>
            <Suspense fallback={null}>{children}</Suspense>
          </SidebarInset>
        </SidebarProvider>
      </OrganizationProvider>
    </UserProvider>
  )
}
