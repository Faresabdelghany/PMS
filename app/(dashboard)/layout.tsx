import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { OrganizationProvider } from "@/components/providers/organization-provider"
import { UserProvider } from "@/components/providers/user-provider"
import { RealtimeProvider } from "@/hooks/realtime-context"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
import type { OrganizationWithRole } from "@/hooks/use-organization"
import type { Profile, Project } from "@/lib/supabase/types"

async function getOrganizationsWithActiveProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ organizations: OrganizationWithRole[]; activeProjects: Project[] }> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      role,
      organization:organizations(*)
    `)
    .eq("user_id", userId)

  if (error || !data) {
    return { organizations: [], activeProjects: [] }
  }

  const organizations = data
    .filter((m) => m.organization)
    .map((m) => ({
      ...(m.organization as unknown as OrganizationWithRole),
      role: m.role as "admin" | "member",
    }))

  // If we have organizations, fetch active projects for the first one in parallel
  if (organizations.length === 0) {
    return { organizations, activeProjects: [] }
  }

  const { data: activeProjects } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizations[0].id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(7)

  return { organizations, activeProjects: activeProjects || [] }
}

async function getUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  return data
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

  // Fetch organizations (with active projects) and profile in parallel
  const [{ organizations, activeProjects }, profile] = await Promise.all([
    getOrganizationsWithActiveProjects(supabase, user.id),
    getUserProfile(supabase, user.id),
  ])

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  return (
    <UserProvider
      initialUser={{ id: user.id, email: user.email || "" }}
      initialProfile={profile}
    >
      <OrganizationProvider initialOrganizations={organizations}>
        <RealtimeProvider>
          <CommandPaletteProvider>
            <SidebarProvider>
              <AppSidebar activeProjects={activeProjects} />
              <SidebarInset>
                <Suspense fallback={null}>{children}</Suspense>
              </SidebarInset>
            </SidebarProvider>
          </CommandPaletteProvider>
        </RealtimeProvider>
      </OrganizationProvider>
    </UserProvider>
  )
}
