/**
 * Cross-Request Cached Data Fetching
 *
 * This module provides cross-request caching using Next.js unstable_cache.
 * Unlike React's cache() which only deduplicates within a single request,
 * these functions cache data across multiple requests with configurable TTLs.
 *
 * Cache invalidation is handled via revalidateTag() in server actions.
 *
 * @see lib/cache-tags.ts for cache tag definitions
 * @see lib/server-cache.ts for request-level caching
 */

import { unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { CacheTags } from "@/lib/cache-tags"

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  // For data with real-time subscriptions (projects, tasks)
  // Aggressive caching is safe because WebSockets push live updates after initial load
  realtimeBacked: 300, // 5 minutes
  // For data that changes infrequently (members, tags)
  semiStatic: 900, // 15 minutes
}

// ============================================
// PROJECT DETAILS (with full relations)
// ============================================

/**
 * Get project with all details - cross-request cached
 *
 * This is the main query for the project detail page. It fetches:
 * - Base project data with client, team, and members
 * - Scope items, outcomes, features, deliverables, metrics
 * - Notes and files
 *
 * Cache strategy: realtimeBacked (5min TTL)
 * - Real-time subscriptions push updates after initial load
 * - Short TTL ensures fresh data on navigation
 */
export async function getCachedProjectDetails(projectId: string) {
  const fetchProjectDetails = unstable_cache(
    async () => {
      const supabase = await createClient()

      // Verify auth - cached data is still protected
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: { message: "Unauthorized" } }
      }

      // Fetch base project with relations
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select(
          `
          *,
          client:clients(*),
          team:teams(*),
          project_members(
            id,
            user_id,
            role,
            profile:profiles(id, full_name, avatar_url, email)
          )
        `
        )
        .eq("id", projectId)
        .single()

      if (projectError || !project) {
        return { data: null, error: projectError }
      }

      // Fetch all detail tables in parallel
      const [
        scopeResult,
        outcomesResult,
        featuresResult,
        deliverablesResult,
        metricsResult,
        notesResult,
        filesResult,
      ] = await Promise.all([
        supabase
          .from("project_scope")
          .select("id, item, is_in_scope, sort_order")
          .eq("project_id", projectId)
          .order("sort_order"),
        supabase
          .from("project_outcomes")
          .select("id, item, sort_order")
          .eq("project_id", projectId)
          .order("sort_order"),
        supabase
          .from("project_features")
          .select("id, item, priority, sort_order")
          .eq("project_id", projectId)
          .order("priority")
          .order("sort_order"),
        supabase
          .from("project_deliverables")
          .select("id, title, due_date, value, status, payment_status, sort_order")
          .eq("project_id", projectId)
          .order("sort_order"),
        supabase
          .from("project_metrics")
          .select("id, name, target, sort_order")
          .eq("project_id", projectId)
          .order("sort_order"),
        supabase
          .from("project_notes")
          .select(
            `
            id,
            title,
            content,
            note_type,
            status,
            added_by_id,
            audio_data,
            created_at,
            updated_at,
            author:profiles!added_by_id(id, full_name, avatar_url, email)
          `
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("project_files")
          .select(
            `
            id,
            name,
            file_type,
            size_bytes,
            url,
            description,
            created_at,
            added_by_id,
            profiles:profiles!added_by_id(id, full_name, email, avatar_url)
          `
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
      ])

      return {
        data: {
          ...project,
          scope: scopeResult.data || [],
          outcomes: outcomesResult.data || [],
          features: featuresResult.data || [],
          deliverables: deliverablesResult.data || [],
          metrics: metricsResult.data || [],
          notes: notesResult.data || [],
          files: filesResult.data || [],
        },
        error: null,
      }
    },
    [`project-details-${projectId}`],
    {
      revalidate: CACHE_TTL.realtimeBacked,
      tags: [CacheTags.project(projectId), CacheTags.projectDetails(projectId)],
    }
  )

  return fetchProjectDetails()
}

// ============================================
// TASKS (for project)
// ============================================

/**
 * Get all tasks for a project - cross-request cached
 *
 * Cache strategy: realtimeBacked (5min TTL)
 * - Task updates are pushed via real-time after initial load
 */
export async function getCachedProjectTasks(projectId: string) {
  const fetchTasks = unstable_cache(
    async () => {
      const supabase = await createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: { message: "Unauthorized" } }
      }

      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!assignee_id(id, full_name, avatar_url, email),
          workstream:workstreams(id, name)
        `
        )
        .eq("project_id", projectId)
        .order("sort_order")

      return { data, error }
    },
    [`project-tasks-${projectId}`],
    {
      revalidate: CACHE_TTL.realtimeBacked,
      tags: [CacheTags.tasks(projectId)],
    }
  )

  return fetchTasks()
}

// ============================================
// WORKSTREAMS (with tasks)
// ============================================

/**
 * Get workstreams with nested tasks - cross-request cached
 *
 * Cache strategy: realtimeBacked (5min TTL)
 */
export async function getCachedProjectWorkstreams(projectId: string) {
  const fetchWorkstreams = unstable_cache(
    async () => {
      const supabase = await createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: { message: "Unauthorized" } }
      }

      const { data, error } = await supabase
        .from("workstreams")
        .select(
          `
          *,
          tasks(
            id,
            name,
            status,
            priority,
            tag,
            start_date,
            end_date,
            sort_order,
            assignee_id
          )
        `
        )
        .eq("project_id", projectId)
        .order("sort_order")

      return { data, error }
    },
    [`project-workstreams-${projectId}`],
    {
      revalidate: CACHE_TTL.realtimeBacked,
      tags: [CacheTags.workstreams(projectId)],
    }
  )

  return fetchWorkstreams()
}

// ============================================
// ORGANIZATION DATA (clients, members, tags)
// ============================================

/**
 * Get clients for an organization - cross-request cached
 *
 * Cache strategy: semiStatic (15min TTL)
 * - Clients change less frequently than tasks/projects
 */
export async function getCachedOrgClients(orgId: string) {
  const fetchClients = unstable_cache(
    async () => {
      const supabase = await createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: { message: "Unauthorized" } }
      }

      const { data, error } = await supabase
        .from("clients")
        .select(
          `
          *,
          owner:profiles!owner_id(id, full_name, avatar_url)
        `
        )
        .eq("organization_id", orgId)
        .order("name")

      return { data, error }
    },
    [`org-clients-${orgId}`],
    {
      revalidate: CACHE_TTL.semiStatic,
      tags: [CacheTags.clients(orgId)],
    }
  )

  return fetchClients()
}

/**
 * Get organization members - cross-request cached
 *
 * Cache strategy: semiStatic (15min TTL)
 * - Member list changes infrequently
 */
export async function getCachedOrgMembers(orgId: string) {
  const fetchMembers = unstable_cache(
    async () => {
      const supabase = await createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: { message: "Unauthorized" } }
      }

      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
          id,
          user_id,
          role,
          created_at,
          profile:profiles(id, full_name, avatar_url, email)
        `
        )
        .eq("organization_id", orgId)

      return { data, error }
    },
    [`org-members-${orgId}`],
    {
      revalidate: CACHE_TTL.semiStatic,
      tags: [CacheTags.organizationMembers(orgId)],
    }
  )

  return fetchMembers()
}

/**
 * Get organization tags - cross-request cached
 *
 * Cache strategy: semiStatic (15min TTL)
 * - Tags change infrequently
 */
export async function getCachedOrgTags(orgId: string) {
  const fetchTags = unstable_cache(
    async () => {
      const supabase = await createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: { message: "Unauthorized" } }
      }

      const { data, error } = await supabase
        .from("organization_tags")
        .select("*")
        .eq("organization_id", orgId)
        .order("name")

      return { data, error }
    },
    [`org-tags-${orgId}`],
    {
      revalidate: CACHE_TTL.semiStatic,
      tags: [CacheTags.tags(orgId)],
    }
  )

  return fetchTags()
}

// ============================================
// COMBINED ORG DATA FETCH (parallel)
// ============================================

/**
 * Fetch all organization-scoped data in parallel
 * This is optimized for the project detail page which needs
 * clients, members, and tags together
 */
export async function getCachedOrgData(orgId: string) {
  const [clients, members, tags] = await Promise.all([
    getCachedOrgClients(orgId),
    getCachedOrgMembers(orgId),
    getCachedOrgTags(orgId),
  ])

  return { clients, members, tags }
}
