"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { cacheGet, CacheKeys, CacheTTL, invalidateCache } from "@/lib/cache"
import { requireProjectMember, requireProjectOwnerOrPIC } from "../auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import { cachedGetUser } from "@/lib/request-cache"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"
import { logger } from "@/lib/logger"
import type { Project, ProjectUpdate, ProjectStatus, ProjectMemberRole, TaskPriority } from "@/lib/supabase/types"
import type { ActionResult, PaginatedResult } from "../types"
import type { GuidedProjectInput, ProjectFilters, ProjectWithRelations } from "./types"
import { createProjectSchema } from "./validation"
import { notify } from "../notifications"
import { sanitizeSearchInput } from "@/lib/search-utils"
import { encodeCursor, decodeCursor } from "../cursor"

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

  // Use cached auth - deduplicates with other calls in the same request
  const { user, error: authError, supabase } = await cachedGetUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Extract related data from validated input
  // Note: workstreams and starter_tasks are NOT columns in the projects table,
  // they are transient fields used to create related records after project creation
  const { deliverables, metrics, owner_id, contributor_ids, stakeholder_ids, workstreams, starter_tasks, ...projectData } = validatedData

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
    const { data: orgMembers, error: membersError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .in("user_id", allMemberIds)

    if (membersError) {
      logger.error("Failed to validate organization members", { module: "projects", error: membersError.message })
    }

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

    // Create workstreams if provided (batched insert for better performance)
    // Rule: async-parallel - batch multiple inserts into single query
    let workstreamMap: Record<string, string> = {}
    if (workstreams && workstreams.length > 0) {
      const { data: createdWorkstreams, error: wsError } = await supabase
        .from("workstreams")
        .insert(
          workstreams.map((name, i) => ({
            project_id: project.id,
            name,
            sort_order: i,
          }))
        )
        .select("id, name")

      if (wsError) {
        throw new Error(`Failed to create workstreams: ${wsError.message}`)
      }

      // Build workstream name->id map for task assignment
      if (createdWorkstreams) {
        workstreamMap = Object.fromEntries(
          createdWorkstreams.map((ws) => [ws.name, ws.id])
        )
      }
    }

    // Create starter tasks if provided (batched insert for better performance)
    if (starter_tasks && starter_tasks.length > 0) {
      const { error: tasksError } = await supabase.from("tasks").insert(
        starter_tasks.map((task, i) => ({
          project_id: project.id,
          name: task.title,
          description: task.description || null,
          priority: task.priority as TaskPriority,
          status: "todo" as const,
          sort_order: i,
          workstream_id: task.workstream ? workstreamMap[task.workstream] || null : null,
        }))
      )

      if (tasksError) {
        throw new Error(`Failed to create starter tasks: ${tasksError.message}`)
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
    await invalidateCache.project({ projectId: project.id, orgId })
  })

  return { data: project }
}

// Get projects for organization with filters and cursor-based pagination
export async function getProjects(
  orgId: string,
  filters?: ProjectFilters,
  cursor?: string,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<ProjectWithRelations>> {
  const supabase = await createClient()

  // Only cache unfiltered, first-page queries
  const hasFilters = filters && Object.values(filters).some((v) => v !== undefined)

  if (!hasFilters && !cursor) {
    try {
      const cached = await cacheGet(
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
            .limit(limit + 1)

          if (error) throw error
          const raw = data as ProjectWithRelations[]
          const hasMore = raw.length > limit
          const items = hasMore ? raw.slice(0, limit) : raw
          const nextCursor = hasMore
            ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
            : null
          return { data: items, nextCursor, hasMore }
        },
        CacheTTL.PROJECTS
      )

      return cached
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to fetch projects" }
    }
  }

  // Filtered or cursor query - don't cache
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
    const sanitized = sanitizeSearchInput(filters.search)
    if (sanitized.length >= 2) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  // Compound cursor: (updated_at, id) DESC
  if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      query = query.or(
        `updated_at.lt.${value},and(updated_at.eq.${value},id.lt.${id})`
      )
    } catch {
      return { error: "Invalid cursor" }
    }
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)

  if (error) {
    return { error: error.message }
  }

  const hasMore = (data?.length || 0) > limit
  const items = hasMore ? data!.slice(0, limit) : (data || [])
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].updated_at, items[items.length - 1].id)
    : null

  return {
    data: items as ProjectWithRelations[],
    nextCursor,
    hasMore,
  }
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

  // Use cached auth - already cached from requireProjectMember() above
  const { user, supabase } = await cachedGetUser()

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
    if (project.organization_id) {
      await invalidateCache.project({ projectId: id, orgId: project.organization_id })
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
    if (project?.organization_id) {
      await invalidateCache.project({ projectId: id, orgId: project.organization_id })
    }
  })

  return {}
}
