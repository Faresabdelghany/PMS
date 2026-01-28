// lib/cache/invalidate.ts
import { kv, isKVAvailable } from "./client"
import { CacheKeys } from "./keys"

/**
 * Cache invalidation helpers.
 * Use these after mutations to clear stale data.
 */
export const invalidate = {
  /**
   * Delete a single cache key.
   */
  async key(key: string): Promise<void> {
    if (!isKVAvailable()) return
    try {
      await kv.del(key)
    } catch (error) {
      console.error(`[cache] invalidate.key error for ${key}:`, error)
    }
  },

  /**
   * Delete multiple cache keys.
   */
  async keys(keys: string[]): Promise<void> {
    if (!isKVAvailable() || keys.length === 0) return
    try {
      await kv.del(...keys)
    } catch (error) {
      console.error(`[cache] invalidate.keys error:`, error)
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
    await this.keys([CacheKeys.clients(orgId)])
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
   * Invalidate search cache for an org (all queries).
   * Uses pattern matching - more expensive, use sparingly.
   */
  async search(orgId: string): Promise<void> {
    if (!isKVAvailable()) return
    try {
      const pattern = `pms:search:${orgId}:*`
      const keys = await kv.keys(pattern)
      if (keys.length > 0) {
        await kv.del(...keys)
      }
    } catch (error) {
      console.error(`[cache] invalidate.search error:`, error)
    }
  },
}
