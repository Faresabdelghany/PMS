// lib/cache/utils.ts
import { kv, isKVAvailable } from "./client"

/**
 * Cache-aside pattern: Try cache first, fallback to fetcher.
 * Non-blocking cache write on miss.
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Skip cache if KV not available (local dev without KV)
  if (!isKVAvailable()) {
    return fetcher()
  }

  try {
    // Try cache first
    const cached = await kv.get<T>(key)
    if (cached !== null) {
      return cached
    }
  } catch (error) {
    // Log but don't fail - fallback to fetcher
    console.error(`[cache] GET error for ${key}:`, error)
  }

  // Cache miss - fetch fresh data
  const fresh = await fetcher()

  // Write to cache (non-blocking)
  if (fresh !== null && fresh !== undefined) {
    kv.set(key, fresh, { ex: ttlSeconds }).catch((error) => {
      console.error(`[cache] SET error for ${key}:`, error)
    })
  }

  return fresh
}

/**
 * Invalidate and immediately fetch fresh data.
 * Use after mutations when you need the updated data.
 */
export async function cacheInvalidateAndFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  if (!isKVAvailable()) {
    return fetcher()
  }

  try {
    await kv.del(key)
  } catch (error) {
    console.error(`[cache] DEL error for ${key}:`, error)
  }

  const fresh = await fetcher()

  if (fresh !== null && fresh !== undefined) {
    try {
      await kv.set(key, fresh, { ex: ttlSeconds })
    } catch (error) {
      console.error(`[cache] SET error for ${key}:`, error)
    }
  }

  return fresh
}

/**
 * Hash a query string for use in cache keys.
 */
export function hashQuery(query: string): string {
  let hash = 0
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
