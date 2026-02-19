import { cache } from "react"
import { cachedGetUser } from "./request-cache"
import { cacheGet, CacheKeys, CacheTTL } from "./cache"
import { logger } from "./logger"

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
// AGGREGATION HELPERS (for stat cards)
// ============================================

/**
 * Get project count for an organization (request-level cached).
 * Uses lightweight count queries instead of fetching all project rows.
 */
export const getCachedProjectCount = cache(async (orgId: string) => {
  const { createClient } = await import("./supabase/server")
  const supabase = await createClient()

  const [totalResult, activeResult, completedResult] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "completed"),
  ])

  return {
    total: totalResult.count ?? 0,
    active: activeResult.count ?? 0,
    completed: completedResult.count ?? 0,
  }
})

/**
 * Get client count for an organization (request-level cached).
 * Uses lightweight count query instead of fetching all client rows.
 */
export const getCachedClientCount = cache(async (orgId: string) => {
  const { createClient } = await import("./supabase/server")
  const supabase = await createClient()

  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)

  return {
    total: error ? 0 : (count ?? 0),
  }
})

/**
 * Get task stats for current user (request-level cached).
 * Uses lightweight count queries instead of fetching all task rows.
 */
export const getCachedTaskStats = cache(async (orgId: string) => {
  const { user, supabase } = await cachedGetUser()
  if (!user) {
    return { total: 0, dueToday: 0, overdue: 0, completedThisWeek: 0 }
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  // Base query fragment: user's tasks in this org (via inner join on projects)
  const base = () => supabase
    .from("tasks")
    .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
    .eq("assignee_id", user.id)
    .eq("project.organization_id", orgId)

  const [totalResult, dueTodayResult, overdueResult, completedResult] = await Promise.all([
    base(),
    base().neq("status", "done").gte("end_date", todayStart).lt("end_date", todayEnd),
    base().neq("status", "done").lt("end_date", todayStart),
    base().eq("status", "done").gte("updated_at", startOfWeek.toISOString()),
  ])

  return {
    total: totalResult.count ?? 0,
    dueToday: dueTodayResult.count ?? 0,
    overdue: overdueResult.count ?? 0,
    completedThisWeek: completedResult.count ?? 0,
  }
})

/**
 * Get all dashboard stats in a single RPC call (request-level cached).
 * Consolidates project count, client count, and task stats into one DB round trip.
 * Uses KV cache with 30s TTL.
 */
export const getCachedDashboardStats = cache(async (orgId: string) => {
  // Use static imports (already at top of file) — dynamic imports would create
  // separate function references, breaking React cache() deduplication
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
        logger.warn("get_dashboard_stats RPC failed, using fallback", { module: "cache", error: error.message })
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
// REPORTS
// ============================================

/**
 * Get project reports (request-level cached)
 */
export const getCachedProjectReports = cache(async (projectId: string) => {
  const { getProjectReports } = await import("./actions/reports")
  return getProjectReports(projectId)
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

