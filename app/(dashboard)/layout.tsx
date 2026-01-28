import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { OrganizationProvider } from "@/components/providers/organization-provider"
import { UserProvider } from "@/components/providers/user-provider"
import { RealtimeProvider } from "@/hooks/realtime-context"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
import type { OrganizationWithRole } from "@/hooks/use-organization"
import type { Profile, Project } from "@/lib/supabase/types"

async function getOrganizations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrganizationWithRole[]> {
  return cacheGet(
    CacheKeys.userOrgs(userId),
    async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          role,
          organization:organizations(*)
        `)
        .eq("user_id", userId)

      if (error || !data) {
        return []
      }

      return data
        .filter((m) => m.organization)
        .map((m) => ({
          ...(m.organization as unknown as OrganizationWithRole),
          role: m.role as "admin" | "member",
        }))
    },
    CacheTTL.ORGS
  )
}

async function getActiveProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<Project[]> {
  return cacheGet(
    CacheKeys.sidebar(organizationId),
    async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(7)

      return data || []
    },
    CacheTTL.SIDEBAR
  )
}

async function getUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Profile | null> {
  return cacheGet(
    CacheKeys.user(userId),
    async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      return data
    },
    CacheTTL.USER
  )
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

  // Start organizations and profile queries in parallel (no dependencies)
  const [organizations, profile] = await Promise.all([
    getOrganizations(supabase, user.id),
    getUserProfile(supabase, user.id),
  ])

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  // Now that we have org ID, fetch active projects
  // This query starts immediately after we have the org ID
  const activeProjects = await getActiveProjects(supabase, organizations[0].id)

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
