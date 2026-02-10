"use server"

import { createClient } from "@/lib/supabase/server"
import { cacheGet, CacheKeys, CacheTTL, hashQuery } from "@/lib/cache"
import { SEARCH_RESULTS_PER_CATEGORY } from "@/lib/constants"
import { sanitizeSearchInput } from "@/lib/search-utils"
import type { ActionResult } from "./types"

export type SearchResult = {
  id: string
  type: "project" | "task" | "client"
  title: string
  subtitle?: string
  url: string
}

export type SearchResults = {
  projects: SearchResult[]
  tasks: SearchResult[]
  clients: SearchResult[]
}

/**
 * Global search across projects, tasks, and clients
 * Limited to 5 results per category for performance
 * Results are cached for 30 seconds using query hash
 */
export async function globalSearch(
  orgId: string,
  query: string
): Promise<ActionResult<SearchResults>> {
  if (!query || query.trim().length < 2) {
    return { data: { projects: [], tasks: [], clients: [] } }
  }

  const normalizedQuery = sanitizeSearchInput(query.toLowerCase())

  // Return empty results if sanitized query is too short
  if (normalizedQuery.length < 2) {
    return { data: { projects: [], tasks: [], clients: [] } }
  }

  const queryHash = hashQuery(normalizedQuery)

  try {
    const results = await cacheGet(
      CacheKeys.search(orgId, queryHash),
      async () => {
        const supabase = await createClient()
        const searchTerm = `%${normalizedQuery}%`

        // Run all searches in parallel
        const [projectsResult, tasksResult, clientsResult] = await Promise.all([
          // Search projects
          supabase
            .from("projects")
            .select("id, name, status, client:clients(name)")
            .eq("organization_id", orgId)
            .ilike("name", searchTerm)
            .limit(SEARCH_RESULTS_PER_CATEGORY),

          // Search tasks (need to join through projects to filter by org)
          supabase
            .from("tasks")
            .select("id, name, status, project:projects!inner(id, name, organization_id)")
            .eq("project.organization_id", orgId)
            .ilike("name", searchTerm)
            .limit(SEARCH_RESULTS_PER_CATEGORY),

          // Search clients
          supabase
            .from("clients")
            .select("id, name, status, primary_contact_name")
            .eq("organization_id", orgId)
            .or(`name.ilike.${searchTerm},primary_contact_name.ilike.${searchTerm}`)
            .limit(SEARCH_RESULTS_PER_CATEGORY),
        ])

        // Transform results
        const projects: SearchResult[] = (projectsResult.data || []).map((p) => ({
          id: p.id,
          type: "project" as const,
          title: p.name,
          subtitle: (p.client as { name: string } | null)?.name || p.status,
          url: `/projects/${p.id}`,
        }))

        const tasks: SearchResult[] = (tasksResult.data || []).map((t) => ({
          id: t.id,
          type: "task" as const,
          title: t.name,
          subtitle: (t.project as { name: string })?.name,
          url: `/projects/${(t.project as { id: string })?.id}?tab=tasks`,
        }))

        const clients: SearchResult[] = (clientsResult.data || []).map((c) => ({
          id: c.id,
          type: "client" as const,
          title: c.name,
          subtitle: c.primary_contact_name || c.status,
          url: `/clients/${c.id}`,
        }))

        return {
          projects,
          tasks,
          clients,
        }
      },
      CacheTTL.SEARCH
    )

    return { data: results }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Search failed" }
  }
}
