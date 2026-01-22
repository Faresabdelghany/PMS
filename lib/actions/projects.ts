"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectStatus,
  ProjectPriority,
  ProjectMember,
  ProjectMemberRole,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"

export type { ActionResult }

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

// Create project
export async function createProject(
  orgId: string,
  data: Omit<ProjectInsert, "organization_id">
): Promise<ActionResult<Project>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Create project
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      ...data,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Add creator as project owner
  await supabase.from("project_members").insert({
    project_id: project.id,
    user_id: user.id,
    role: "owner",
  })

  revalidatePath("/projects")
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

// Update project
export async function updateProject(
  id: string,
  data: ProjectUpdate
): Promise<ActionResult<Project>> {
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

  revalidatePath("/projects")
  revalidatePath(`/projects/${id}`)
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
  const supabase = await createClient()

  const { error } = await supabase.from("projects").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/projects")
  return {}
}

// Add project member
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole = "member"
): Promise<ActionResult<ProjectMember>> {
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

  revalidatePath(`/projects/${projectId}`)
  return { data }
}

// Update project member role
export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

// Remove project member
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
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
