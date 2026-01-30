"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { cookies } from "next/headers"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { requireAuth, requireOrgMember } from "./auth-helpers"
import type { Organization, OrganizationInsert, OrganizationUpdate, OrgMemberRole } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Helper to clear the organization membership cache cookie
async function clearOrgMembershipCache() {
  const cookieStore = await cookies()
  cookieStore.delete("has_organization")
}


// Generate slug from name with optional uniqueness suffix
function generateSlug(name: string, addSuffix = false): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  if (addSuffix) {
    // Add a short random suffix for uniqueness (6 chars from UUID)
    const suffix = crypto.randomUUID().split("-")[0]
    return `${base}-${suffix}`
  }
  return base
}

// Create organization
export async function createOrganization(
  formData: FormData
): Promise<ActionResult<Organization>> {
  try {
    const { user, supabase } = await requireAuth()

    const name = formData.get("name") as string

    if (!name || name.trim().length < 2) {
      return { error: "Organization name must be at least 2 characters" }
    }

    // Generate a unique slug - try base slug first, add suffix if it exists
    const baseSlug = generateSlug(name)
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", baseSlug)
      .single()

    // If base slug exists, generate a unique one with random suffix
    const slug = existing ? generateSlug(name, true) : baseSlug

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

    after(() => {
      revalidatePath("/", "layout")
      revalidateTag(CacheTags.organizations(user.id))
    })

    return { data: org }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get user's organizations
export async function getUserOrganizations(): Promise<ActionResult<Organization[]>> {
  try {
    const { user, supabase } = await requireAuth()

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
  } catch {
    return { error: "Not authenticated" }
  }
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
  // Require admin access to update organization
  try {
    await requireOrgMember(id, true)
  } catch {
    return { error: "Admin access required to update organization" }
  }

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

  after(() => {
    revalidatePath("/", "layout")
    revalidateTag(CacheTags.organization(id))
  })

  return { data: org }
}

// Delete organization
export async function deleteOrganization(id: string): Promise<ActionResult> {
  // Require admin access to delete organization
  try {
    await requireOrgMember(id, true)
  } catch {
    return { error: "Admin access required to delete organization" }
  }

  const supabase = await createClient()

  const { error } = await supabase.from("organizations").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  after(() => {
    revalidatePath("/", "layout")
    revalidateTag(CacheTags.organization(id))
    revalidateTag(CacheTags.organizationMembers(id))
  })

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
  // Require admin access to update member roles
  try {
    await requireOrgMember(orgId, true)
  } catch {
    return { error: "Admin access required to update member roles" }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId)

  if (error) {
    return { error: error.message }
  }

  after(() => {
    revalidatePath("/", "layout")
    revalidateTag(CacheTags.organizationMembers(orgId))
  })

  return {}
}

// Remove member from organization
export async function removeOrganizationMember(orgId: string, userId: string): Promise<ActionResult> {
  // Require admin access to remove members
  try {
    await requireOrgMember(orgId, true)
  } catch {
    return { error: "Admin access required to remove members" }
  }

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

  after(() => {
    revalidatePath("/", "layout")
    revalidateTag(CacheTags.organizationMembers(orgId))
    revalidateTag(CacheTags.organizations(userId))
  })

  return {}
}

// Alias for backwards compatibility
export const removeMember = removeOrganizationMember
