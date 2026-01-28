import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Request-level cache utilities
 *
 * React's cache() function deduplicates requests within a single server render.
 * This prevents the same query from being executed multiple times when multiple
 * components need the same data during a single request.
 *
 * Usage:
 *   // Instead of calling getProjects() directly in multiple components,
 *   // import the cached version:
 *   import { cachedGetProjects } from "@/lib/cache"
 *   const { data } = await cachedGetProjects(orgId)
 */

// Lazy imports to avoid circular dependencies and keep server actions in their files
// We use dynamic imports inside the cached functions

/**
 * Cached auth check - deduplicates supabase.auth.getUser() within a single request
 * This is critical for performance: layout and pages can both call this without duplicate DB hits
 */
export const cachedGetUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error, supabase }
})

/**
 * Cached version of getProjects - deduplicates within a single request
 */
export const cachedGetProjects = cache(async (orgId: string, filters?: Parameters<typeof import("./actions/projects").getProjects>[1]) => {
  const { getProjects } = await import("./actions/projects")
  return getProjects(orgId, filters)
})

/**
 * Cached version of getProject - deduplicates within a single request
 */
export const cachedGetProject = cache(async (id: string) => {
  const { getProject } = await import("./actions/projects")
  return getProject(id)
})

/**
 * Cached version of getProjectWithDetails - deduplicates within a single request
 */
export const cachedGetProjectWithDetails = cache(async (id: string) => {
  const { getProjectWithDetails } = await import("./actions/projects")
  return getProjectWithDetails(id)
})

/**
 * Cached version of getClients - deduplicates within a single request
 */
export const cachedGetClients = cache(async (orgId: string, filters?: Parameters<typeof import("./actions/clients").getClients>[1]) => {
  const { getClients } = await import("./actions/clients")
  return getClients(orgId, filters)
})

/**
 * Cached version of getClientsWithProjectCounts - deduplicates within a single request
 */
export const cachedGetClientsWithProjectCounts = cache(async (orgId: string, filters?: Parameters<typeof import("./actions/clients").getClientsWithProjectCounts>[1]) => {
  const { getClientsWithProjectCounts } = await import("./actions/clients")
  return getClientsWithProjectCounts(orgId, filters)
})

/**
 * Cached version of getUserOrganizations - deduplicates within a single request
 */
export const cachedGetUserOrganizations = cache(async () => {
  const { getUserOrganizations } = await import("./actions/organizations")
  return getUserOrganizations()
})

/**
 * Cached version of getOrganization - deduplicates within a single request
 */
export const cachedGetOrganization = cache(async (id: string) => {
  const { getOrganization } = await import("./actions/organizations")
  return getOrganization(id)
})

/**
 * Cached version of getOrganizationMembers - deduplicates within a single request
 */
export const cachedGetOrganizationMembers = cache(async (orgId: string) => {
  const { getOrganizationMembers } = await import("./actions/organizations")
  return getOrganizationMembers(orgId)
})

/**
 * Cached version of getTasks - deduplicates within a single request
 */
export const cachedGetTasks = cache(async (projectId: string, filters?: Parameters<typeof import("./actions/tasks").getTasks>[1]) => {
  const { getTasks } = await import("./actions/tasks")
  return getTasks(projectId, filters)
})

/**
 * Cached version of getMyTasks - deduplicates within a single request
 */
export const cachedGetMyTasks = cache(async (orgId: string, filters?: Parameters<typeof import("./actions/tasks").getMyTasks>[1]) => {
  const { getMyTasks } = await import("./actions/tasks")
  return getMyTasks(orgId, filters)
})

/**
 * Cached version of getProjectMembers - deduplicates within a single request
 */
export const cachedGetProjectMembers = cache(async (projectId: string) => {
  const { getProjectMembers } = await import("./actions/projects")
  return getProjectMembers(projectId)
})
