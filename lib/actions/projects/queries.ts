"use server"

import { createClient } from "@/lib/supabase/server"
import { getProjectFiles } from "../files"
import {
  createProjectStatusCounts,
  createProjectPriorityCounts,
} from "@/lib/constants/status"
import type { ProjectStatus, ProjectPriority } from "@/lib/supabase/types"
import type { ActionResult } from "../types"
import type { ProjectWithRelations, ProjectFullDetails } from "./types"

// Get projects for a specific client
export async function getProjectsByClient(
  clientId: string
): Promise<ActionResult<ProjectWithRelations[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      client:clients(id, name),
      team:teams(id, name),
      members:project_members(
        id,
        role,
        user_id,
        profile:profiles(id, full_name, email, avatar_url)
      )
    `)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: data as ProjectWithRelations[] }
}

// Get single project with ALL relations including scope, outcomes, features, deliverables, metrics
export async function getProjectWithDetails(id: string): Promise<ActionResult<ProjectFullDetails>> {
  const supabase = await createClient()

  // Fetch base project with basic relations
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      *,
      client:clients(id, name),
      team:teams(id, name),
      members:project_members(
        id,
        role,
        user_id,
        profile:profiles(id, full_name, email, avatar_url)
      )
    `)
    .eq("id", id)
    .single()

  if (projectError) {
    return { error: projectError.message }
  }

  // Fetch detail sub-tables and files in parallel:
  // - RPC consolidates 6 queries (scope, outcomes, features, deliverables, metrics, notes) into 1
  // - Files use a separate storage query
  // Total: 2 queries instead of 7
  const [detailsResult, filesResult] = await Promise.all([
    supabase.rpc("get_project_details", { p_project_id: id }),
    getProjectFiles(id),
  ])

  const details = (detailsResult.data || {}) as {
    scope?: unknown[]
    outcomes?: unknown[]
    features?: unknown[]
    deliverables?: unknown[]
    metrics?: unknown[]
    notes?: unknown[]
  }

  return {
    data: {
      ...project,
      scope: details.scope || [],
      outcomes: details.outcomes || [],
      features: details.features || [],
      deliverables: details.deliverables || [],
      metrics: details.metrics || [],
      notes: details.notes || [],
      files: (filesResult.data || []).map((file) => ({
        ...file,
        profiles: file.uploader || null,
      })),
    } as unknown as ProjectFullDetails,
  }
}

// Get project stats for organization (uses SQL aggregation RPC — single row instead of N rows)
export async function getProjectStats(orgId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<ProjectStatus, number>
    byPriority: Record<ProjectPriority, number>
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_project_stats", {
    p_org_id: orgId,
  })

  if (error) {
    return { error: error.message }
  }

  const stats = data as {
    total: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
  }

  const byStatus = { ...createProjectStatusCounts(), ...stats.byStatus }
  const byPriority = { ...createProjectPriorityCounts(), ...stats.byPriority }

  return {
    data: {
      total: stats.total,
      byStatus: byStatus as Record<ProjectStatus, number>,
      byPriority: byPriority as Record<ProjectPriority, number>,
    },
  }
}
