"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { cookies } from "next/headers"
import type { Invitation, OrgMemberRole } from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth, requireOrgMember } from "./auth-helpers"
import { notify } from "./notifications"

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
  try {
    const { user, supabase } = await requireAuth()

    // Parallel fetch: members and pending invite (eliminates waterfall)
    const [membersResult, inviteResult] = await Promise.all([
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
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get pending invitations for organization
export async function getPendingInvitations(
  orgId: string
): Promise<ActionResult<Invitation[]>> {
  try {
    // Require user to be a member of the organization
    const { supabase } = await requireOrgMember(orgId)

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
  } catch {
    return { error: "Not authorized to view invitations" }
  }
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
  try {
    const { user, supabase } = await requireAuth()

    // Get invitation with organization name
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*, organization:organizations(name)")
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

    // Fetch profile and check membership in parallel (independent queries)
    const [{ data: profile }, { data: existingMember }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", invitation.organization_id)
        .eq("user_id", user.id)
        .single(),
    ])

    if (profile?.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return { error: "This invitation was sent to a different email address" }
    }

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

    // Notify the person who sent the invitation
    const orgName = (invitation.organization as { name: string } | null)?.name ?? "the organization"
    const userName = profile?.full_name ?? profile?.email ?? "Someone"

    after(async () => {
      await notify({
        orgId: invitation.organization_id,
        userIds: [invitation.invited_by_id],
        actorId: user.id,
        type: "system",
        title: `${userName} joined ${orgName}`,
        message: "They accepted your invitation",
      })
    })

    return {}
  } catch {
    return { error: "You must be logged in to accept an invitation" }
  }
}

// Cancel invitation
export async function cancelInvitation(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    // First get the invitation to know which org it belongs to
    const { data: invitation, error: fetchError } = await supabase
      .from("invitations")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (fetchError || !invitation) {
      return { error: "Invitation not found" }
    }

    // Verify user is an admin of the organization
    await requireOrgMember(invitation.organization_id, true)

    const { error } = await supabase
      .from("invitations")
      .update({ status: "cancelled" })
      .eq("id", id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/", "layout")
    return {}
  } catch {
    return { error: "Not authorized to cancel invitations" }
  }
}

// Resend invitation (create new token)
export async function resendInvitation(id: string): Promise<ActionResult<Invitation>> {
  try {
    const { user, supabase } = await requireAuth()

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
  } catch {
    return { error: "Not authenticated" }
  }
}
