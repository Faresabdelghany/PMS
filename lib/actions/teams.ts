"use server"

import { revalidatePath } from "next/cache"
import { invalidateCache } from "@/lib/cache"
import type { Team, TeamUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"
import { requireAuth, requireOrgMember } from "./auth-helpers"


// Create team
export async function createTeam(
  orgId: string,
  formData: FormData
): Promise<ActionResult<Team>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const name = formData.get("name") as string
    const description = formData.get("description") as string | null

    if (!name || name.trim().length < 2) {
      return { error: "Team name must be at least 2 characters" }
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({
        organization_id: orgId,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/", "layout")
    await invalidateCache.teams({ orgId })
    return { data }
  } catch {
    return { error: "Not authorized" }
  }
}

// Get teams for organization
export async function getTeams(orgId: string): Promise<ActionResult<Team[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("teams")
      .select("id, organization_id, name, description, created_at, updated_at")
      .eq("organization_id", orgId)
      .order("name")

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch {
    return { error: "Not authorized" }
  }
}

// Get single team
export async function getTeam(id: string): Promise<ActionResult<Team>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return { error: error.message }
    }

    return { data }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Update team
export async function updateTeam(
  id: string,
  formData: FormData
): Promise<ActionResult<Team>> {
  try {
    const { supabase } = await requireAuth()

    const name = formData.get("name") as string
    const description = formData.get("description") as string | null

    const updates: TeamUpdate = {}

    if (name) {
      if (name.trim().length < 2) {
        return { error: "Team name must be at least 2 characters" }
      }
      updates.name = name.trim()
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null
    }

    const { data, error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/", "layout")
    if (data) await invalidateCache.teams({ orgId: data.organization_id })
    return { data }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Delete team
export async function deleteTeam(id: string, orgId?: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { error } = await supabase.from("teams").delete().eq("id", id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/", "layout")
    if (orgId) await invalidateCache.teams({ orgId })
    return {}
  } catch {
    return { error: "Not authenticated" }
  }
}
