"use server"

import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"

type TypedSupabaseClient = SupabaseClient<Database>

export type AuthContext = {
  user: { id: string; email: string }
  supabase: TypedSupabaseClient
}

export type OrgMemberContext = AuthContext & {
  member: { role: "admin" | "member" }
}

export type ProjectMemberContext = AuthContext & {
  member: { role: string }
}

/**
 * Requires the user to be authenticated.
 * Returns the user and supabase client or throws an error.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Not authenticated")
  }

  return {
    user: { id: user.id, email: user.email || "" },
    supabase,
  }
}

/**
 * Requires the user to be a member of the specified organization.
 * Optionally requires admin role.
 */
export async function requireOrgMember(
  orgId: string,
  requireAdmin = false
): Promise<OrgMemberContext> {
  const { user, supabase } = await requireAuth()

  const member = await cacheGet(
    CacheKeys.membership(orgId, user.id),
    async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .single()

      if (error || !data) return null
      return { role: data.role as "admin" | "member" }
    },
    CacheTTL.MEMBERSHIP
  )

  if (!member) {
    throw new Error("Not a member of this organization")
  }

  if (requireAdmin && member.role !== "admin") {
    throw new Error("Admin access required")
  }

  return {
    user,
    supabase,
    member,
  }
}

/**
 * Requires the user to be a member of the specified project.
 * Returns the member's role within the project.
 */
export async function requireProjectMember(
  projectId: string
): Promise<ProjectMemberContext> {
  const { user, supabase } = await requireAuth()

  const { data: member, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single()

  if (error || !member) {
    throw new Error("Not a member of this project")
  }

  return {
    user,
    supabase,
    member: { role: member.role },
  }
}

/**
 * Checks if the user is an owner or PIC of the project.
 * Use this for operations that require elevated project permissions.
 */
export async function requireProjectOwnerOrPIC(
  projectId: string
): Promise<ProjectMemberContext> {
  const context = await requireProjectMember(projectId)

  if (context.member.role !== "owner" && context.member.role !== "pic") {
    throw new Error("Project owner or PIC access required")
  }

  return context
}
