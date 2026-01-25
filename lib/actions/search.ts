"use server"

import { createClient } from "@/lib/supabase/server"
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
 */
export async function globalSearch(
  orgId: string,
  query: string
): Promise<ActionResult<SearchResults>> {
  if (!query || query.trim().length < 2) {
    return { data: { projects: [], tasks: [], clients: [] } }
  }

  const supabase = await createClient()
  const searchTerm = `%${query.trim()}%`

  // Run all searches in parallel
  const [projectsResult, tasksResult, clientsResult] = await Promise.all([
    // Search projects
    supabase
      .from("projects")
      .select("id, name, status, client:clients(name)")
      .eq("organization_id", orgId)
      .ilike("name", searchTerm)
      .limit(5),

    // Search tasks (need to join through projects to filter by org)
    supabase
      .from("tasks")
      .select("id, name, status, project:projects!inner(id, name, organization_id)")
      .eq("project.organization_id", orgId)
      .ilike("name", searchTerm)
      .limit(5),

    // Search clients
    supabase
      .from("clients")
      .select("id, name, status, primary_contact_name")
      .eq("organization_id", orgId)
      .or(`name.ilike.${searchTerm},primary_contact_name.ilike.${searchTerm}`)
      .limit(5),
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
    data: {
      projects,
      tasks,
      clients,
    },
  }
}
