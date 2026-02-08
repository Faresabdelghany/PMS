"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { invalidate } from "@/lib/cache"
import { requireProjectOwnerOrPIC } from "../auth-helpers"
import { cachedGetUser } from "@/lib/request-cache"
import type { ProjectMember, ProjectMemberRole } from "@/lib/supabase/types"
import type { ActionResult } from "../types"
import { notify } from "../notifications"

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

  // Use cached auth - already cached from requireProjectOwnerOrPIC() above
  const { user, supabase } = await cachedGetUser()

  // Get project info for notification
  const { data: project } = await supabase
    .from("projects")
    .select("name, organization_id")
    .eq("id", projectId)
    .single()

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

  after(async () => {
    revalidatePath(`/projects/${projectId}`)
    revalidateTag(CacheTags.project(projectId))
    revalidateTag(CacheTags.projectMembers(projectId))
    invalidate.projectMembership(projectId, userId).catch(() => {})

    // Notify the new member
    if (user && project) {
      await notify({
        orgId: project.organization_id,
        userIds: [userId],
        actorId: user.id,
        type: "project_milestone",
        title: `added you to "${project.name}"`,
        projectId,
      })
    }
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
    invalidate.projectMembership(projectId, userId).catch(() => {})
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

  // Use cached auth - already cached from requireProjectOwnerOrPIC() above
  const { user, supabase } = await cachedGetUser()

  // Get project info for notification
  const { data: project } = await supabase
    .from("projects")
    .select("name, organization_id")
    .eq("id", projectId)
    .single()

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    revalidatePath(`/projects/${projectId}`)
    revalidateTag(CacheTags.project(projectId))
    revalidateTag(CacheTags.projectMembers(projectId))
    invalidate.projectMembership(projectId, userId).catch(() => {})

    // Notify the removed member
    if (user && project) {
      await notify({
        orgId: project.organization_id,
        userIds: [userId],
        actorId: user.id,
        type: "project_milestone",
        title: `removed you from "${project.name}"`,
        projectId,
      })
    }
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
