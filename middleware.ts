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
 * Performance optimizations:
 * - Prefetch requests skip getUser() entirely (browser link preloads)
 * - KV session caching: recently validated sessions skip getUser() for 5 minutes
 * - Fast cookie check: no auth cookie → redirect without network call
 */

const SESSION_CACHE_TTL = 300 // 5 minutes (tokens expire in 1 hour, so 55-min buffer)

function isPrefetchRequest(request: NextRequest): boolean {
  return (
    request.headers.get("Purpose") === "prefetch" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  )
}

function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

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

  // OPTIMIZATION 1: Skip getUser() for prefetch requests
  // Browser link preloads don't need auth validation - the actual navigation will validate
  if (isPrefetchRequest(request)) {
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

  // OPTIMIZATION 2: KV session caching
  // If the user's session was validated recently (within 5 min), skip getUser()
  // getSession() is a fast local cookie read (~0ms) - safe between createServerClient and getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const sessionUserId = session?.user?.id

  if (sessionUserId && isKVConfigured()) {
    try {
      const { kv } = await import("@vercel/kv")
      const cacheKey = `pms:session:validated:${sessionUserId}`
      const isRecentlyValidated = await kv.get(cacheKey)

      if (isRecentlyValidated) {
        // Session was validated recently - skip expensive getUser() call
        // Handle redirects for authenticated users on auth pages
        if (pathname === "/login" || pathname === "/signup") {
          const url = request.nextUrl.clone()
          url.pathname = "/inbox"
          return NextResponse.redirect(url)
        }
        if (pathname === "/") {
          const url = request.nextUrl.clone()
          url.pathname = "/inbox"
          return NextResponse.redirect(url)
        }
        return supabaseResponse
      }
    } catch {
      // KV error - fall through to getUser()
    }
  }

  // Refreshing the auth token - this makes getSession() safe to use in Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Cache the validated session in KV for next request
  if (user && isKVConfigured()) {
    try {
      const { kv } = await import("@vercel/kv")
      kv.set(`pms:session:validated:${user.id}`, true, { ex: SESSION_CACHE_TTL }).catch(() => {})
    } catch {
      // Non-fatal
    }
  }

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
