// lib/cache/invalidation.ts

/**
 * Unified cache invalidation helpers.
 *
 * This app uses TWO caching layers that must BOTH be invalidated on every mutation:
 *
 * 1. **Next.js tag-based cache** (`revalidateTag`) — invalidates ISR / RSC cached data
 *    within the current deployment. Tags are scoped to the Next.js data cache and
 *    are cheap to call (no network round-trip).
 *
 * 2. **KV cache** (Vercel KV / Redis via `invalidate.*`) — invalidates cross-request
 *    cached data that persists across deployments and server instances.
 *
 * Missing either layer causes stale data:
 * - Skip Next.js tags → SSR pages serve stale data until KV TTL expires
 * - Skip KV invalidation → API routes / server actions serve stale KV data
 *
 * Always use these helpers instead of calling `revalidateTag` or `invalidate.*`
 * directly in server actions.
 */

import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { invalidate } from "./invalidate"
import { CacheKeys } from "./keys"

export const invalidateCache = {
  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  /**
   * Invalidate all project-related caches.
   * Call after creating, updating, or deleting a project.
   */
  async project(opts: { projectId: string; orgId: string }) {
    revalidateTag(CacheTags.project(opts.projectId))
    revalidateTag(CacheTags.projectDetails(opts.projectId))
    revalidateTag(CacheTags.projects(opts.orgId))
    await invalidate.project(opts.projectId, opts.orgId)
  },

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  /**
   * Invalidate task-related caches.
   * Call after creating, updating, or deleting a task.
   *
   * @param taskId   - Specific task ID (omit for list-only changes like reorder)
   * @param projectId - The task's project
   * @param assigneeId - The task's assignee (null if unassigned)
   * @param orgId    - Organization ID for user-task KV keys
   */
  async task(opts: {
    taskId?: string
    projectId: string
    assigneeId?: string | null
    orgId: string
  }) {
    if (opts.taskId) {
      revalidateTag(CacheTags.task(opts.taskId))
    }
    revalidateTag(CacheTags.tasks(opts.projectId))
    await invalidate.task(opts.projectId, opts.assigneeId ?? null, opts.orgId)
  },

  /**
   * Invalidate task timeline caches (comments + activities).
   *
   * No KV cache exists for timeline data — this is Next.js tags only.
   * Still exposed as a unified helper for consistency and discoverability.
   */
  taskTimeline(opts: { taskId: string }) {
    revalidateTag(CacheTags.taskTimeline(opts.taskId))
    revalidateTag(CacheTags.taskComments(opts.taskId))
    revalidateTag(CacheTags.taskActivities(opts.taskId))
  },

  // ---------------------------------------------------------------------------
  // Clients
  // ---------------------------------------------------------------------------

  /**
   * Invalidate client-related caches.
   * Call after creating, updating, or deleting a client.
   */
  async client(opts: { clientId?: string; orgId: string }) {
    if (opts.clientId) {
      revalidateTag(CacheTags.client(opts.clientId))
    }
    revalidateTag(CacheTags.clients(opts.orgId))
    await invalidate.client(opts.orgId)
  },

  // ---------------------------------------------------------------------------
  // Inbox
  // ---------------------------------------------------------------------------

  /**
   * Invalidate inbox caches.
   * Call after creating, reading, or deleting inbox items.
   */
  async inbox(opts: { userId: string }) {
    revalidateTag(CacheTags.inbox(opts.userId))
    await invalidate.inbox(opts.userId)
  },

  // ---------------------------------------------------------------------------
  // Organizations
  // ---------------------------------------------------------------------------

  /**
   * Invalidate organization detail caches.
   * Call after updating or deleting an organization.
   *
   * Note: No dedicated KV cache key for org details — only Next.js tags.
   */
  organization(opts: { orgId: string }) {
    revalidateTag(CacheTags.organization(opts.orgId))
  },

  /**
   * Invalidate organization member caches.
   * Call after adding, removing, or updating org members, or creating/deleting an org.
   *
   * When `userId` is provided, also invalidates the user's org list and membership
   * cache in KV. Without `userId`, only the org-scoped member list is cleared.
   */
  async orgMembers(opts: { orgId: string; userId?: string }) {
    revalidateTag(CacheTags.organizationMembers(opts.orgId))
    if (opts.userId) {
      revalidateTag(CacheTags.organizations(opts.userId))
      await invalidate.userOrgMembership(opts.userId, opts.orgId)
    } else {
      await invalidate.keys([CacheKeys.orgMembers(opts.orgId)])
    }
  },

  // ---------------------------------------------------------------------------
  // Tags, Labels, Teams
  // ---------------------------------------------------------------------------

  /**
   * Invalidate organization tag caches.
   */
  async tags(opts: { orgId: string }) {
    revalidateTag(CacheTags.tags(opts.orgId))
    await invalidate.tags(opts.orgId)
  },

  /**
   * Invalidate organization label caches.
   */
  async labels(opts: { orgId: string }) {
    revalidateTag(CacheTags.labels(opts.orgId))
    await invalidate.labels(opts.orgId)
  },

  /**
   * Invalidate team caches.
   */
  async teams(opts: { orgId: string }) {
    revalidateTag(CacheTags.teams(opts.orgId))
    await invalidate.team(opts.orgId)
  },

  // ---------------------------------------------------------------------------
  // Workstreams
  // ---------------------------------------------------------------------------

  /**
   * Invalidate workstream caches.
   */
  async workstreams(opts: { projectId: string }) {
    revalidateTag(CacheTags.workstreams(opts.projectId))
    await invalidate.workstream(opts.projectId)
  },

  // ---------------------------------------------------------------------------
  // Project membership
  // ---------------------------------------------------------------------------

  /**
   * Invalidate project membership caches.
   * Call after adding, removing, or updating project members.
   */
  async projectMembership(opts: { projectId: string; userId: string }) {
    revalidateTag(CacheTags.project(opts.projectId))
    revalidateTag(CacheTags.projectMembers(opts.projectId))
    await invalidate.projectMembership(opts.projectId, opts.userId)
  },

  // ---------------------------------------------------------------------------
  // Profile / Avatar
  // ---------------------------------------------------------------------------

  /**
   * Invalidate profile caches across all orgs.
   * Call after updating avatar, name, or other profile fields.
   */
  async profile(opts: { userId: string; orgIds: string[] }) {
    for (const orgId of opts.orgIds) {
      revalidateTag(CacheTags.organizationMembers(orgId))
    }
    revalidateTag(CacheTags.myTasks(opts.userId))
    await invalidate.profile(opts.userId, opts.orgIds)
  },
}
