// lib/rate-limit/limiter.ts
import { Ratelimit } from "@upstash/ratelimit"
import { kv } from "@vercel/kv"

/**
 * Rate limiters for different operation types.
 */
export const rateLimiters = {
  // Auth operations - protect against brute force
  auth: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(5, "15m"),
    prefix: "rl:auth",
  }),

  // AI operations - cost control
  ai: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(50, "24h"),
    prefix: "rl:ai",
  }),

  // Concurrent AI - prevent abuse
  aiConcurrent: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(3, "1m"),
    prefix: "rl:ai:concurrent",
  }),

  // File uploads - storage cost control
  fileUpload: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(50, "1h"),
    prefix: "rl:file",
  }),

  // Invitations - prevent email spam
  invite: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(20, "1h"),
    prefix: "rl:invite",
  }),
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
 * Returns success: true if KV is not available (graceful degradation).
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  // Skip rate limiting if KV not available (local dev)
  if (!isKVAvailable()) {
    return {
      success: true,
      remaining: 999,
      reset: Date.now() + 60000,
    }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // Log error but don't block the request
    console.error("[rate-limit] Error checking rate limit:", error)
    return {
      success: true,
      remaining: 999,
      reset: Date.now() + 60000,
    }
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
