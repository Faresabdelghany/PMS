"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type FieldType = "text" | "number" | "date" | "select" | "checkbox" | "url"

export type CustomFieldDef = {
  id: string
  org_id: string
  board_id: string | null
  name: string
  field_type: FieldType
  options: string[] | null
  required: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CustomFieldValue = {
  id: string
  field_id: string
  task_id: string | null
  board_id: string | null
  value: string | null
  created_at: string
  updated_at: string
}

export type CustomFieldDefInsert = Omit<CustomFieldDef, "id" | "created_at" | "updated_at">
export type CustomFieldDefUpdate = Partial<Omit<CustomFieldDef, "id" | "org_id" | "created_at" | "updated_at">>

// ── Custom Field Definitions ────────────────────────────────────────

export async function getCustomFieldDefs(
  orgId: string,
  boardId?: string
): Promise<ActionResult<CustomFieldDef[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)
    let query = supabase
      .from("custom_field_definitions" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order")
    if (boardId) {
      // board-specific + global
      query = (query as any).or(`board_id.eq.${boardId},board_id.is.null`)
    }
    const { data, error } = await query
    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as CustomFieldDef[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function createCustomFieldDef(
  orgId: string,
  input: {
    name: string
    field_type: FieldType
    board_id?: string
    options?: string[]
    required?: boolean
    sort_order?: number
  }
): Promise<ActionResult<CustomFieldDef>> {
  try {
    const { supabase } = await requireOrgMember(orgId)
    const name = input.name?.trim()
    if (!name) return { error: "Name is required" }
    const { data, error } = await supabase
      .from("custom_field_definitions" as any)
      .insert({
        org_id: orgId,
        board_id: input.board_id ?? null,
        name,
        field_type: input.field_type,
        options: input.options ?? null,
        required: input.required ?? false,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single()
    if (error) return { error: error.message }
    after(() => revalidatePath("/custom-fields"))
    return { data: data as unknown as CustomFieldDef }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateCustomFieldDef(
  id: string,
  input: CustomFieldDefUpdate
): Promise<ActionResult<CustomFieldDef>> {
  try {
    const { supabase } = await requireAuth()
    const { data: existing, error: fetchErr } = await supabase
      .from("custom_field_definitions" as any)
      .select("org_id")
      .eq("id", id)
      .single()
    if (fetchErr || !existing) return { error: "Custom field not found" }
    await requireOrgMember((existing as any).org_id)
    const { data, error } = await supabase
      .from("custom_field_definitions" as any)
      .update(input)
      .eq("id", id)
      .select()
      .single()
    if (error) return { error: error.message }
    after(() => revalidatePath("/custom-fields"))
    return { data: data as unknown as CustomFieldDef }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function deleteCustomFieldDef(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()
    const { data: existing, error: fetchErr } = await supabase
      .from("custom_field_definitions" as any)
      .select("org_id")
      .eq("id", id)
      .single()
    if (fetchErr || !existing) return { error: "Custom field not found" }
    await requireOrgMember((existing as any).org_id)
    const { error } = await supabase
      .from("custom_field_definitions" as any)
      .delete()
      .eq("id", id)
    if (error) return { error: error.message }
    after(() => revalidatePath("/custom-fields"))
    return {}
  } catch {
    return { error: "Not authorized" }
  }
}

// ── Custom Field Values ─────────────────────────────────────────────

export async function getCustomFieldValues(taskId: string): Promise<ActionResult<CustomFieldValue[]>> {
  try {
    const { supabase } = await requireAuth()
    const { data, error } = await supabase
      .from("custom_field_values" as any)
      .select("*")
      .eq("task_id", taskId)
    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as CustomFieldValue[] }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function setCustomFieldValue(
  fieldId: string,
  taskId: string,
  value: string
): Promise<ActionResult<CustomFieldValue>> {
  try {
    const { supabase } = await requireAuth()
    // Upsert by field_id + task_id
    const { data, error } = await supabase
      .from("custom_field_values" as any)
      .upsert({
        field_id: fieldId,
        task_id: taskId,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: "field_id,task_id" })
      .select()
      .single()
    if (error) return { error: error.message }
    return { data: data as unknown as CustomFieldValue }
  } catch {
    return { error: "Not authenticated" }
  }
}
