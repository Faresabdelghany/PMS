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

  // Fetch all related data in parallel
  const [scopeResult, outcomesResult, featuresResult, deliverablesResult, metricsResult, notesResult, filesResult] = await Promise.all([
    supabase
      .from("project_scope")
      .select("id, item, is_in_scope, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_outcomes")
      .select("id, item, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_features")
      .select("id, item, priority, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_deliverables")
      .select("id, title, due_date, value, status, payment_status, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_metrics")
      .select("id, name, target, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_notes")
      .select(`
        id, title, content, note_type, status, added_by_id, created_at, updated_at,
        author:profiles!project_notes_added_by_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq("project_id", id)
      .order("updated_at", { ascending: false }),
    getProjectFiles(id),
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
      files: (filesResult.data || []).map((file) => ({
        ...file,
        profiles: file.uploader || null,
      })),
    } as unknown as ProjectFullDetails,
  }
}

// Get project stats for organization
export async function getProjectStats(orgId: string): Promise<
  ActionResult<{
    total: number
    byStatus: Record<ProjectStatus, number>
    byPriority: Record<ProjectPriority, number>
  }>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("projects")
    .select("status, priority")
    .eq("organization_id", orgId)

  if (error) {
    return { error: error.message }
  }

  const byStatus = createProjectStatusCounts()
  const byPriority = createProjectPriorityCounts()

  data.forEach((project) => {
    if (project.status in byStatus) {
      byStatus[project.status as ProjectStatus]++
    }
    if (project.priority in byPriority) {
      byPriority[project.priority as ProjectPriority]++
    }
  })

  return {
    data: {
      total: data.length,
      byStatus,
      byPriority,
    },
  }
}
