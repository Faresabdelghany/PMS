// lib/rate-limit/limiter.ts
import { Ratelimit, type Duration } from "@upstash/ratelimit"
import { kv } from "@vercel/kv"

// ---------------------------------------------------------------------------
// In-memory fallback store
// Used when KV (Vercel KV / Upstash) is unavailable so rate limiting is
// still enforced instead of silently allowing all requests.
// Note: In serverless environments each instance has its own store, so limits
// are per-instance rather than global — still far better than no limiting.
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetAt: number }>()
const MAX_MEMORY_ENTRIES = 10_000
const CLEANUP_INTERVAL_MS = 60_000 // 1 minute
let lastCleanup = 0
let kvWarningLogged = false

/** Remove expired entries to prevent unbounded memory growth. */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [key, entry] of memoryStore) {
    if (entry.resetAt < now) memoryStore.delete(key)
  }

  // Hard cap: if still over limit after expiry sweep, evict oldest
  if (memoryStore.size > MAX_MEMORY_ENTRIES) {
    const sorted = [...memoryStore.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toRemove = sorted.slice(0, sorted.length - MAX_MEMORY_ENTRIES)
    for (const [key] of toRemove) memoryStore.delete(key)
  }
}

/**
 * In-memory sliding-window counter.
 * Safe against concurrent requests: the read-check-increment runs
 * synchronously within a single event-loop tick (no await between
 * Map.get and Map.set), so no interleaving is possible in Node.js.
 */
function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; reset: number } {
  cleanupExpiredEntries()

  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, reset: now + windowMs }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  return { success: entry.count <= limit, remaining, reset: entry.resetAt }
}

// ---------------------------------------------------------------------------
// Limiter config registry — maps Ratelimit instances to their window config
// so the in-memory fallback knows the limit and window duration.
// ---------------------------------------------------------------------------

type LimiterConfig = { limit: number; windowMs: number }

const limiterConfigs = new WeakMap<Ratelimit, LimiterConfig>()

function parseWindow(window: Duration): number {
  const match = window.match(/^(\d+)\s?(ms|s|m|h|d)$/)
  if (!match) return 60_000 // default 1 minute
  const value = parseInt(match[1], 10)
  switch (match[2]) {
    case "ms": return value
    case "s": return value * 1_000
    case "m": return value * 60_000
    case "h": return value * 3_600_000
    case "d": return value * 86_400_000
    default: return 60_000
  }
}

function createLimiter(limit: number, window: Duration, prefix: string): Ratelimit {
  const instance = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  })
  limiterConfigs.set(instance, { limit, windowMs: parseWindow(window) })
  return instance
}

/**
 * Rate limiters for different operation types.
 */
export const rateLimiters = {
  // Auth operations - protect against brute force (per-IP)
  auth: createLimiter(5, "15m", "rl:auth"),

  // Auth operations - protect against credential stuffing (per-email)
  // More generous than per-IP: multiple users may share a corporate IP,
  // but a single account shouldn't see >10 failed attempts in 15 minutes.
  authByEmail: createLimiter(10, "15m", "rl:auth:email"),

  // AI operations - cost control
  ai: createLimiter(50, "24h", "rl:ai"),

  // Concurrent AI - prevent abuse
  aiConcurrent: createLimiter(3, "1m", "rl:ai:concurrent"),

  // File uploads - storage cost control
  fileUpload: createLimiter(50, "1h", "rl:file"),

  // Invitations - prevent email spam
  invite: createLimiter(20, "1h", "rl:invite"),
}

export type RateLimitResult = {
  success: boolean
  remaining: number
  reset: number
}

/**
 * Check if KV is available for rate limiting.
 */
function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

/**
 * Check rate limit for an identifier.
 * Falls back to in-memory rate limiting when KV is unavailable.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const config = limiterConfigs.get(limiter)

  // KV not configured — use in-memory fallback
  if (!isKVAvailable()) {
    if (!kvWarningLogged) {
      console.warn("[rate-limit] KV unavailable, using in-memory fallback")
      kvWarningLogged = true
    }
    if (config) {
      const key = `${identifier}:${config.limit}:${config.windowMs}`
      return memoryRateLimit(key, config.limit, config.windowMs)
    }
    // Unknown limiter (not created via createLimiter) — deny by default
    return { success: false, remaining: 0, reset: Date.now() + 60_000 }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // KV error at runtime — fall back to in-memory
    console.error("[rate-limit] KV error, falling back to in-memory:", error)
    if (config) {
      const key = `${identifier}:${config.limit}:${config.windowMs}`
      return memoryRateLimit(key, config.limit, config.windowMs)
    }
    // Unknown limiter — deny by default
    return { success: false, remaining: 0, reset: Date.now() + 60_000 }
  }
}

/**
 * Create a rate limit error response.
 */
export function rateLimitError(reset: number): { error: string } {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000)
  return {
    error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
  }
}
