import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./types"

// Singleton instance for browser client
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
