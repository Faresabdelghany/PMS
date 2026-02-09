import { createClient } from "@/lib/supabase/server"
import { createPersonalOrganization } from "@/lib/actions/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")
  const next = requestUrl.searchParams.get("next") ?? "/"
  const origin = requestUrl.origin

  // Handle OAuth errors from the provider
  if (error) {
    const errorMessage = errorDescription || error
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMessage)}`)
  }

  if (code) {
    const supabase = await createClient()
    // Exchange code for session - the session data contains the user, no need for separate getUser() call
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && sessionData.session) {
      const user = sessionData.session.user

      // Check if user already has an organization membership
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()

      // If user has no organization, auto-create a personal workspace
      if (!membership) {
        const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "My"
        const orgResult = await createPersonalOrganization(user.id, fullName)
        if (orgResult.error) {
          console.error("Failed to create personal organization:", orgResult.error)
          // Fallback to onboarding if auto-creation fails
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      // Warm KV cache + session validation BEFORE redirect
      // Session validation prevents middleware from calling getUser() (~300-500ms savings)
      try {
        const { warmUserCache, kv, isKVAvailable } = await import("@/lib/cache")
        const { CacheKeys, CacheTTL } = await import("@/lib/cache/keys")
        await Promise.allSettled([
          warmUserCache(user.id),
          isKVAvailable()
            ? kv.set(CacheKeys.sessionValidated(user.id), true, { ex: CacheTTL.SESSION })
            : Promise.resolve(),
        ])
      } catch {
        // Non-fatal
      }

      // Redirect to the requested page or home (which is projects)
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Log the exchange error for debugging
    console.error("Auth code exchange error:", exchangeError?.message)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError?.message || "Authentication failed")}`)
  }

  // No code or error - invalid callback
  return NextResponse.redirect(`${origin}/login?error=Invalid authentication callback`)
}
