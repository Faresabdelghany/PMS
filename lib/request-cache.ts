import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Request-level cache: Auth & Supabase client
 *
 * This module caches ONLY the foundational auth/client objects.
 * All data-fetching cached functions live in lib/server-cache.ts.
 *
 * IMPORTANT: Do NOT add data-fetching cache wrappers here.
 * React's cache() deduplicates by function identity — duplicate wrappers
 * in separate modules create separate cache entries, causing redundant
 * DB queries instead of sharing results.
 */

/**
 * Request-scoped Supabase client singleton
 *
 * This ensures only one Supabase client is created per request, even when
 * multiple server actions are called. Each createClient() call instantiates
 * a new SupabaseClient object, so caching this saves ~50-100ms per request.
 */
export const getSupabaseClient = cache(async () => {
  return await createClient()
})

/**
 * Cached auth check - uses getSession() for fast local cookie reads
 *
 * IMPORTANT: This relies on proxy.ts refreshing the auth token.
 * With the proxy in place, getSession() is safe and reads from cookies locally
 * (~0ms) instead of making a network call to Supabase Auth (~300-500ms).
 *
 * This is critical for performance: layout and pages can both call this
 * without duplicate network calls.
 */
export const cachedGetUser = cache(async () => {
  const supabase = await getSupabaseClient()
  // Use getSession() for fast local cookie reads (middleware refreshes the token)
  // This avoids the ~300-500ms network call that getUser() makes
  const { data: { session }, error } = await supabase.auth.getSession()
  return { user: session?.user ?? null, error, supabase }
})
