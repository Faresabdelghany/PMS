"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import type { Organization, OrganizationInsert, OrganizationUpdate, OrgMemberRole } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Helper to clear the organization membership cache cookie
async function clearOrgMembershipCache() {
  const cookieStore = await cookies()
  cookieStore.delete("has_organization")
}


// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// Create organization
export async function createOrganization(
  formData: FormData
): Promise<ActionResult<Organization>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const name = formData.get("name") as string

  if (!name || name.trim().length < 2) {
    return { error: "Organization name must be at least 2 characters" }
  }

  // Generate a unique slug
  const baseSlug = generateSlug(name)
  let slug = baseSlug
  let counter = 1

  // Check for slug uniqueness
  while (true) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()

    if (!existing) break
    slug = `${baseSlug}-${counter++}`
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: name.trim(),
      slug,
    })
    .select()
    .single()

  if (orgError) {
    return { error: orgError.message }
  }

  // Add current user as admin
  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "admin",
  })

  if (memberError) {
    // Rollback: delete the organization
    await supabase.from("organizations").delete().eq("id", org.id)
    return { error: memberError.message }
  }

  // Clear the membership cache to reflect the new organization
  await clearOrgMembershipCache()
  revalidatePath("/", "layout")
  return { data: org }
}

// Get user's organizations
export async function getUserOrganizations(): Promise<ActionResult<Organization[]>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization:organizations(*)")
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  const organizations = memberships
    .map((m) => m.organization)
    .filter((org): org is Organization => org !== null)

  return { data: organizations }
}

// Get single organization
export async function getOrganization(id: string): Promise<ActionResult<Organization>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Update organization
export async function updateOrganization(
  id: string,
  data: OrganizationUpdate
): Promise<ActionResult<Organization>> {
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from("organizations")
    .update(data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { data: org }
}

// Delete organization
export async function deleteOrganization(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from("organizations").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/")
}

// Get organization members
export async function getOrganizationMembers(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq("organization_id", orgId)

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Update member role
export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgMemberRole
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return {}
}

// Remove member from organization
export async function removeOrganizationMember(orgId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  // Clear the membership cache as user may have lost their only organization
  await clearOrgMembershipCache()
  revalidatePath("/", "layout")
  return {}
}

// Alias for backwards compatibility
export const removeMember = removeOrganizationMember
