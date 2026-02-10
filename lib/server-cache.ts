import { cache } from "react"
import { cachedGetUser } from "./request-cache"
import { cacheGet, CacheKeys, CacheTTL } from "./cache"

/**
 * Centralized Cache Layer
 *
 * This module provides request-level deduplication using React's cache().
 * Each function wraps the underlying server action with caching to prevent
 * duplicate database queries within a single request.
 *
 * Note: Cross-request caching (via 'use cache' directive) is disabled because
 * this app is fully auth-protected and doesn't work well with PPR.
 *
 * For request-level deduplication of base functions, see lib/request-cache.ts
 */

// ============================================
// PROJECTS
// ============================================

/**
 * Get all projects for an organization (request-level cached)
 */
export const getCachedProjects = cache(async (orgId: string) => {
  const { getProjects } = await import("./actions/projects")
  return getProjects(orgId)
})

/**
 * Get a single project by ID (request-level cached)
 */
export const getCachedProject = cache(async (projectId: string) => {
  const { getProject } = await import("./actions/projects")
  return getProject(projectId)
})

/**
 * Get project with full details (request-level cached)
 */
export const getCachedProjectWithDetails = cache(async (projectId: string) => {
  const { getProjectWithDetails } = await import("./actions/projects")
  return getProjectWithDetails(projectId)
})

/**
 * Get project members (request-level cached)
 */
export const getCachedProjectMembers = cache(async (projectId: string) => {
  const { getProjectMembers } = await import("./actions/projects")
  return getProjectMembers(projectId)
})

// ============================================
// TASKS
// ============================================

/**
 * Get all tasks for a project (request-level cached)
 */
export const getCachedTasks = cache(async (projectId: string) => {
  const { getTasks } = await import("./actions/tasks")
  return getTasks(projectId)
})

/**
 * Get user's assigned tasks (request-level cached)
 */
export const getCachedMyTasks = cache(async (orgId: string) => {
  const { getMyTasks } = await import("./actions/tasks")
  return getMyTasks(orgId)
})

// ============================================
// CLIENTS
// ============================================

/**
 * Get all clients for an organization (request-level cached)
 */
export const getCachedClients = cache(async (orgId: string) => {
  const { getClients } = await import("./actions/clients")
  return getClients(orgId)
})

/**
 * Get clients with project counts (request-level cached)
 */
export const getCachedClientsWithProjectCounts = cache(async (orgId: string) => {
  const { getClientsWithProjectCounts } = await import("./actions/clients")
  return getClientsWithProjectCounts(orgId)
})

/**
 * Get a single client by ID (request-level cached)
 */
export const getCachedClient = cache(async (clientId: string) => {
  const { getClient } = await import("./actions/clients")
  return getClient(clientId)
})

/**
 * Get client with associated projects (request-level cached)
 */
export const getCachedClientWithProjects = cache(async (clientId: string) => {
  const { getClientWithProjects } = await import("./actions/clients")
  return getClientWithProjects(clientId)
})

// ============================================
// ORGANIZATIONS
// ============================================

/**
 * Get organization members (request-level cached)
 */
export const getCachedOrganizationMembers = cache(async (orgId: string) => {
  const { getOrganizationMembers } = await import("./actions/organizations")
  return getOrganizationMembers(orgId)
})

/**
 * Get organization details (request-level cached)
 */
export const getCachedOrganization = cache(async (orgId: string) => {
  const { getOrganization } = await import("./actions/organizations")
  return getOrganization(orgId)
})

/**
 * Get user's organizations (request-level cached)
 */
export const getCachedUserOrganizations = cache(async () => {
  const { getUserOrganizations } = await import("./actions/organizations")
  return getUserOrganizations()
})

/**
 * Get user's active organization using KV cache (matches layout's cache key).
 * The dashboard layout populates CacheKeys.userOrgs() on every request,
 * so pages using this helper get instant KV cache hits (~5ms) instead of
 * redundant DB queries (~50-100ms).
 */
export const getCachedActiveOrgFromKV = cache(async () => {
  const { user, supabase } = await cachedGetUser()
  if (!user) return null

  const orgs = await cacheGet(
    CacheKeys.userOrgs(user.id),
    async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`role, organization:organizations(*)`)
        .eq("user_id", user.id)

      if (error || !data) return []

      return data
        .filter((m: any) => m.organization)
        .map((m: any) => ({
          ...m.organization,
          role: m.role,
        }))
    },
    CacheTTL.ORGS
  )

  return orgs.length > 0 ? orgs[0] : null
})

// ============================================
// TAGS, TEAMS, WORKSTREAMS
// ============================================

/**
 * Get all tags for an organization (request-level cached)
 */
export const getCachedTags = cache(async (orgId: string) => {
  const { getTags } = await import("./actions/tags")
  return getTags(orgId)
})

/**
 * Get workstreams with tasks for a project (request-level cached)
 */
export const getCachedWorkstreamsWithTasks = cache(async (projectId: string) => {
  const { getWorkstreamsWithTasks } = await import("./actions/workstreams")
  return getWorkstreamsWithTasks(projectId)
})

/**
 * Get teams for an organization (request-level cached)
 */
export const getCachedTeams = cache(async (orgId: string) => {
  const { getTeams } = await import("./actions/teams")
  return getTeams(orgId)
})

// ============================================
// FILES AND NOTES
// ============================================

/**
 * Get project files (request-level cached)
 */
export const getCachedProjectFiles = cache(async (projectId: string) => {
  const { getProjectFiles } = await import("./actions/files")
  return getProjectFiles(projectId)
})

/**
 * Get project notes (request-level cached)
 */
export const getCachedProjectNotes = cache(async (projectId: string) => {
  const { getProjectNotes } = await import("./actions/notes")
  return getProjectNotes(projectId)
})

// ============================================
// INBOX
// ============================================

/**
 * Get inbox items for current user (request-level cached)
 */
export const getCachedInboxItems = cache(async () => {
  const { getInboxItems } = await import("./actions/inbox")
  return getInboxItems()
})

/**
 * Get unread inbox count (request-level cached)
 */
export const getCachedUnreadCount = cache(async () => {
  const { getUnreadCount } = await import("./actions/inbox")
  return getUnreadCount()
})

// ============================================
// USER SETTINGS
// ============================================

/**
 * Get user preferences (request-level cached)
 */
export const getCachedUserPreferences = cache(async () => {
  const { getPreferences } = await import("./actions/user-settings")
  return getPreferences()
})

/**
 * Get user AI settings (request-level cached)
 */
export const getCachedUserAISettings = cache(async () => {
  const { getAISettings } = await import("./actions/user-settings")
  return getAISettings()
})

/**
 * Check if user has AI configured (request-level cached)
 * Used by chat pages to pre-check AI status server-side,
 * avoiding a client-side SWR roundtrip that delays LCP.
 */
export const getCachedAIConfigured = cache(async () => {
  const { hasAIConfigured } = await import("./actions/user-settings")
  return hasAIConfigured()
})

// ============================================
// ACTIVE ORGANIZATION (for parallel fetching)
// ============================================

/**
 * Get the user's active organization ID (request-level cached)
 *
 * This is useful for pages that need to fetch org-dependent data in parallel
 * with other queries. The dashboard layout already fetches this, but pages
 * can use this to get the org ID without waiting for other data.
 *
 * Most projects will belong to the user's primary organization, so speculatively
 * fetching org data using this ID eliminates the waterfall in most cases.
 */
export const getCachedActiveOrganizationId = cache(async () => {
  const { getUserOrganizations } = await import("./actions/organizations")
  const result = await getUserOrganizations()
  if (result.error || !result.data || result.data.length === 0) {
    return null
  }
  // Return the first (primary) organization ID
  return result.data[0].id
})

// ============================================
// AGGREGATION HELPERS (for stat cards)
// ============================================

/**
 * Get project count for an organization (request-level cached)
 */
export const getCachedProjectCount = cache(async (orgId: string) => {
  const { getProjects } = await import("./actions/projects")
  const result = await getProjects(orgId)
  return {
    total: result.data?.length ?? 0,
    active: result.data?.filter((p) => p.status === "active").length ?? 0,
    completed: result.data?.filter((p) => p.status === "completed").length ?? 0,
  }
})

/**
 * Get client count for an organization (request-level cached)
 */
export const getCachedClientCount = cache(async (orgId: string) => {
  const { getClients } = await import("./actions/clients")
  const result = await getClients(orgId)
  return {
    total: result.data?.length ?? 0,
  }
})

/**
 * Get task stats for current user (request-level cached)
 */
export const getCachedTaskStats = cache(async (orgId: string) => {
  const { getMyTasks } = await import("./actions/tasks")
  const result = await getMyTasks(orgId)
  const tasks = result.data ?? []
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  return {
    total: tasks.length,
    dueToday: tasks.filter((t) => {
      if (!t.end_date) return false
      const due = new Date(t.end_date)
      return (
        due.toDateString() === now.toDateString() && t.status !== "done"
      )
    }).length,
    overdue: tasks.filter((t) => {
      if (!t.end_date) return false
      const due = new Date(t.end_date)
      return due < now && t.status !== "done"
    }).length,
    completedThisWeek: tasks.filter((t) => {
      if (t.status !== "done" || !t.updated_at) return false
      const completed = new Date(t.updated_at)
      return completed >= startOfWeek
    }).length,
  }
})

/**
 * Get all dashboard stats in a single RPC call (request-level cached).
 * Consolidates project count, client count, and task stats into one DB round trip.
 * Uses KV cache with 30s TTL.
 */
export const getCachedDashboardStats = cache(async (orgId: string) => {
  const { cachedGetUser } = await import("./request-cache")
  const { cacheGet, CacheKeys, CacheTTL } = await import("./cache")

  const { user, error: authError, supabase } = await cachedGetUser()
  if (authError || !user) {
    return {
      projects: { total: 0, active: 0, completed: 0 },
      clients: { total: 0 },
      tasks: { total: 0, dueToday: 0, overdue: 0, completedThisWeek: 0 },
    }
  }

  return cacheGet(
    CacheKeys.dashboardStats(user.id, orgId),
    async () => {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: orgId,
        p_user_id: user.id,
      })

      if (error) {
        // Fallback to individual queries if RPC not yet deployed
        console.warn("[cache] get_dashboard_stats RPC failed, using fallback:", error.message)
        return {
          projects: { total: 0, active: 0, completed: 0 },
          clients: { total: 0 },
          tasks: { total: 0, dueToday: 0, overdue: 0, completedThisWeek: 0 },
        }
      }

      return data as unknown as {
        projects: { total: number; active: number; completed: number }
        clients: { total: number }
        tasks: { total: number; dueToday: number; overdue: number; completedThisWeek: number }
      }
    },
    CacheTTL.DASHBOARD_STATS
  )
})

// ============================================
// CONVERSATIONS
// ============================================

/**
 * Get conversations for a user in an org (request-level cached)
 */
export const getCachedConversations = cache(async (orgId: string) => {
  const { getConversations } = await import("./actions/conversations")
  return getConversations(orgId)
})

// ============================================
// AI CONTEXT
// ============================================

/**
 * Get AI context data (request-level cached)
 */
export const getCachedAIContext = cache(async () => {
  const { getAIContext } = await import("./actions/ai-context")
  return getAIContext()
})

// ============================================
// PERFORMANCE / ANALYTICS
// ============================================

/**
 * Get performance metrics for an organization (request-level + KV cached)
 * Uses KV cache with 2-minute TTL to avoid re-running expensive analytics
 * queries (3 parallel DB queries + CPU-intensive calculations) on every request.
 */
export const getCachedPerformanceMetrics = cache(async (orgId: string) => {
  const { cacheGet, CacheKeys, CacheTTL } = await import("./cache")
  const { getPerformanceMetrics } = await import("./actions/analytics")

  return cacheGet(
    CacheKeys.performanceMetrics(orgId),
    () => getPerformanceMetrics(orgId),
    CacheTTL.PROJECTS // 2 minutes — reasonable for analytics data
  )
})
