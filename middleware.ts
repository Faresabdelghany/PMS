import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { CacheTTL, CacheKeys } from "@/lib/cache/keys"

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
 * - KV session caching: recently validated sessions skip getUser() for CacheTTL.SESSION
 * - Fast cookie check: no auth cookie → redirect without network call
 *
 * Security:
 * - Per-request nonce for CSP (eliminates 'unsafe-inline' for script-src)
 */

const SESSION_CACHE_TTL = CacheTTL.SESSION // 5 minutes (centralized in lib/cache/keys.ts)

function isPrefetchRequest(request: NextRequest): boolean {
  return (
    request.headers.get("Purpose") === "prefetch" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  )
}

function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback", "/invite", "/forgot-password"]

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

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://vitals.vercel-analytics.com https://va.vercel-scripts.com",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}

function applyCSP(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp)
  return response
}

async function tryKVSessionCheck(sessionUserId: string): Promise<boolean> {
  if (!isKVConfigured()) return false
  try {
    const { kv } = await import("@vercel/kv")
    const isValid = await kv.get(CacheKeys.sessionValidated(sessionUserId))
    return !!isValid
  } catch {
    return false
  }
}

async function cacheSessionInKV(userId: string): Promise<void> {
  if (!isKVConfigured()) return
  try {
    const { kv } = await import("@vercel/kv")
    await kv.set(CacheKeys.sessionValidated(userId), true, { ex: SESSION_CACHE_TTL })
  } catch {
    // Non-fatal
  }
}

function createSupabaseMiddlewareClient(
  request: NextRequest,
  requestHeaders: Headers,
  getResponse: () => NextResponse,
  setResponse: (r: NextResponse) => void,
) {
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
          const newResponse = NextResponse.next({ request: { headers: requestHeaders } })
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

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeaderValue = buildCspHeader(nonce)

  // Clone request headers and inject nonce for Server Components to read
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  // Fast path: No auth cookie → skip all Supabase calls
  if (!hasAuthCookie(request)) {
    if (!isPublic) return applyCSP(redirectTo(request, "/login", { redirect: pathname }), cspHeaderValue)
    return applyCSP(NextResponse.next({ request: { headers: requestHeaders } }), cspHeaderValue)
  }

  // Skip getUser() for prefetch requests
  if (isPrefetchRequest(request)) {
    return applyCSP(NextResponse.next({ request: { headers: requestHeaders } }), cspHeaderValue)
  }

  // Auth cookie exists → create Supabase client to refresh token
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createSupabaseMiddlewareClient(
    request,
    requestHeaders,
    () => supabaseResponse,
    (r) => { supabaseResponse = r }
  )

  // getSession() reads from cookie locally (fast) and refreshes token if expired
  const { data: { session } } = await supabase.auth.getSession()
  const sessionUserId = session?.user?.id

  // Rewrite "/" to /inbox (no round trip — saves ~300ms)
  if (sessionUserId && pathname === '/') {
    await cacheSessionInKV(sessionUserId)
    const url = request.nextUrl.clone()
    url.pathname = '/inbox'
    return applyCSP(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), cspHeaderValue)
  }

  // Redirect /login and /signup to /inbox (URL change is desired here)
  if (sessionUserId && (pathname === '/login' || pathname === '/signup')) {
    await cacheSessionInKV(sessionUserId)
    return applyCSP(redirectTo(request, "/inbox"), cspHeaderValue)
  }

  // Check KV session cache before expensive getUser()
  if (sessionUserId && await tryKVSessionCheck(sessionUserId)) {
    return applyCSP(supabaseResponse, cspHeaderValue)
  }

  // Full auth validation
  const { data: { user } } = await supabase.auth.getUser()

  // Fire-and-forget KV cache (non-critical, don't block response)
  if (user) cacheSessionInKV(user.id)

  if (!user && !isPublic) return applyCSP(redirectTo(request, "/login", { redirect: pathname }), cspHeaderValue)
  if (user && (pathname === '/login' || pathname === '/signup')) return applyCSP(redirectTo(request, "/inbox"), cspHeaderValue)
  if (user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/inbox'
    return applyCSP(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), cspHeaderValue)
  }

  return applyCSP(supabaseResponse, cspHeaderValue)
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
