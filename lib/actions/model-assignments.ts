"use server"

import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export interface ModelAssignment {
  id: string
  organization_id: string
  use_case: string
  user_model_id: string | null
  created_at: string
  updated_at: string
  // joined
  user_model_display_name?: string
  user_model_provider?: string
  user_model_model_id?: string
}

export async function getModelAssignments(
  orgId: string
): Promise<ActionResult<ModelAssignment[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("model_assignments")
    .select("*, user_models:user_model_id(display_name, provider, model_id)")
    .eq("organization_id", orgId)

  if (error) return { error: error.message }

  const assignments = ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    use_case: row.use_case,
    user_model_id: row.user_model_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_model_display_name: row.user_models?.display_name ?? undefined,
    user_model_provider: row.user_models?.provider ?? undefined,
    user_model_model_id: row.user_models?.model_id ?? undefined,
  }))

  return { data: assignments }
}

export async function upsertModelAssignment(
  orgId: string,
  useCase: string,
  userModelId: string | null
): Promise<ActionResult<ModelAssignment>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("model_assignments")
    .upsert(
      {
        organization_id: orgId,
        use_case: useCase,
        user_model_id: userModelId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,use_case" }
    )
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: data as ModelAssignment }
}
