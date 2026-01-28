"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { CacheTags } from "@/lib/cache-tags"
import { requireProjectMember, requireProjectOwnerOrPIC, requireOrgMember } from "./auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectStatus,
  ProjectPriority,
  ProjectIntent,
  SuccessType,
  DeadlineType,
  WorkStructure,
  ProjectMember,
  ProjectMemberRole,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"


// Extended type for guided wizard project creation
export type GuidedProjectInput = {
  // Base project fields
  name: string
  description?: string | null
  status?: ProjectStatus
  priority?: ProjectPriority
  start_date?: string | null
  end_date?: string | null
  client_id?: string | null
  type_label?: string | null
  tags?: string[]

  // Guided wizard fields (stored in projects table)
  intent?: ProjectIntent | null
  success_type?: SuccessType | null
  deadline_type?: DeadlineType | null
  deadline_date?: string | null
  work_structure?: WorkStructure | null

  // Related data (stored in separate tables)
  deliverables?: { title: string; due_date?: string | null }[]
  metrics?: { name: string; target?: string | null }[]

  // Project members
  owner_id?: string
  contributor_ids?: string[]
  stakeholder_ids?: string[]
}

export type ProjectFilters = {
  status?: ProjectStatus
  priority?: ProjectPriority
  clientId?: string
  teamId?: string
  search?: string
}

export type ProjectWithRelations = Project & {
  client?: { id: string; name: string } | null
  team?: { id: string; name: string } | null
  members?: (ProjectMember & {
    profile: { id: string; full_name: string | null; email: string; avatar_url: string | null }
  })[]
}

// Validation schema for project creation
const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(200, "Project name must be less than 200 characters"),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["active", "completed", "on-hold", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  type_label: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  intent: z.enum(["build", "learn", "explore", "fix"]).optional().nullable(),
  success_type: z.enum(["deliverable", "milestone", "metric", "ongoing"]).optional().nullable(),
  deadline_type: z.enum(["fixed", "flexible", "none"]).optional().nullable(),
  deadline_date: z.string().optional().nullable(),
  work_structure: z.enum(["solo", "team", "mixed"]).optional().nullable(),
  deliverables: z.array(z.object({
    title: z.string().max(500),
    due_date: z.string().optional().nullable(),
  })).optional(),
  metrics: z.array(z.object({
    name: z.string().max(200),
    target: z.string().max(100).optional().nullable(),
  })).optional(),
  owner_id: z.string().uuid().optional(),
  contributor_ids: z.array(z.string().uuid()).optional(),
  stakeholder_ids: z.array(z.string().uuid()).optional(),
})

// Create project (supports both quick create and guided wizard)
export async function createProject(
  orgId: string,
  data: GuidedProjectInput
): Promise<ActionResult<Project>> {
  // Validate organization ID
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) {
    return { error: "Invalid organization ID" }
  }

  // Validate project data
  const validation = validate(createProjectSchema, data)
  if (!validation.success) {
    return { error: validation.error }
  }

  const validatedData = validation.data
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Extract related data from validated input
  const { deliverables, metrics, owner_id, contributor_ids, stakeholder_ids, ...projectData } = validatedData

  // Filter out empty deliverables and metrics
  const validDeliverables = deliverables?.filter((d) => d.title?.trim()) ?? []
  const validMetrics = metrics?.filter((m) => m.name?.trim()) ?? []

  // Determine owner ID (specified or current user)
  const ownerId = owner_id || user.id

  // Validate that contributor/stakeholder IDs belong to the organization (if provided)
  const allMemberIds = [...(contributor_ids || []), ...(stakeholder_ids || [])].filter(
    (id) => id !== ownerId
  )
  let validMemberIds = new Set<string>()

  if (allMemberIds.length > 0) {
    const { data: orgMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .in("user_id", allMemberIds)

    validMemberIds = new Set(orgMembers?.map((m) => m.user_id) || [])
  }

  // 1. Create project with all fields (base + guided wizard fields)
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      ...projectData,
      name: validatedData.name.trim(),
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // 2. Insert related data with error handling and cleanup
  try {
    // CRITICAL: Add project owner FIRST (required for RLS policies on deliverables/metrics)
    const { error: ownerError } = await supabase.from("project_members").insert({
      project_id: project.id,
      user_id: ownerId,
      role: "owner",
    })

    if (ownerError) {
      throw new Error(`Failed to add project owner: ${ownerError.message}`)
    }

    // Pre-compute contributor and stakeholder lists
    const validContributors = (contributor_ids || []).filter(
      (id) => id !== ownerId && validMemberIds.has(id)
    )
    const contributorSet = new Set(validContributors)
    const validStakeholders = (stakeholder_ids || []).filter(
      (id) => id !== ownerId && !contributorSet.has(id) && validMemberIds.has(id)
    )

    // 3. Insert deliverables, metrics, contributors, and stakeholders in parallel
    const parallelInserts: Promise<{ error: Error | null }>[] = []

    // Deliverables insert
    if (validDeliverables.length > 0) {
      parallelInserts.push(
        supabase
          .from("project_deliverables")
          .insert(
            validDeliverables.map((d, index) => ({
              project_id: project.id,
              title: d.title.trim(),
              due_date: d.due_date || null,
              sort_order: index,
            }))
          )
          .then(({ error }) => ({ error: error ? new Error(`Failed to insert deliverables: ${error.message}`) : null }))
      )
    }

    // Metrics insert
    if (validMetrics.length > 0) {
      parallelInserts.push(
        supabase
          .from("project_metrics")
          .insert(
            validMetrics.map((m, index) => ({
              project_id: project.id,
              name: m.name.trim(),
              target: m.target?.trim() || null,
              sort_order: index,
            }))
          )
          .then(({ error }) => ({ error: error ? new Error(`Failed to insert metrics: ${error.message}`) : null }))
      )
    }

    // Contributors insert
    if (validContributors.length > 0) {
      parallelInserts.push(
        supabase
          .from("project_members")
          .insert(
            validContributors.map((userId) => ({
              project_id: project.id,
              user_id: userId,
              role: "member" as ProjectMemberRole,
            }))
          )
          .then(({ error }) => ({ error: error ? new Error(`Failed to add contributors: ${error.message}`) : null }))
      )
    }

    // Stakeholders insert
    if (validStakeholders.length > 0) {
      parallelInserts.push(
        supabase
          .from("project_members")
          .insert(
            validStakeholders.map((userId) => ({
              project_id: project.id,
              user_id: userId,
              role: "viewer" as ProjectMemberRole,
            }))
          )
          .then(({ error }) => ({ error: error ? new Error(`Failed to add stakeholders: ${error.message}`) : null }))
      )
    }

    // Wait for all parallel inserts and check for errors
    const results = await Promise.all(parallelInserts)
    const firstError = results.find((r) => r.error)
    if (firstError?.error) {
      throw firstError.error
    }
  } catch (relatedError) {
    // Cleanup: delete project if any related insert fails
    await supabase.from("projects").delete().eq("id", project.id)
    return {
      error: relatedError instanceof Error ? relatedError.message : "Failed to create project with related data",
    }
  }

  after(() => {
    revalidatePath("/projects")
    revalidateTag(CacheTags.projects(orgId))
  })

  return { data: project }
}

// Get projects for organization with filters
export async function getProjects(
  orgId: string,
  filters?: ProjectFilters
): Promise<ActionResult<ProjectWithRelations[]>> {
  const supabase = await createClient()

  let query = supabase
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
    .eq("organization_id", orgId)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.priority) {
    query = query.eq("priority", filters.priority)
  }

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId)
  }

  if (filters?.teamId) {
    query = query.eq("team_id", filters.teamId)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query.order("updated_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: data as ProjectWithRelations[] }
}

// Get single project with all relations
export async function getProject(id: string): Promise<ActionResult<ProjectWithRelations>> {
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
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as ProjectWithRelations }
}

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

// Extended type for full project details with all related data
export type ProjectFullDetails = ProjectWithRelations & {
  scope: { id: string; item: string; is_in_scope: boolean; sort_order: number }[]
  outcomes: { id: string; item: string; sort_order: number }[]
  features: { id: string; item: string; priority: number; sort_order: number }[]
  deliverables: { id: string; title: string; due_date: string | null; sort_order: number }[]
  metrics: { id: string; name: string; target: string | null; sort_order: number }[]
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
  const [scopeResult, outcomesResult, featuresResult, deliverablesResult, metricsResult] = await Promise.all([
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
      .select("id, title, due_date, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_metrics")
      .select("id, name, target, sort_order")
      .eq("project_id", id)
      .order("sort_order"),
  ])

  return {
    data: {
      ...project,
      scope: scopeResult.data || [],
      outcomes: outcomesResult.data || [],
      features: featuresResult.data || [],
      deliverables: deliverablesResult.data || [],
      metrics: metricsResult.data || [],
    } as ProjectFullDetails,
  }
}

// Update project
export async function updateProject(
  id: string,
  data: ProjectUpdate
): Promise<ActionResult<Project>> {
  // Require project membership to update
  try {
    await requireProjectMember(id)
  } catch {
    return { error: "You must be a project member to update this project" }
  }

  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from("projects")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(() => {
    revalidatePath("/projects")
    revalidatePath(`/projects/${id}`)
    revalidateTag(CacheTags.project(id))
    revalidateTag(CacheTags.projectDetails(id))
    if (project.organization_id) {
      revalidateTag(CacheTags.projects(project.organization_id))
    }
  })

  return { data: project }
}

// Update project status
export async function updateProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<ActionResult<Project>> {
  return updateProject(id, { status })
}

// Update project progress
export async function updateProjectProgress(
  id: string,
  progress: number
): Promise<ActionResult<Project>> {
  if (progress < 0 || progress > 100) {
    return { error: "Progress must be between 0 and 100" }
  }
  return updateProject(id, { progress })
}

// Delete project
export async function deleteProject(id: string): Promise<ActionResult> {
  // Require owner/PIC access to delete project
  try {
    await requireProjectOwnerOrPIC(id)
  } catch {
    return { error: "Owner or PIC access required to delete this project" }
  }

  const supabase = await createClient()

  // Get org_id for cache invalidation before deleting
  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("projects").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  after(() => {
    revalidatePath("/projects")
    revalidateTag(CacheTags.project(id))
    revalidateTag(CacheTags.projectDetails(id))
    if (project?.organization_id) {
      revalidateTag(CacheTags.projects(project.organization_id))
    }
  })

  return {}
}

// Add project member
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole = "member"
): Promise<ActionResult<ProjectMember>> {
  // Require owner/PIC access to add members
  try {
    await requireProjectOwnerOrPIC(projectId)
  } catch {
    return { error: "Owner or PIC access required to add project members" }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: userId,
      role,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "User is already a member of this project" }
    }
    return { error: error.message }
  }

  after(() => {
    revalidatePath(`/projects/${projectId}`)
    revalidateTag(CacheTags.project(projectId))
    revalidateTag(CacheTags.projectMembers(projectId))
  })

  return { data }
}

// Update project member role
export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole
): Promise<ActionResult> {
  // Require owner/PIC access to update member roles
  try {
    await requireProjectOwnerOrPIC(projectId)
  } catch {
    return { error: "Owner or PIC access required to update member roles" }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  after(() => {
    revalidatePath(`/projects/${projectId}`)
    revalidateTag(CacheTags.project(projectId))
    revalidateTag(CacheTags.projectMembers(projectId))
  })

  return {}
}

// Remove project member
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  // Require owner/PIC access to remove members
  try {
    await requireProjectOwnerOrPIC(projectId)
  } catch {
    return { error: "Owner or PIC access required to remove project members" }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  after(() => {
    revalidatePath(`/projects/${projectId}`)
    revalidateTag(CacheTags.project(projectId))
    revalidateTag(CacheTags.projectMembers(projectId))
  })

  return {}
}

// Get project members
export async function getProjectMembers(projectId: string): Promise<
  ActionResult<
    (ProjectMember & {
      profile: { id: string; full_name: string | null; email: string; avatar_url: string | null }
    })[]
  >
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("project_members")
    .select("*, profile:profiles(id, full_name, email, avatar_url)")
    .eq("project_id", projectId)

  if (error) {
    return { error: error.message }
  }

  return { data: data as (ProjectMember & { profile: { id: string; full_name: string | null; email: string; avatar_url: string | null } })[] }
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

  const byStatus: Record<ProjectStatus, number> = {
    backlog: 0,
    planned: 0,
    active: 0,
    cancelled: 0,
    completed: 0,
  }

  const byPriority: Record<ProjectPriority, number> = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  data.forEach((project) => {
    byStatus[project.status]++
    byPriority[project.priority]++
  })

  return {
    data: {
      total: data.length,
      byStatus,
      byPriority,
    },
  }
}
