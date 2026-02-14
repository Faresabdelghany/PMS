// lib/cache/utils.ts
import { kv, isKVAvailable, memCache } from "./client"
import { logger } from "@/lib/logger"

/**
 * Cache-aside pattern: Try cache first, fallback to fetcher.
 * Non-blocking cache write on miss.
 *
 * Uses Vercel KV in production, in-memory cache for local dev.
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cache = isKVAvailable() ? kv : memCache

  try {
    // Try cache first
    const cached = await cache.get<T>(key)
    if (cached !== null) {
      return cached
    }
  } catch (error) {
    // Log but don't fail - fallback to fetcher
    logger.error(`GET error for ${key}`, { module: "cache", error })
  }

  // Cache miss - fetch fresh data
  const fresh = await fetcher()

  // Write to cache (non-blocking)
  if (fresh !== null && fresh !== undefined) {
    cache.set(key, fresh, { ex: ttlSeconds }).catch((error) => {
      logger.error(`SET error for ${key}`, { module: "cache", error })
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
  const cache = isKVAvailable() ? kv : memCache

  try {
    await cache.del(key)
  } catch (error) {
    logger.error(`DEL error for ${key}`, { module: "cache", error })
  }

  const fresh = await fetcher()

  if (fresh !== null && fresh !== undefined) {
    try {
      await cache.set(key, fresh, { ex: ttlSeconds })
    } catch (error) {
      logger.error(`SET error for ${key}`, { module: "cache", error })
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
