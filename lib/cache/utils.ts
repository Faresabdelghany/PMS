// lib/cache/utils.ts
import { kv, isKVAvailable, memCache } from "./client"
import { logger } from "@/lib/logger"

/** Fraction of TTL remaining below which a background refresh is triggered. */
const SWR_STALE_THRESHOLD = 0.25

/** Keys currently being refreshed — prevents thundering-herd duplicate fetches. */
const refreshing = new Set<string>()

/**
 * Cache-aside with stale-while-revalidate.
 *
 * 1. Cache HIT + fresh → return immediately
 * 2. Cache HIT + stale (< 25% TTL remaining) → return immediately, refresh in background
 * 3. Cache MISS → fetch, write to cache, return
 *
 * Uses Vercel KV in production, in-memory cache for local dev.
 */
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const useKV = isKVAvailable()
  const cache = useKV ? kv : memCache

  try {
    const cached = await cache.get<T>(key)
    if (cached !== null) {
      // SWR: fire-and-forget stale check — never blocks the cache hit return.
      // Previously this awaited kv.ttl() which added a second KV roundtrip
      // (~5-20ms) to every single cache hit, doubling effective KV latency.
      if (!refreshing.has(key)) {
        const checkAndRefresh = async () => {
          try {
            const remaining = useKV
              ? await kv.ttl(key)
              : await memCache.ttl(key)

            if (remaining >= 0 && remaining < ttlSeconds * SWR_STALE_THRESHOLD) {
              refreshing.add(key)
              try {
                const fresh = await fetcher()
                if (fresh !== null && fresh !== undefined) {
                  await cache.set(key, fresh, { ex: ttlSeconds })
                }
              } finally {
                refreshing.delete(key)
              }
            }
          } catch {
            // TTL check or refresh failed — non-fatal
          }
        }
        // Don't await — return cached data immediately
        checkAndRefresh()
      }
      return cached
    }
  } catch (error) {
    logger.error(`GET error for ${key}`, { module: "cache", error })
  }

  // Cache miss — fetch fresh data
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
