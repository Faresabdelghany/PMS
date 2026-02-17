import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

// Service role client for admin operations (bypasses RLS)
// IMPORTANT: Only use server-side, never expose to client
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin credentials")
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
