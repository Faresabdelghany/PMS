"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import type { Invitation, OrgMemberRole } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Helper to clear the organization membership cache cookie
async function clearOrgMembershipCache() {
  const cookieStore = await cookies()
  cookieStore.delete("has_organization")
}


// Invite member to organization
export async function inviteMember(
  orgId: string,
  email: string,
  role: OrgMemberRole = "member"
): Promise<ActionResult<Invitation>> {
  const supabase = await createClient()

  // Parallel fetch: auth, members, and pending invite (eliminates 2 waterfalls)
  const [authResult, membersResult, inviteResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("organization_members")
      .select("id, profile:profiles(email)")
      .eq("organization_id", orgId),
    supabase
      .from("invitations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single(),
  ])

  const { data: { user }, error: authError } = authResult

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Check if email is already a member using Set for O(1) lookup
  const memberEmailSet = new Set(
    membersResult.data
      ?.map((m) => (m.profile as { email: string } | null)?.email?.toLowerCase())
      .filter((email): email is string => Boolean(email)) || []
  )

  if (memberEmailSet.has(email.toLowerCase())) {
    return { error: "This email is already a member of the organization" }
  }

  // Check for existing pending invitation (note: .single() returns error if not found, which is OK)
  if (inviteResult.data) {
    return { error: "An invitation is already pending for this email" }
  }

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: orgId,
      email: email.toLowerCase(),
      role,
      invited_by_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { data }
}

// Get pending invitations for organization
export async function getPendingInvitations(
  orgId: string
): Promise<ActionResult<Invitation[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("invitations")
    .select("*, invited_by:profiles(full_name, email)")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: data as Invitation[] }
}

// Get invitation by token
export async function getInvitationByToken(
  token: string
): Promise<ActionResult<Invitation & { organization: { name: string; slug: string } }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("invitations")
    .select("*, organization:organizations(name, slug)")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (error) {
    return { error: "Invalid or expired invitation" }
  }

  // Check if invitation has expired
  if (new Date(data.expires_at) < new Date()) {
    return { error: "This invitation has expired" }
  }

  return { data: data as Invitation & { organization: { name: string; slug: string } } }
}

// Accept invitation
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "You must be logged in to accept an invitation" }
  }

  // Get invitation
  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (inviteError || !invitation) {
    return { error: "Invalid or expired invitation" }
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return { error: "This invitation has expired" }
  }

  // Check if user email matches invitation email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single()

  if (profile?.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: "This invitation was sent to a different email address" }
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", user.id)
    .single()

  if (existingMember) {
    // Update invitation status and return success
    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id)

    return { error: "You are already a member of this organization" }
  }

  // Add user to organization
  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: invitation.organization_id,
    user_id: user.id,
    role: invitation.role,
  })

  if (memberError) {
    return { error: memberError.message }
  }

  // Update invitation status
  await supabase
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)

  // Clear the membership cache to reflect the new organization
  await clearOrgMembershipCache()
  revalidatePath("/", "layout")
  return {}
}

// Cancel invitation
export async function cancelInvitation(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("invitations")
    .update({ status: "cancelled" })
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return {}
}

// Resend invitation (create new token)
export async function resendInvitation(id: string): Promise<ActionResult<Invitation>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Get existing invitation
  const { data: existing, error: existingError } = await supabase
    .from("invitations")
    .select("*")
    .eq("id", id)
    .single()

  if (existingError || !existing) {
    return { error: "Invitation not found" }
  }

  // Cancel old invitation
  await supabase.from("invitations").update({ status: "cancelled" }).eq("id", id)

  // Create new invitation
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: existing.organization_id,
      email: existing.email,
      role: existing.role,
      invited_by_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { data }
}
