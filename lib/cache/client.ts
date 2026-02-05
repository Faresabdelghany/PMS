// lib/cache/client.ts
import { kv } from "@vercel/kv"

/**
 * Re-export the Vercel KV client.
 * Centralized for easier mocking in tests and potential client switching.
 */
export { kv }

/**
 * Check if KV is available (has required env vars).
 */
export function isKVAvailable(): boolean {
  return !!(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  )
}

// ============================================
// IN-MEMORY CACHE (fallback for local dev)
// ============================================

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()

/**
 * In-memory cache for local development when KV is not available.
 * This significantly speeds up page loads by caching Supabase responses.
 *
 * Note: This cache is per-process and resets on server restart.
 * In production, use KV for persistent cross-instance caching.
 */
export const memCache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = memoryCache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key)
      return null
    }

    return entry.value
  },

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<void> {
    const ttlSeconds = options?.ex ?? 60 // Default 60 seconds
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  },

  async del(key: string): Promise<void> {
    memoryCache.delete(key)
  },

  // Clean up expired entries periodically (call this occasionally)
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of memoryCache.entries()) {
      if (now > entry.expiresAt) {
        memoryCache.delete(key)
      }
    }
  },
}
