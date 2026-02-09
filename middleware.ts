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

const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback", "/invite"]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.includes("auth-token"))
}

function redirectTo(request: NextRequest, path: string, query?: Record<string, string>): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = path
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }
  return NextResponse.redirect(url)
}

function shouldRedirectToInbox(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup" || pathname === "/"
}

async function tryKVSessionCheck(sessionUserId: string): Promise<boolean> {
  if (!isKVConfigured()) return false
  try {
    const { kv } = await import("@vercel/kv")
    const isValid = await kv.get(`pms:session:validated:${sessionUserId}`)
    return !!isValid
  } catch {
    return false
  }
}

async function cacheSessionInKV(userId: string): Promise<void> {
  if (!isKVConfigured()) return
  try {
    const { kv } = await import("@vercel/kv")
    await kv.set(`pms:session:validated:${userId}`, true, { ex: SESSION_CACHE_TTL })
  } catch {
    // Non-fatal
  }
}

function createSupabaseMiddlewareClient(request: NextRequest, getResponse: () => NextResponse, setResponse: (r: NextResponse) => void) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const newResponse = NextResponse.next({ request })
          setResponse(newResponse)
          cookiesToSet.forEach(({ name, value, options }) =>
            newResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = isPublicRoute(pathname)

  // Fast path: No auth cookie → skip all Supabase calls
  if (!hasAuthCookie(request)) {
    if (!isPublic) return redirectTo(request, "/login", { redirect: pathname })
    return NextResponse.next({ request })
  }

  // Skip getUser() for prefetch requests
  if (isPrefetchRequest(request)) return NextResponse.next({ request })

  // Auth cookie exists → create Supabase client to refresh token
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createSupabaseMiddlewareClient(
    request,
    () => supabaseResponse,
    (r) => { supabaseResponse = r }
  )

  // getSession() reads from cookie locally (fast) and refreshes token if expired
  const { data: { session } } = await supabase.auth.getSession()
  const sessionUserId = session?.user?.id

  // Fast redirect: for "/" and auth pages, redirect to /inbox immediately
  // after getSession() — skip expensive getUser() since the destination
  // page validates auth via the layout's cachedGetUser()
  // Await KV cache write so the subsequent /inbox request hits the cache
  // and skips the expensive getUser() call (~300-500ms savings)
  if (sessionUserId && shouldRedirectToInbox(pathname)) {
    await cacheSessionInKV(sessionUserId)
    return redirectTo(request, "/inbox")
  }

  // Check KV session cache before expensive getUser()
  if (sessionUserId && await tryKVSessionCheck(sessionUserId)) {
    return supabaseResponse
  }

  // Full auth validation
  const { data: { user } } = await supabase.auth.getUser()

  // Fire-and-forget KV cache (non-critical, don't block response)
  if (user) cacheSessionInKV(user.id)

  if (!user && !isPublic) return redirectTo(request, "/login", { redirect: pathname })
  if (user && shouldRedirectToInbox(pathname)) return redirectTo(request, "/inbox")

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
