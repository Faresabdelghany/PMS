"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { requireProjectOwnerOrPIC } from "../auth-helpers"
import type { ProjectMember, ProjectMemberRole } from "@/lib/supabase/types"
import type { ActionResult } from "../types"

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
