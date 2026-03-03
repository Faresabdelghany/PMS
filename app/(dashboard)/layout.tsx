import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
import { cachedGetUser } from "@/lib/request-cache"
import { getCachedUnreadCount } from "@/lib/server-cache"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { OrganizationProvider } from "@/components/providers/organization-provider"
import { UserProvider } from "@/components/providers/user-provider"
import { RealtimeProvider } from "@/hooks/realtime-context"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
import { SettingsDialogProvider } from "@/components/providers/settings-dialog-provider"
import { NotificationToastProviderLazy } from "@/components/providers/notification-toast-provider-lazy"
import { SWRProvider } from "@/components/providers/swr-provider"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ColorThemeSyncer } from "@/components/color-theme-syncer"
import { getUserColorTheme, type ColorThemeType } from "@/lib/actions/user-settings"
import type { OrganizationWithRole } from "@/hooks/use-organization"
import type { Profile, Project } from "@/lib/supabase/types"
import { Toaster } from "@/components/ui/sonner"
import { MotionProvider } from "@/components/ui/motion-lazy"
import { GatewayProvider } from "@/hooks/gateway-context"
import { SIDEBAR_PROJECT_LIMIT } from "@/lib/constants"
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
        .in("status", ["active", "planned", "backlog"])
        .order("updated_at", { ascending: false })
        .limit(SIDEBAR_PROJECT_LIMIT)

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

async function getCachedColorTheme(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<ColorThemeType> {
  return cacheGet(
    CacheKeys.colorTheme(userId),
    async () => {
      return getUserColorTheme(supabase, userId)
    },
    CacheTTL.USER
  )
}

async function SidebarWithData({
  activeProjectsPromise,
  unreadCountPromise,
  pendingApprovalsPromise,
}: {
  activeProjectsPromise: Promise<Project[]>
  unreadCountPromise: Promise<{ data?: number }>
  pendingApprovalsPromise: Promise<{ data?: number }>
}) {
  const [activeProjects, unreadResult, pendingResult] = await Promise.all([
    activeProjectsPromise,
    unreadCountPromise,
    pendingApprovalsPromise,
  ])
  return (
    <AppSidebar
      activeProjects={activeProjects}
      initialUnreadCount={unreadResult.data ?? 0}
      initialPendingApprovalsCount={pendingResult.data ?? 0}
    />
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
  // Profile and colorTheme start immediately (don't depend on org ID)
  const orgsPromise = getOrganizations(supabase, user.id)
  const profilePromise = getUserProfile(supabase, user.id)
  const colorThemePromise = getCachedColorTheme(supabase, user.id)

  // Wait for orgs first to check if user has any (fast due to KV cache)
  const organizations = await orgsPromise

  if (organizations.length === 0) {
    redirect("/onboarding")
  }

  // activeProjects and unreadCount need org/user ID - start but DON'T block layout render
  const activeProjectsPromise = getActiveProjects(supabase, organizations[0].id)
  const unreadCountPromise = getCachedUnreadCount()
  // Pending approvals count (gracefully handles missing table)
  const pendingApprovalsPromise = import("@/lib/actions/approvals").then(
    (m) => m.getPendingApprovalsCount(organizations[0].id)
  ).catch(() => ({ data: 0 }))

  // Only await profile and colorTheme (they started in parallel, likely already resolved)
  const [profile, colorTheme] = await Promise.all([
    profilePromise,
    colorThemePromise,
  ])

  return (
    <SWRProvider>
      <UserProvider
        initialUser={{ id: user.id, email: user.email || "" }}
        initialProfile={profile}
      >
        <OrganizationProvider initialOrganizations={organizations}>
          <RealtimeProvider>
            <GatewayProvider orgId={organizations[0].id}>
              <MotionProvider>
                <SettingsDialogProvider>
                  <CommandPaletteProvider>
                    <ColorThemeSyncer serverTheme={colorTheme} />
                    <NotificationToastProviderLazy userId={user.id} />
                    <SidebarProvider>
                      <Suspense fallback={<AppSidebar activeProjects={[]} />}>
                        <SidebarWithData
                          activeProjectsPromise={activeProjectsPromise}
                          unreadCountPromise={unreadCountPromise}
                          pendingApprovalsPromise={pendingApprovalsPromise}
                        />
                      </Suspense>
                      <SidebarInset>
                        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
                      </SidebarInset>
                    </SidebarProvider>
                    <Toaster richColors closeButton />
                  </CommandPaletteProvider>
                </SettingsDialogProvider>
              </MotionProvider>
            </GatewayProvider>
          </RealtimeProvider>
        </OrganizationProvider>
      </UserProvider>
    </SWRProvider>
  )
}
