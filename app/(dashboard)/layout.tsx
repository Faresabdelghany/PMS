import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { cachedGetUser } from "@/lib/request-cache"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { OrganizationProvider } from "@/components/providers/organization-provider"
import { UserProvider } from "@/components/providers/user-provider"
import { RealtimeProvider } from "@/hooks/realtime-context"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
import type { OrganizationWithRole } from "@/hooks/use-organization"
import type { Profile, Project } from "@/lib/supabase/types"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type TypedSupabaseClient = SupabaseClient<Database>

async function getOrganizations(
  supabase: TypedSupabaseClient,
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
  supabase: TypedSupabaseClient,
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
  supabase: TypedSupabaseClient,
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
  // Use cached auth - shared with child pages (no duplicate DB hit)
  const { user, supabase } = await cachedGetUser()

  if (!user) {
    redirect("/login")
  }

  // Start ALL queries in parallel - no waterfall!
  // We start activeProjects query speculatively and check org access afterward
  const orgsPromise = getOrganizations(supabase, user.id)
  const profilePromise = getUserProfile(supabase, user.id)

  // Wait for orgs first to check if user has any (fast due to KV cache)
  const organizations = await orgsPromise

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  // Now fetch profile and activeProjects in parallel
  const [profile, activeProjects] = await Promise.all([
    profilePromise,
    getActiveProjects(supabase, organizations[0].id),
  ])

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
