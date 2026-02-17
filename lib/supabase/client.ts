import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./types"

// Singleton instance for browser client
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
      )
    }

    browserClient = createBrowserClient<Database>(
      supabaseUrl,
      supabaseAnonKey
    )
  }
  return browserClient
}
