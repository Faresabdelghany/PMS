"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { invalidate } from "@/lib/cache"
import type { Team, TeamInsert, TeamUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"


// Create team
export async function createTeam(
  orgId: string,
  formData: FormData
): Promise<ActionResult<Team>> {
  const supabase = await createClient()

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
  invalidate.team(orgId)
  return { data }
}

// Get teams for organization
export async function getTeams(orgId: string): Promise<ActionResult<Team[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("organization_id", orgId)
    .order("name")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Get single team
export async function getTeam(id: string): Promise<ActionResult<Team>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Update team
export async function updateTeam(
  id: string,
  formData: FormData
): Promise<ActionResult<Team>> {
  const supabase = await createClient()

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
  if (data) invalidate.team(data.organization_id)
  return { data }
}

// Delete team
export async function deleteTeam(id: string, orgId?: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from("teams").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  if (orgId) invalidate.team(orgId)
  return {}
}
