import { createServerClient } from "@supabase/ssr"
import { type NextRequest } from "next/server"
import type { Database } from "./types"

/**
 * Create a Supabase client for API Route Handlers.
 * This reads cookies directly from the NextRequest instead of using cookies() from next/headers,
 * which can be more reliable in API routes on Vercel.
 */
export function createApiRouteClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // API routes can't set cookies in the response this way,
          // but that's OK for read-only operations like auth verification
        },
      },
    }
  )
}
