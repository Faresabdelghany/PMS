"use server"

import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export interface UserModel {
  id: string
  organization_id: string
  display_name: string
  provider: string
  model_id: string
  api_key_encrypted: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export async function getUserModels(orgId: string): Promise<ActionResult<UserModel[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await (supabase as any)
    .from("user_models")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_default", { ascending: false })
    .order("display_name")

  if (error) return { error: error.message }
  return { data: (data ?? []) as UserModel[] }
}

export async function createUserModel(input: {
  organization_id: string
  display_name: string
  provider: string
  model_id: string
  api_key_encrypted?: string
  is_default?: boolean
}): Promise<ActionResult<UserModel>> {
  const { supabase } = await requireAuth()

  // If setting as default, unset others first
  if (input.is_default) {
    await (supabase as any)
      .from("user_models")
      .update({ is_default: false })
      .eq("organization_id", input.organization_id)
  }

  const { data, error } = await (supabase as any)
    .from("user_models")
    .insert({
      organization_id: input.organization_id,
      display_name: input.display_name,
      provider: input.provider,
      model_id: input.model_id,
      api_key_encrypted: input.api_key_encrypted || null,
      is_default: input.is_default ?? false,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: data as UserModel }
}

export async function updateUserModel(
  id: string,
  input: {
    organization_id: string
    display_name?: string
    provider?: string
    model_id?: string
    api_key_encrypted?: string | null
    is_default?: boolean
  }
): Promise<ActionResult<UserModel>> {
  const { supabase } = await requireAuth()

  if (input.is_default) {
    await (supabase as any)
      .from("user_models")
      .update({ is_default: false })
      .eq("organization_id", input.organization_id)
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.display_name !== undefined) updates.display_name = input.display_name
  if (input.provider !== undefined) updates.provider = input.provider
  if (input.model_id !== undefined) updates.model_id = input.model_id
  if (input.api_key_encrypted !== undefined) updates.api_key_encrypted = input.api_key_encrypted
  if (input.is_default !== undefined) updates.is_default = input.is_default

  const { data, error } = await (supabase as any)
    .from("user_models")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: data as UserModel }
}

export async function deleteUserModel(id: string): Promise<ActionResult<void>> {
  const { supabase } = await requireAuth()

  const { error } = await (supabase as any)
    .from("user_models")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}

export async function setDefaultModel(id: string, orgId: string): Promise<ActionResult<void>> {
  const { supabase } = await requireAuth()

  // Unset all defaults
  await (supabase as any)
    .from("user_models")
    .update({ is_default: false })
    .eq("organization_id", orgId)

  // Set this one
  const { error } = await (supabase as any)
    .from("user_models")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}
