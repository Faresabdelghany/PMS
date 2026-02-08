import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Supabase Auth Middleware
 *
 * This middleware refreshes the auth session on every request, ensuring:
 * 1. The auth token is always fresh (no expired token issues)
 * 2. Server Components can use getSession() instead of getUser() for faster auth checks
 *    (getSession reads from cookies locally, getUser makes a network call)
 * 3. Unauthenticated users are redirected to /login
 *
 * Performance impact: ~300-500ms faster per navigation by avoiding getUser() network
 * calls in Server Components (they can use the already-refreshed session from cookies).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup", "/auth/callback", "/invite"]
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // Fast path: Quick cookie check BEFORE expensive getUser() call
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.includes("auth-token"))

  // No auth cookie + protected route → redirect immediately (saves ~300-500ms)
  if (!hasAuthCookie && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // No auth cookie + public route → skip getUser() entirely (saves ~300-500ms)
  // Nothing to refresh when there's no session
  if (!hasAuthCookie && isPublicRoute) {
    return NextResponse.next({ request })
  }

  // Auth cookie exists → refresh the token via getUser()
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Refreshing the auth token - this makes getSession() safe to use in Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Cookie existed but was invalid/expired → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages and root to inbox
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone()
    url.pathname = "/inbox"
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from / to /inbox (avoids extra redirect hop)
  if (user && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/inbox"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.png, apple-touch-icon.png (app icons)
     * - sw.js (service worker - must not be redirected)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png|robots\\.txt|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
