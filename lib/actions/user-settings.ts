"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "./types"
import type { AIProvider } from "@/lib/constants/ai"
import { encrypt, decrypt, isEncryptedFormat, migrateFromBase64 } from "@/lib/crypto"

// Note: user_settings table exists in DB but not in generated types
// Using explicit any for the table queries
 

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
// Uses AES-256-GCM encryption for secure storage
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

  // Encrypt the API key using AES-256-GCM
  let encryptedKey: string
  try {
    encryptedKey = encrypt(apiKey)
  } catch (err) {
    console.error("Encryption error:", err)
    return { error: "Failed to encrypt API key. Check server configuration." }
  }

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
        ai_api_key_encrypted: encryptedKey,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    error = result.error
  } else {
    const result = await (supabase as any).from("user_settings").insert({
      user_id: user.id,
      ai_api_key_encrypted: encryptedKey,
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

  const storedValue = data.ai_api_key_encrypted

  // Check if this is already using the new encryption format
  if (isEncryptedFormat(storedValue)) {
    try {
      const apiKey = decrypt(storedValue)
      return { data: apiKey }
    } catch (err) {
      console.error("Decryption error:", err)
      return { error: "Failed to decrypt API key" }
    }
  }

  // Legacy BASE64 format - migrate to proper encryption
  const migratedValue = migrateFromBase64(storedValue)
  if (migratedValue) {
    // Re-encrypt and save with new format
    await (supabase as any)
      .from("user_settings")
      .update({
        ai_api_key_encrypted: migratedValue,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    // Decrypt the newly encrypted value
    try {
      const apiKey = decrypt(migratedValue)
      return { data: apiKey }
    } catch (err) {
      console.error("Decryption error after migration:", err)
      return { error: "Failed to decrypt API key" }
    }
  }

  // Fallback: try BASE64 decode (for very old data)
  try {
    const apiKey = Buffer.from(storedValue, "base64").toString("utf-8")
    return { data: apiKey }
  } catch {
    return { error: "Failed to decode API key" }
  }
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
  // Use getDecryptedApiKey to handle decryption and migration
  const result = await getDecryptedApiKey()

  if (result.error) {
    return { error: result.error }
  }

  if (!result.data) {
    return { data: null }
  }

  // Mask the API key, showing only last 4 characters
  const apiKey = result.data
  const masked = "•".repeat(Math.max(0, apiKey.length - 4)) + apiKey.slice(-4)

  return { data: masked }
}
