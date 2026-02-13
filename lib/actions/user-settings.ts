"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "./types"
import type { AIProvider } from "@/lib/constants/ai"
import { encrypt, decrypt, isEncryptedFormat, migrateFromBase64 } from "@/lib/crypto"
import { invalidate, invalidateCache } from "@/lib/cache"
import { requireAuth, type TypedSupabaseClient } from "./auth-helpers"
import { getStoragePublicUrl, removeStorageFile } from "@/lib/supabase/storage-utils"
import type { AIProviderDB as DbAIProvider } from "@/lib/supabase/types"
import { MAX_AVATAR_SIZE } from "@/lib/constants"

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

// Preference validation schema
const preferencesSchema = z.object({
  timezone: z.string().optional(),
  week_start_day: z.enum(['monday', 'sunday', 'saturday']).optional(),
  open_links_in_app: z.boolean().optional(),
  color_theme: z.enum(['default', 'forest', 'ocean', 'sunset', 'rose', 'supabase', 'chatgpt', 'midnight', 'lavender', 'ember', 'mint', 'slate']).optional(),
})

// Notification settings schema
const notificationSettingsSchema = z.object({
  notifications_in_app: z.boolean().optional(),
  notifications_email: z.boolean().optional(),
})

// Color theme type
export type ColorThemeType = 'default' | 'forest' | 'ocean' | 'sunset' | 'rose' | 'supabase' | 'chatgpt' | 'midnight' | 'lavender' | 'ember' | 'mint' | 'slate'

/**
 * Get user color theme - optimized version that accepts pre-fetched auth context
 *
 * When called from the dashboard layout (which already has the supabase client
 * and user from cachedGetUser), pass them to avoid a duplicate auth check.
 *
 * @param supabase - Optional pre-fetched Supabase client
 * @param userId - Optional pre-fetched user ID
 */
export async function getUserColorTheme(
  supabase?: TypedSupabaseClient,
  userId?: string
): Promise<ColorThemeType> {
  try {
    // If supabase and userId are provided, use them directly (avoids duplicate auth)
    // Otherwise, fall back to requireAuth() for standalone usage
    let client = supabase
    let uid = userId

    if (!client || !uid) {
      const auth = await requireAuth()
      client = auth.supabase
      uid = auth.user.id
    }

    const { data } = await client
      .from("user_settings")
      .select("color_theme")
      .eq("user_id", uid)
      .single()

    return (data?.color_theme as ColorThemeType) || "default"
  } catch {
    return "default"
  }
}

// Extended type with preferences
export type UserSettingsWithPreferences = UserSettings & {
  timezone: string
  week_start_day: 'monday' | 'sunday' | 'saturday'
  open_links_in_app: boolean
  notifications_in_app: boolean
  notifications_email: boolean
  color_theme: ColorThemeType
}

// Get user AI settings
export async function getAISettings(): Promise<ActionResult<UserSettings | null>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
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
  } catch {
    return { error: "Not authenticated" }
  }
}

// Save AI settings (provider and model preference)
export async function saveAISettings(
  data: UserSettingsUpdate
): Promise<ActionResult<UserSettings>> {
  try {
    const { user, supabase } = await requireAuth()

    // Check if settings already exist
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single()

    let result

    // Build update payload, casting AIProvider to match DB enum
    // (constants/ai includes null + extra providers; DB type is narrower)
    const payload = {
      ...data,
      ai_provider: data.ai_provider as DbAIProvider | undefined,
    }

    if (existing) {
      // Update existing settings
      result = await supabase
        .from("user_settings")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single()
    } else {
      // Create new settings
      result = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          ...payload,
        })
        .select()
        .single()
    }

    if (result.error) {
      return { error: result.error.message }
    }

    revalidatePath("/settings/ai")
    return { data: result.data as UserSettings }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Save API key (separate function for security)
// Uses AES-256-GCM encryption for secure storage
export async function saveAIApiKey(
  apiKey: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Encrypt the API key using AES-256-GCM
    let encryptedKey: string
    try {
      encryptedKey = encrypt(apiKey)
    } catch {
      return { error: "Failed to encrypt API key. Check server configuration." }
    }

    // Check if settings already exist
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single()

    let error

    if (existing) {
      const result = await supabase
        .from("user_settings")
        .update({
          ai_api_key_encrypted: encryptedKey,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)

      error = result.error
    } else {
      const result = await supabase.from("user_settings").insert({
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
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get decrypted API key (for server-side AI calls only)
export async function getDecryptedApiKey(): Promise<ActionResult<string | null>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
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
      } catch {
        return { error: "Failed to decrypt API key" }
      }
    }

    // Legacy BASE64 format - migrate to proper encryption
    const migratedValue = migrateFromBase64(storedValue)
    if (migratedValue) {
      // Re-encrypt and save with new format
      await supabase
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
      } catch {
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
  } catch {
    return { error: "Not authenticated" }
  }
}

// Delete API key
export async function deleteAIApiKey(): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, supabase } = await requireAuth()

    const { error } = await supabase
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
  } catch {
    return { error: "Not authenticated" }
  }
}

// Check if user has configured AI settings
export async function hasAIConfigured(): Promise<ActionResult<boolean>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
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
  } catch {
    return { error: "Not authenticated" }
  }
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

// Upload avatar image
export async function uploadAvatar(
  formData: FormData
): Promise<ActionResult<{ avatarUrl: string }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Get file from FormData
    const file = formData.get("avatar") as File | null
    if (!file) {
      return { error: "No file provided" }
    }

    // Validate file type — explicit allowlist (not prefix check) to block SVG XSS
    const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"]
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return { error: "File must be a PNG, JPEG, or WebP image" }
    }

    // Validate file size (max 5MB)
    if (file.size > MAX_AVATAR_SIZE) {
      return { error: "Image must be less than 5MB" }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const ext = file.name.split(".").pop() || "jpg"
    const filename = `${user.id}/${timestamp}.${ext}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Upload to avatars bucket
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filename, fileData, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      return { error: `Failed to upload avatar: ${uploadError.message}` }
    }

    // Get public URL
    const avatarUrl = getStoragePublicUrl(supabase, "avatars", filename)

    if (!avatarUrl) {
      return { error: "Failed to get avatar URL after upload" }
    }

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id)

    if (updateError) {
      return { error: `Failed to update profile: ${updateError.message}` }
    }

    // Get all organizations the user belongs to for cache invalidation
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)

    const orgIds = memberships?.map((m) => m.organization_id) || []

    await invalidateCache.profile({ userId: user.id, orgIds })

    revalidatePath("/settings")
    // Revalidate dashboard to update sidebar and other profile displays
    revalidatePath("/", "layout")

    return { data: { avatarUrl } }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Delete avatar image
export async function deleteAvatar(): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Get current avatar URL to find the storage path
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single()

    if (profile?.avatar_url) {
      // Extract filename from URL and delete from storage
      try {
        const url = new URL(profile.avatar_url)
        const pathParts = url.pathname.split("/")
        const bucketIndex = pathParts.indexOf("avatars")
        if (bucketIndex !== -1) {
          const storagePath = pathParts.slice(bucketIndex + 1).join("/")
          await removeStorageFile(supabase, "avatars", [storagePath])
        }
      } catch {
        // Ignore URL parsing errors — avatar URL may be an external OAuth URL
      }
    }

    // Clear avatar URL from profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id)

    if (updateError) {
      return { error: `Failed to update profile: ${updateError.message}` }
    }

    // Get all organizations the user belongs to for cache invalidation
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)

    const orgIds = memberships?.map((m) => m.organization_id) || []

    await invalidateCache.profile({ userId: user.id, orgIds })

    revalidatePath("/settings")
    // Revalidate dashboard to update sidebar and other profile displays
    revalidatePath("/", "layout")

    return { data: { success: true } }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Get user preferences
export async function getPreferences(): Promise<ActionResult<UserSettingsWithPreferences | null>> {
  try {
    const { user, supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // Return defaults if no settings exist
        return {
          data: {
            id: "",
            user_id: user.id,
            ai_provider: "openai",
            ai_api_key_encrypted: null,
            ai_model_preference: null,
            timezone: "auto",
            week_start_day: "monday",
            open_links_in_app: true,
            notifications_in_app: true,
            notifications_email: true,
            color_theme: "default",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as UserSettingsWithPreferences,
        }
      }
      return { error: error.message }
    }

    return { data: data as UserSettingsWithPreferences }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Save user preferences
export async function savePreferences(
  data: z.infer<typeof preferencesSchema>
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Validate input
    const validation = preferencesSchema.safeParse(data)
    if (!validation.success) {
      return { error: validation.error.errors[0]?.message || "Invalid input" }
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single()

    let error

    if (existing) {
      const result = await supabase
        .from("user_settings")
        .update({
          ...validation.data,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
      error = result.error
    } else {
      const result = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          ...validation.data,
        })
      error = result.error
    }

    if (error) {
      return { error: error.message }
    }

    // Invalidate KV color theme cache if color_theme was updated
    if (validation.data.color_theme) {
      await invalidate.colorTheme(user.id)
    }

    revalidatePath("/settings")
    return { data: { success: true } }
  } catch {
    return { error: "Not authenticated" }
  }
}

// Save notification settings
export async function saveNotificationSettings(
  data: z.infer<typeof notificationSettingsSchema>
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, supabase } = await requireAuth()

    // Validate input
    const validation = notificationSettingsSchema.safeParse(data)
    if (!validation.success) {
      return { error: validation.error.errors[0]?.message || "Invalid input" }
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single()

    let error

    if (existing) {
      const result = await supabase
        .from("user_settings")
        .update({
          ...validation.data,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
      error = result.error
    } else {
      const result = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          ...validation.data,
        })
      error = result.error
    }

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/settings")
    return { data: { success: true } }
  } catch {
    return { error: "Not authenticated" }
  }
}
