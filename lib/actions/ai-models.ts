"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { requireOrgMember } from "./auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import type { AIModel, AIModelInsert, AIModelUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

const createAIModelSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required").max(100),
  model_id: z.string().trim().min(1, "Model ID is required").max(200),
  display_name: z.string().trim().min(1, "Display name is required").max(200),
  api_key_encrypted: z.string().max(2000).optional().nullable(),
  base_url: z
    .string()
    .url("Invalid URL")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  is_active: z.boolean().default(true),
  cost_input: z.number().min(0).optional().nullable(),
  cost_output: z.number().min(0).optional().nullable(),
  context_window: z.number().int().min(0).optional().nullable(),
  max_tokens: z.number().int().min(0).optional().nullable(),
  supports_vision: z.boolean().default(false),
  supports_reasoning: z.boolean().default(false),
})

const updateAIModelSchema = createAIModelSchema.partial()

export async function getAIModels(orgId: string): Promise<ActionResult<AIModel[]>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ai_models")
    .select("*")
    .eq("organization_id", orgId)
    .order("provider")
    .order("display_name")

  if (error) return { error: error.message }
  return { data: (data ?? []) as AIModel[] }
}

export async function createAIModel(
  orgId: string,
  data: Omit<AIModelInsert, "organization_id">
): Promise<ActionResult<AIModel>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const validation = validate(createAIModelSchema, data)
  if (!validation.success) return { error: validation.error }

  try {
    await requireOrgMember(orgId, true)
  } catch {
    return { error: "Admin access required to manage AI models" }
  }

  const supabase = await createClient()
  const { data: model, error } = await supabase
    .from("ai_models")
    .insert({ ...validation.data, organization_id: orgId })
    .select()
    .single()

  if (error) return { error: error.message }

  after(() => {
    revalidatePath("/agents")
  })

  return { data: model as AIModel }
}

export async function updateAIModel(
  id: string,
  data: AIModelUpdate
): Promise<ActionResult<AIModel>> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("ai_models")
    .select("organization_id")
    .eq("id", id)
    .single()

  if (!existing) return { error: "AI model not found" }

  try {
    await requireOrgMember(existing.organization_id, true)
  } catch {
    return { error: "Admin access required to manage AI models" }
  }

  const validation = validate(updateAIModelSchema, data)
  if (!validation.success) return { error: validation.error }

  const { data: model, error } = await supabase
    .from("ai_models")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  after(() => {
    revalidatePath("/agents")
  })

  return { data: model as AIModel }
}

export async function deleteAIModel(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: model } = await supabase
    .from("ai_models")
    .select("organization_id")
    .eq("id", id)
    .single()

  if (!model) return { error: "AI model not found" }

  try {
    await requireOrgMember(model.organization_id, true)
  } catch {
    return { error: "Admin access required to manage AI models" }
  }

  const { error } = await supabase.from("ai_models").delete().eq("id", id)
  if (error) return { error: error.message }

  after(() => {
    revalidatePath("/agents")
  })

  return {}
}
