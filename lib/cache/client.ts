// lib/cache/client.ts
import { kv } from "@vercel/kv"
import {
  MAX_MEMORY_CACHE_SIZE,
  MEMORY_CACHE_WARN_THRESHOLD,
  MEMORY_CACHE_CLEANUP_INTERVAL_MS,
} from "@/lib/constants"
import { logger } from "@/lib/logger"

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
  lastAccessed: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
let lastCleanup = 0
let warnLogged = false

/**
 * Remove expired entries and enforce the max-size cap.
 * Runs at most once per MEMORY_CACHE_CLEANUP_INTERVAL_MS.
 */
function evict(): void {
  const now = Date.now()
  if (now - lastCleanup < MEMORY_CACHE_CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  // 1. Sweep expired entries
  for (const [key, entry] of memoryCache) {
    if (now > entry.expiresAt) {
      memoryCache.delete(key)
    }
  }

  // 2. Warn at threshold (with hysteresis: warn at 80%, reset at 60%)
  const warnAt = Math.floor(MAX_MEMORY_CACHE_SIZE * MEMORY_CACHE_WARN_THRESHOLD)
  if (memoryCache.size >= warnAt && !warnLogged) {
    logger.warn(`Size ${memoryCache.size} reached ${Math.round(MEMORY_CACHE_WARN_THRESHOLD * 100)}% of max (${MAX_MEMORY_CACHE_SIZE})`, { module: "mem-cache" })
    warnLogged = true
  } else if (memoryCache.size < Math.floor(MAX_MEMORY_CACHE_SIZE * 0.6)) {
    warnLogged = false
  }

  // 3. LRU eviction: if still over max, drop least-recently-accessed entries
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const sorted = [...memoryCache.entries()].sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    )
    const toRemove = sorted.slice(0, memoryCache.size - MAX_MEMORY_CACHE_SIZE)
    for (const [key] of toRemove) {
      memoryCache.delete(key)
    }
    if (toRemove.length > 0) {
      logger.warn(`LRU evicted ${toRemove.length} entries (now ${memoryCache.size}/${MAX_MEMORY_CACHE_SIZE})`, { module: "mem-cache" })
    }
  }
}

/**
 * In-memory cache for local development when KV is not available.
 * This significantly speeds up page loads by caching Supabase responses.
 *
 * Bounded by MAX_MEMORY_CACHE_SIZE with LRU eviction.
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

    // Update last-accessed for LRU tracking
    entry.lastAccessed = Date.now()
    return entry.value
  },

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<void> {
    const now = Date.now()
    const ttlSeconds = options?.ex ?? 60 // Default 60 seconds

    memoryCache.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      lastAccessed: now,
    })

    // Run eviction check after writes
    evict()
  },

  async del(key: string): Promise<void> {
    memoryCache.delete(key)
  },

  /**
   * Get remaining TTL in seconds for a key.
   * Returns -1 if key doesn't exist or is expired.
   */
  async ttl(key: string): Promise<number> {
    const entry = memoryCache.get(key)
    if (!entry) return -1
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -1
  },
}
