"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
import { requireProjectMember, requireProjectOwnerOrPIC } from "../auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import type { Project, ProjectUpdate, ProjectStatus, ProjectMemberRole, TaskPriority } from "@/lib/supabase/types"
import type { ActionResult } from "../types"
import type { GuidedProjectInput, ProjectFilters, ProjectWithRelations } from "./types"
import { createProjectSchema } from "./validation"
import { notify } from "../notifications"

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
    const parallelInserts: PromiseLike<{ error: Error | null }>[] = []

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

    // Create workstreams if provided
    if (data.workstreams && data.workstreams.length > 0) {
      for (let i = 0; i < data.workstreams.length; i++) {
        await supabase.from("workstreams").insert({
          project_id: project.id,
          name: data.workstreams[i],
          position: i,
        })
      }
    }

    // Create starter tasks if provided
    if (data.starter_tasks && data.starter_tasks.length > 0) {
      // Get workstream IDs if we created any
      let workstreamMap: Record<string, string> = {}
      if (data.workstreams && data.workstreams.length > 0) {
        const { data: workstreamsData } = await supabase
          .from("workstreams")
          .select("id, name")
          .eq("project_id", project.id)

        if (workstreamsData) {
          workstreamMap = Object.fromEntries(
            workstreamsData.map((ws) => [ws.name, ws.id])
          )
        }
      }

      for (let i = 0; i < data.starter_tasks.length; i++) {
        const task = data.starter_tasks[i]
        await supabase.from("tasks").insert({
          project_id: project.id,
          name: task.title,
          description: task.description || null,
          priority: task.priority as TaskPriority,
          status: "todo",
          sort_order: i,
          workstream_id: task.workstream ? workstreamMap[task.workstream] || null : null,
        })
      }
    }
  } catch (relatedError) {
    // Cleanup: delete project if any related insert fails
    await supabase.from("projects").delete().eq("id", project.id)
    return {
      error: relatedError instanceof Error ? relatedError.message : "Failed to create project with related data",
    }
  }

  after(async () => {
    revalidatePath("/projects")
    revalidateTag(CacheTags.projects(orgId))
    await invalidate.project(project.id, orgId)
  })

  return { data: project }
}

// Get projects for organization with filters
export async function getProjects(
  orgId: string,
  filters?: ProjectFilters
): Promise<ActionResult<ProjectWithRelations[]>> {
  const supabase = await createClient()

  // Only cache unfiltered queries
  const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

  if (!hasFilters) {
    try {
      const projects = await cacheGet(
        CacheKeys.projects(orgId),
        async () => {
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
            .eq("organization_id", orgId)
            .order("updated_at", { ascending: false })

          if (error) throw error
          return data as ProjectWithRelations[]
        },
        CacheTTL.PROJECTS
      )
      return { data: projects }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to fetch projects" }
    }
  }

  // Filtered query - don't cache
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

  // Get current user for notifications
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get old project state for comparison (needed for status change notifications)
  const { data: oldProject } = await supabase
    .from("projects")
    .select("status, name")
    .eq("id", id)
    .single()

  const { data: project, error } = await supabase
    .from("projects")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath("/projects")
    revalidatePath(`/projects/${id}`)
    revalidateTag(CacheTags.project(id))
    revalidateTag(CacheTags.projectDetails(id))
    if (project.organization_id) {
      revalidateTag(CacheTags.projects(project.organization_id))
      await invalidate.project(id, project.organization_id)
    }

    // Send notification on status change
    if (user && oldProject && data.status && data.status !== oldProject.status) {
      // Get all project members to notify
      const { data: members } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", id)

      if (members && members.length > 0) {
        const memberIds = members.map((m) => m.user_id)
        await notify({
          orgId: project.organization_id,
          userIds: memberIds,
          actorId: user.id,
          type: "project_milestone",
          title: `updated "${project.name}" status to ${data.status}`,
          projectId: id,
        })
      }
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

  after(async () => {
    revalidatePath("/projects")
    revalidateTag(CacheTags.project(id))
    revalidateTag(CacheTags.projectDetails(id))
    if (project?.organization_id) {
      revalidateTag(CacheTags.projects(project.organization_id))
      await invalidate.project(id, project.organization_id)
    }
  })

  return {}
}
