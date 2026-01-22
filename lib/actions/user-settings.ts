"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "./types"
import type { AIProvider } from "@/lib/constants/ai"

// Note: user_settings table exists in DB but not in generated types
// Using explicit any for the table queries
/* eslint-disable @typescript-eslint/no-explicit-any */

// User settings row type
export type UserSettings = {
  id: string
  user_id: string
  ai_provider: AIProvider
  ai_api_key_encrypted: string | null
  ai_model_preference: string | null
  created_at: string
  updated_at: string
}

// Settings update data (without encrypted key - that's handled separately)
export type UserSettingsUpdate = {
  ai_provider?: AIProvider
  ai_model_preference?: string | null
}

// Get user AI settings
export async function getAISettings(): Promise<ActionResult<UserSettings | null>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { data, error } = await (supabase as any)
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error) {
    // If no settings found, that's okay - return null
    if (error.code === "PGRST116") {
      return { data: null }
    }
    return { error: error.message }
  }

  return { data: data as UserSettings }
}

// Save AI settings (provider and model preference)
export async function saveAISettings(
  data: UserSettingsUpdate
): Promise<ActionResult<UserSettings>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Check if settings already exist
  const { data: existing } = await (supabase as any)
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let result

  if (existing) {
    // Update existing settings
    result = await (supabase as any)
      .from("user_settings")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single()
  } else {
    // Create new settings
    result = await (supabase as any)
      .from("user_settings")
      .insert({
        user_id: user.id,
        ...data,
      })
      .select()
      .single()
  }

  if (result.error) {
    return { error: result.error.message }
  }

  revalidatePath("/settings/ai")
  return { data: result.data as UserSettings }
}

// Save API key (separate function for security)
// Note: In production, you'd want to encrypt this key server-side
// For now, we'll store it with basic obfuscation (not true encryption)
export async function saveAIApiKey(
  apiKey: string
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Basic obfuscation - in production use proper encryption
  // This just makes it slightly harder to read in the database
  const obfuscatedKey = Buffer.from(apiKey).toString("base64")

  // Check if settings already exist
  const { data: existing } = await (supabase as any)
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let error

  if (existing) {
    const result = await (supabase as any)
      .from("user_settings")
      .update({
        ai_api_key_encrypted: obfuscatedKey,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    error = result.error
  } else {
    const result = await (supabase as any).from("user_settings").insert({
      user_id: user.id,
      ai_api_key_encrypted: obfuscatedKey,
    })

    error = result.error
  }

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings/ai")
  return { data: { success: true } }
}

// Get decrypted API key (for server-side AI calls only)
export async function getDecryptedApiKey(): Promise<ActionResult<string | null>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { data, error } = await (supabase as any)
    .from("user_settings")
    .select("ai_api_key_encrypted")
    .eq("user_id", user.id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null }
    }
    return { error: error.message }
  }

  if (!data.ai_api_key_encrypted) {
    return { data: null }
  }

  // Decode the obfuscated key
  const apiKey = Buffer.from(data.ai_api_key_encrypted, "base64").toString("utf-8")

  return { data: apiKey }
}

// Delete API key
export async function deleteAIApiKey(): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { error } = await (supabase as any)
    .from("user_settings")
    .update({
      ai_api_key_encrypted: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings/ai")
  return { data: { success: true } }
}

// Check if user has configured AI settings
export async function hasAIConfigured(): Promise<ActionResult<boolean>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { data, error } = await (supabase as any)
    .from("user_settings")
    .select("ai_provider, ai_api_key_encrypted")
    .eq("user_id", user.id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return { data: false }
    }
    return { error: error.message }
  }

  const hasConfig = Boolean(data.ai_provider && data.ai_api_key_encrypted)

  return { data: hasConfig }
}

// Get masked API key for display (shows only last 4 characters)
export async function getMaskedApiKey(): Promise<ActionResult<string | null>> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { data, error } = await (supabase as any)
    .from("user_settings")
    .select("ai_api_key_encrypted")
    .eq("user_id", user.id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null }
    }
    return { error: error.message }
  }

  if (!data.ai_api_key_encrypted) {
    return { data: null }
  }

  // Decode and mask
  const apiKey = Buffer.from(data.ai_api_key_encrypted, "base64").toString("utf-8")
  const masked = "•".repeat(Math.max(0, apiKey.length - 4)) + apiKey.slice(-4)

  return { data: masked }
}
