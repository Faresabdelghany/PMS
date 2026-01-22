"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "./types"

export type { ActionResult }

// ============================================
// PROJECT SCOPE
// ============================================

export type ProjectScopeItem = {
  id: string
  project_id: string
  item: string
  is_in_scope: boolean
  sort_order: number
  created_at: string
}

export async function getProjectScope(
  projectId: string
): Promise<ActionResult<ProjectScopeItem[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_scope")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function updateProjectScope(
  projectId: string,
  inScope: string[],
  outOfScope: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Delete existing scope items
  await supabase.from("project_scope").delete().eq("project_id", projectId)

  // Insert new scope items
  const scopeItems = [
    ...inScope.map((item, index) => ({
      project_id: projectId,
      item,
      is_in_scope: true,
      sort_order: index,
    })),
    ...outOfScope.map((item, index) => ({
      project_id: projectId,
      item,
      is_in_scope: false,
      sort_order: index,
    })),
  ]

  if (scopeItems.length > 0) {
    const { error } = await supabase.from("project_scope").insert(scopeItems)

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// ============================================
// PROJECT OUTCOMES
// ============================================

export type ProjectOutcome = {
  id: string
  project_id: string
  item: string
  sort_order: number
  created_at: string
}

export async function getProjectOutcomes(
  projectId: string
): Promise<ActionResult<ProjectOutcome[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_outcomes")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function updateProjectOutcomes(
  projectId: string,
  outcomes: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Delete existing outcomes
  await supabase.from("project_outcomes").delete().eq("project_id", projectId)

  // Insert new outcomes
  if (outcomes.length > 0) {
    const outcomeItems = outcomes.map((item, index) => ({
      project_id: projectId,
      item,
      sort_order: index,
    }))

    const { error } = await supabase.from("project_outcomes").insert(outcomeItems)

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// ============================================
// PROJECT FEATURES
// ============================================

export type ProjectFeature = {
  id: string
  project_id: string
  item: string
  priority: number // 0, 1, or 2
  sort_order: number
  created_at: string
}

export async function getProjectFeatures(
  projectId: string
): Promise<ActionResult<ProjectFeature[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_features")
    .select("*")
    .eq("project_id", projectId)
    .order("priority")
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function updateProjectFeatures(
  projectId: string,
  features: { item: string; priority: number }[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Delete existing features
  await supabase.from("project_features").delete().eq("project_id", projectId)

  // Insert new features
  if (features.length > 0) {
    const featureItems = features.map((f, index) => ({
      project_id: projectId,
      item: f.item,
      priority: f.priority,
      sort_order: index,
    }))

    const { error } = await supabase.from("project_features").insert(featureItems)

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// ============================================
// PROJECT DELIVERABLES
// ============================================

export type ProjectDeliverable = {
  id: string
  project_id: string
  title: string
  due_date: string | null
  sort_order: number
  created_at: string
}

export async function getProjectDeliverables(
  projectId: string
): Promise<ActionResult<ProjectDeliverable[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_deliverables")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function updateProjectDeliverables(
  projectId: string,
  deliverables: { title: string; due_date?: string | null }[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Delete existing deliverables
  await supabase.from("project_deliverables").delete().eq("project_id", projectId)

  // Insert new deliverables
  if (deliverables.length > 0) {
    const deliverableItems = deliverables.map((d, index) => ({
      project_id: projectId,
      title: d.title,
      due_date: d.due_date || null,
      sort_order: index,
    }))

    const { error } = await supabase.from("project_deliverables").insert(deliverableItems)

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// ============================================
// PROJECT METRICS
// ============================================

export type ProjectMetric = {
  id: string
  project_id: string
  name: string
  target: string | null
  sort_order: number
  created_at: string
}

export async function getProjectMetrics(
  projectId: string
): Promise<ActionResult<ProjectMetric[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_metrics")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function updateProjectMetrics(
  projectId: string,
  metrics: { name: string; target?: string | null }[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Delete existing metrics
  await supabase.from("project_metrics").delete().eq("project_id", projectId)

  // Insert new metrics
  if (metrics.length > 0) {
    const metricItems = metrics.map((m, index) => ({
      project_id: projectId,
      name: m.name,
      target: m.target || null,
      sort_order: index,
    }))

    const { error } = await supabase.from("project_metrics").insert(metricItems)

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// ============================================
// GET ALL PROJECT DETAILS
// ============================================

export async function getFullProjectDetails(projectId: string): Promise<
  ActionResult<{
    scope: ProjectScopeItem[]
    outcomes: ProjectOutcome[]
    features: ProjectFeature[]
    deliverables: ProjectDeliverable[]
    metrics: ProjectMetric[]
  }>
> {
  const [scope, outcomes, features, deliverables, metrics] = await Promise.all([
    getProjectScope(projectId),
    getProjectOutcomes(projectId),
    getProjectFeatures(projectId),
    getProjectDeliverables(projectId),
    getProjectMetrics(projectId),
  ])

  if (scope.error) return { error: scope.error }
  if (outcomes.error) return { error: outcomes.error }
  if (features.error) return { error: features.error }
  if (deliverables.error) return { error: deliverables.error }
  if (metrics.error) return { error: metrics.error }

  return {
    data: {
      scope: scope.data!,
      outcomes: outcomes.data!,
      features: features.data!,
      deliverables: deliverables.data!,
      metrics: metrics.data!,
    },
  }
}
