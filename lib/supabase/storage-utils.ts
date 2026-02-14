import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

/**
 * Safely get a public URL for a storage object.
 * Returns the URL string or null if the path is empty/invalid.
 */
export function getStoragePublicUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): string | null {
  if (!path) return null
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || null
}

/**
 * Safely remove file(s) from storage.
 * Logs errors but doesn't throw — used for cleanup operations.
 */
export async function removeStorageFile(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) {
    logger.error(`Failed to remove files from ${bucket}`, { module: "storage", error: error.message })
    return { error: error.message }
  }
  return { error: null }
}
