import { createClient } from "@/lib/supabase/server"
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
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // Check if user has an organization
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .single()

        // If user has no organization, redirect to onboarding
        if (!membership) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      // Redirect to the requested page or home (which is projects)
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Log the exchange error for debugging
    console.error("Auth code exchange error:", exchangeError.message)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
  }

  // No code or error - invalid callback
  return NextResponse.redirect(`${origin}/login?error=Invalid authentication callback`)
}
