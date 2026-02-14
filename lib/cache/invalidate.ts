// lib/cache/invalidate.ts
import { kv, isKVAvailable, memCache } from "./client"
import { CacheKeys } from "./keys"
import { logger } from "@/lib/logger"

/**
 * Cache invalidation helpers.
 * Use these after mutations to clear stale data.
 */
export const invalidate = {
  /**
   * Delete a single cache key.
   */
  async key(key: string): Promise<void> {
    try {
      if (isKVAvailable()) {
        await kv.del(key)
      } else {
        await memCache.del(key)
      }
    } catch (error) {
      logger.error(`invalidate.key error for ${key}`, { module: "cache", error })
    }
  },

  /**
   * Delete multiple cache keys.
   */
  async keys(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      if (isKVAvailable()) {
        await kv.del(...keys)
      } else {
        await Promise.all(keys.map((k) => memCache.del(k)))
      }
    } catch (error) {
      logger.error("invalidate.keys error", { module: "cache", error })
    }
  },

  /**
   * Invalidate all project-related cache keys.
   */
  async project(projectId: string, orgId: string): Promise<void> {
    await this.keys([
      CacheKeys.project(projectId),
      CacheKeys.projects(orgId),
      CacheKeys.sidebar(orgId),
      CacheKeys.projectMembers(projectId),
      CacheKeys.projectTasks(projectId),
      CacheKeys.workstreams(projectId),
    ])
  },

  /**
   * Invalidate task-related cache keys.
   */
  async task(
    projectId: string,
    assigneeId: string | null,
    orgId: string
  ): Promise<void> {
    const keys = [CacheKeys.projectTasks(projectId)]
    if (assigneeId) {
      keys.push(CacheKeys.userTasks(assigneeId, orgId))
    }
    await this.keys(keys)
  },

  /**
   * Invalidate task cache for multiple assignees (bulk operations).
   */
  async taskBulk(
    projectId: string,
    assigneeIds: string[],
    orgId: string
  ): Promise<void> {
    const keys = [CacheKeys.projectTasks(projectId)]
    for (const assigneeId of assigneeIds) {
      if (assigneeId) {
        keys.push(CacheKeys.userTasks(assigneeId, orgId))
      }
    }
    await this.keys(keys)
  },

  /**
   * Invalidate user org membership cache.
   */
  async userOrgMembership(userId: string, orgId: string): Promise<void> {
    await this.keys([
      CacheKeys.userOrgs(userId),
      CacheKeys.membership(orgId, userId),
      CacheKeys.orgMembers(orgId),
    ])
  },

  /**
   * Invalidate client-related cache keys.
   */
  async client(orgId: string): Promise<void> {
    await this.keys([
      CacheKeys.clients(orgId),
      CacheKeys.clientsWithCounts(orgId),
    ])
  },

  /**
   * Invalidate inbox cache keys.
   */
  async inbox(userId: string): Promise<void> {
    await this.key(CacheKeys.inbox(userId))
  },

  /**
   * Invalidate workstream cache keys.
   */
  async workstream(projectId: string): Promise<void> {
    await this.keys([CacheKeys.workstreams(projectId)])
  },

  /**
   * Invalidate team cache keys.
   */
  async team(orgId: string): Promise<void> {
    await this.keys([CacheKeys.teams(orgId)])
  },

  /**
   * Invalidate tag cache keys.
   */
  async tags(orgId: string): Promise<void> {
    await this.keys([CacheKeys.tags(orgId)])
  },

  /**
   * Invalidate label cache keys.
   */
  async labels(orgId: string): Promise<void> {
    await this.keys([CacheKeys.labels(orgId)])
  },

  /**
   * Invalidate session validation cache.
   */
  async session(userId: string): Promise<void> {
    await this.key(CacheKeys.sessionValidated(userId))
  },

  /**
   * Invalidate project membership cache.
   */
  async projectMembership(projectId: string, userId: string): Promise<void> {
    await this.key(CacheKeys.projectMembership(projectId, userId))
  },

  /**
   * Invalidate search cache for an org (all queries).
   * Uses pattern matching - more expensive, use sparingly.
   * Note: Pattern matching only works with KV. Memory cache entries expire naturally.
   */
  async search(orgId: string): Promise<void> {
    if (!isKVAvailable()) {
      // Memory cache doesn't support pattern matching
      // Search entries will expire naturally via TTL
      return
    }
    try {
      const pattern = `pms:search:${orgId}:*`
      const keys = await kv.keys(pattern)
      if (keys.length > 0) {
        await kv.del(...keys)
      }
    } catch (error) {
      logger.error("invalidate.search error", { module: "cache", error })
    }
  },

  /**
   * Invalidate color theme cache.
   */
  async colorTheme(userId: string): Promise<void> {
    await this.key(CacheKeys.colorTheme(userId))
  },

  /**
   * Invalidate conversations cache for a user in an org.
   */
  async conversations(userId: string, orgId: string): Promise<void> {
    await this.key(CacheKeys.conversations(userId, orgId))
  },

  /**
   * Invalidate AI context cache for a user in an org.
   */
  async aiContext(userId: string, orgId: string): Promise<void> {
    await this.key(CacheKeys.aiContext(userId, orgId))
  },

  /**
   * Invalidate dashboard stats cache for a user in an org.
   */
  async dashboardStats(userId: string, orgId: string): Promise<void> {
    await this.key(CacheKeys.dashboardStats(userId, orgId))
  },

  /**
   * Invalidate caches that include profile/avatar data.
   * Called when a user updates their profile (avatar, name, etc.)
   *
   * Only invalidates caches that actually contain profile data:
   * - orgMembers (renders member names/avatars)
   * - sidebar (shows user info)
   * Projects and clients caches don't embed profile data, so skipping them
   * avoids unnecessary cache misses and re-fetches.
   */
  async profile(userId: string, orgIds: string[]): Promise<void> {
    const keys: string[] = [CacheKeys.user(userId)]

    for (const orgId of orgIds) {
      keys.push(
        CacheKeys.orgMembers(orgId),
        CacheKeys.sidebar(orgId)
      )
    }

    await this.keys(keys)
  },
}
