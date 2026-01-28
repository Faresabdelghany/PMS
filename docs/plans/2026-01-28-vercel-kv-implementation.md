# Vercel KV Caching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Vercel KV caching to reduce page load times from ~300-500ms to ~50-100ms.

**Architecture:** Wrap existing Supabase queries with cache-aside pattern. Cache reads first, fallback to DB, write-through on mutations. Existing real-time subscriptions handle freshness.

**Tech Stack:** Vercel KV (@vercel/kv), @upstash/ratelimit, existing Next.js 16 + Supabase stack

---

## Progress Tracker

| Phase | Status | Completed Tasks |
|-------|--------|-----------------|
| 1. Foundation | DONE | 6/6 |
| 2. High-Impact | DONE | 4/4 |
| 3. Page-Specific | DONE | 3/3 |
| 4. Rate Limiting | DONE | 4/4 |
| 5. Testing | DONE | 2/2 |

**Status:** IMPLEMENTATION COMPLETE
**Total commits:** 15 commits across all phases

---

## Prerequisites

Before starting, ensure:
1. Vercel KV is enabled on the Vercel project dashboard
2. Environment variables are available (auto-injected by Vercel, need manual for local)

---

## Phase 1: Foundation - COMPLETED

### Task 1.1: Install Dependencies - DONE

**Files:**
- Modify: `package.json`

**Step 1: Install Vercel KV packages**

Run:
```bash
pnpm add @vercel/kv @upstash/ratelimit
```

Expected: Packages added to dependencies

**Step 2: Verify installation**

Run:
```bash
pnpm list @vercel/kv @upstash/ratelimit
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @vercel/kv and @upstash/ratelimit dependencies"
```

---

### Task 1.2: Create Cache Key Definitions - DONE

**Files:**
- Create: `lib/cache/keys.ts`

**Step 1: Create cache keys module**

```typescript
// lib/cache/keys.ts

/**
 * Cache key definitions for Vercel KV.
 * Pattern: pms:{entity}:{scope}:{id}
 */
export const CacheKeys = {
  // User-scoped (TTL: 10 min)
  user: (userId: string) => `pms:user:${userId}`,
  userOrgs: (userId: string) => `pms:user:orgs:${userId}`,

  // Org membership (TTL: 5 min)
  membership: (orgId: string, userId: string) =>
    `pms:membership:${orgId}:${userId}`,
  orgMembers: (orgId: string) => `pms:org:members:${orgId}`,

  // Sidebar (TTL: 5 min)
  sidebar: (orgId: string) => `pms:sidebar:${orgId}`,

  // Projects (TTL: 2 min)
  projects: (orgId: string) => `pms:projects:${orgId}`,
  project: (projectId: string) => `pms:project:${projectId}`,
  projectMembers: (projectId: string) => `pms:project:members:${projectId}`,

  // Clients (TTL: 2 min)
  clients: (orgId: string) => `pms:clients:${orgId}`,

  // Teams (TTL: 5 min)
  teams: (orgId: string) => `pms:teams:${orgId}`,

  // Tasks (TTL: 30 sec)
  userTasks: (userId: string, orgId: string) =>
    `pms:tasks:user:${userId}:${orgId}`,
  projectTasks: (projectId: string) => `pms:tasks:project:${projectId}`,

  // Workstreams (TTL: 1 min)
  workstreams: (projectId: string) => `pms:workstreams:${projectId}`,

  // Search (TTL: 30 sec)
  search: (orgId: string, queryHash: string) =>
    `pms:search:${orgId}:${queryHash}`,
} as const

/**
 * TTL values in seconds for each cache tier.
 */
export const CacheTTL = {
  // Tier 1: Stable data
  USER: 600, // 10 minutes
  ORGS: 600, // 10 minutes
  MEMBERSHIP: 300, // 5 minutes

  // Tier 2: Semi-stable data
  SIDEBAR: 300, // 5 minutes
  PROJECTS: 120, // 2 minutes
  CLIENTS: 120, // 2 minutes
  TEAMS: 300, // 5 minutes

  // Tier 3: Volatile data
  TASKS: 30, // 30 seconds
  WORKSTREAMS: 60, // 1 minute
  SEARCH: 30, // 30 seconds
} as const
```

**Step 2: Verify file compiles**

Run:
```bash
pnpm exec tsc --noEmit lib/cache/keys.ts 2>&1 || echo "Check for errors"
```

Expected: No output (clean compile) or only import warnings

**Step 3: Commit**

```bash
git add lib/cache/keys.ts
git commit -m "feat(cache): add cache key definitions and TTL constants"
```

---

### Task 1.3: Create Cache Client - DONE

**Files:**
- Create: `lib/cache/client.ts`

**Step 1: Create KV client wrapper**

```typescript
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
```

**Step 2: Commit**

```bash
git add lib/cache/client.ts
git commit -m "feat(cache): add Vercel KV client wrapper"
```

---

### Task 1.4: Create Cache Utilities - DONE

**Files:**
- Create: `lib/cache/utils.ts`

**Step 1: Create cache utility functions**

```typescript
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
```

**Step 2: Verify file compiles**

Run:
```bash
pnpm exec tsc --noEmit lib/cache/utils.ts 2>&1 || echo "Check for errors"
```

Expected: No errors (may have warnings about imports)

**Step 3: Commit**

```bash
git add lib/cache/utils.ts
git commit -m "feat(cache): add cacheGet and cacheInvalidateAndFetch utilities"
```

---

### Task 1.5: Create Cache Invalidation Helpers - DONE

**Files:**
- Create: `lib/cache/invalidate.ts`

**Step 1: Create invalidation module**

```typescript
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
```

**Step 2: Commit**

```bash
git add lib/cache/invalidate.ts
git commit -m "feat(cache): add cache invalidation helpers"
```

---

### Task 1.6: Create Cache Index Export - DONE

**Files:**
- Create: `lib/cache/index.ts`

**Step 1: Create barrel export**

```typescript
// lib/cache/index.ts
export { kv, isKVAvailable } from "./client"
export { CacheKeys, CacheTTL } from "./keys"
export { cacheGet, cacheInvalidateAndFetch, hashQuery } from "./utils"
export { invalidate } from "./invalidate"
```

**Step 2: Verify exports**

Run:
```bash
pnpm exec tsc --noEmit lib/cache/index.ts 2>&1 || echo "Check for errors"
```

Expected: No errors

**Step 3: Commit**

```bash
git add lib/cache/index.ts
git commit -m "feat(cache): add barrel export for cache module"
```

---

## Phase 2: High-Impact Caching - COMPLETED

### Task 2.1: Add Caching to Dashboard Layout Queries - DONE

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

**NOTE:** The existing `lib/cache.ts` was renamed to `lib/request-cache.ts` to avoid conflict with the new `lib/cache/` directory.

**Step 1: Read current layout implementation**

Read `app/(dashboard)/layout.tsx` to understand current query structure.

**Step 2: Add cache imports**

At the top of the file, add:

```typescript
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
```

**Step 3: Wrap getOrganizations with cache**

Find the `getOrganizations` function and wrap it:

```typescript
async function getOrganizations(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<OrganizationWithRole[]> {
  return cacheGet(
    CacheKeys.userOrgs(userId),
    async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`role, organization:organizations(*)`)
        .eq("user_id", userId)

      if (error) throw error
      return data as OrganizationWithRole[]
    },
    CacheTTL.ORGS
  )
}
```

**Step 4: Wrap getUserProfile with cache**

```typescript
async function getUserProfile(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<Profile | null> {
  return cacheGet(
    CacheKeys.user(userId),
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (error) return null
      return data
    },
    CacheTTL.USER
  )
}
```

**Step 5: Wrap getActiveProjects with cache**

```typescript
async function getActiveProjects(
  supabase: TypedSupabaseClient,
  organizationId: string
): Promise<Project[]> {
  return cacheGet(
    CacheKeys.sidebar(organizationId),
    async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(7)

      if (error) throw error
      return data ?? []
    },
    CacheTTL.SIDEBAR
  )
}
```

**Step 6: Test the build**

Run:
```bash
pnpm build 2>&1 | head -50
```

Expected: Build succeeds or shows unrelated errors

**Step 7: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "feat(cache): add KV caching to dashboard layout queries"
```

---

### Task 2.2: Add Caching to Auth Helpers - DONE

**Files:**
- Modify: `lib/actions/auth-helpers.ts`

**Step 1: Read current auth-helpers**

Read `lib/actions/auth-helpers.ts` to understand structure.

**Step 2: Add cache imports**

```typescript
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
```

**Step 3: Cache membership check in requireOrgMember**

Update `requireOrgMember` to cache the membership lookup:

```typescript
export async function requireOrgMember(
  orgId: string,
  requireAdmin = false
): Promise<OrgMemberContext> {
  const { user, supabase } = await requireAuth()

  const member = await cacheGet(
    CacheKeys.membership(orgId, user.id),
    async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .single()

      if (error || !data) return null
      return { role: data.role as "admin" | "member" }
    },
    CacheTTL.MEMBERSHIP
  )

  if (!member) {
    throw new Error("Not a member of this organization")
  }

  if (requireAdmin && member.role !== "admin") {
    throw new Error("Admin access required")
  }

  return { user, supabase, member }
}
```

**Step 4: Test build**

Run:
```bash
pnpm build 2>&1 | head -50
```

Expected: Build succeeds

**Step 5: Commit**

```bash
git add lib/actions/auth-helpers.ts
git commit -m "feat(cache): add KV caching to org membership checks"
```

---

### Task 2.3: Add Caching to Projects List - DONE

**Files:**
- Modify: `lib/actions/projects.ts`

**Step 1: Read current projects.ts**

Read `lib/actions/projects.ts` focusing on `getProjects` function.

**Step 2: Add cache imports**

```typescript
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
```

**Step 3: Wrap getProjects with cache**

Note: Only cache when no filters are applied (base list):

```typescript
export async function getProjects(
  orgId: string,
  filters?: ProjectFilters
): Promise<ActionResult<Project[]>> {
  try {
    const supabase = await createClient()

    // Only cache unfiltered queries
    const hasFilters = filters && Object.values(filters).some(v => v !== undefined)

    if (!hasFilters) {
      const projects = await cacheGet(
        CacheKeys.projects(orgId),
        async () => {
          const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("organization_id", orgId)
            .order("updated_at", { ascending: false })

          if (error) throw error
          return data ?? []
        },
        CacheTTL.PROJECTS
      )
      return { data: projects }
    }

    // Filtered query - don't cache
    let query = supabase
      .from("projects")
      .select("*")
      .eq("organization_id", orgId)

    // Apply filters...
    // (keep existing filter logic)

    const { data, error } = await query.order("updated_at", { ascending: false })
    if (error) return { error: error.message }
    return { data: data ?? [] }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to fetch projects" }
  }
}
```

**Step 4: Add invalidation to createProject**

Find the `after()` callback in `createProject` and add:

```typescript
after(async () => {
  revalidatePath("/projects")
  revalidateTag(CacheTags.projects(orgId))
  // Add KV invalidation
  await invalidate.project(project.id, orgId)
})
```

**Step 5: Add invalidation to updateProject**

```typescript
after(async () => {
  revalidatePath("/projects")
  revalidatePath(`/projects/${id}`)
  revalidateTag(CacheTags.projects(orgId))
  revalidateTag(CacheTags.project(id))
  // Add KV invalidation
  await invalidate.project(id, orgId)
})
```

**Step 6: Add invalidation to deleteProject**

```typescript
after(async () => {
  revalidatePath("/projects")
  revalidateTag(CacheTags.projects(orgId))
  // Add KV invalidation
  await invalidate.project(id, orgId)
})
```

**Step 7: Test build**

Run:
```bash
pnpm build 2>&1 | head -50
```

**Step 8: Commit**

```bash
git add lib/actions/projects.ts
git commit -m "feat(cache): add KV caching to projects list with invalidation"
```

---

### Task 2.4: Add Caching to Clients List - DONE

**Files:**
- Modify: `lib/actions/clients.ts`

**Step 1: Add cache imports**

```typescript
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
```

**Step 2: Wrap getClients with cache (unfiltered only)**

```typescript
export async function getClients(
  orgId: string,
  filters?: ClientFilters
): Promise<ActionResult<Client[]>> {
  try {
    const supabase = await createClient()

    const hasFilters = filters && Object.values(filters).some(v => v !== undefined)

    if (!hasFilters) {
      const clients = await cacheGet(
        CacheKeys.clients(orgId),
        async () => {
          const { data, error } = await supabase
            .from("clients")
            .select("*")
            .eq("organization_id", orgId)
            .order("name")

          if (error) throw error
          return data ?? []
        },
        CacheTTL.CLIENTS
      )
      return { data: clients }
    }

    // Filtered query - existing logic
    // ...
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to fetch clients" }
  }
}
```

**Step 3: Add invalidation to client mutations**

Add `await invalidate.client(orgId)` to `createClientAction`, `updateClient`, `deleteClient`.

**Step 4: Commit**

```bash
git add lib/actions/clients.ts
git commit -m "feat(cache): add KV caching to clients list with invalidation"
```

---

## Phase 3: Page-Specific Caching - COMPLETED

### Task 3.1: Add Caching to Tasks - DONE

**Files:**
- Modify: `lib/actions/tasks.ts`

**Step 1: Add cache imports**

```typescript
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"
```

**Step 2: Cache getMyTasks (short TTL)**

```typescript
export async function getMyTasks(
  orgId: string,
  filters?: TaskFilters
): Promise<ActionResult<Task[]>> {
  const { user, supabase } = await requireAuth()

  const hasFilters = filters && Object.values(filters).some(v => v !== undefined)

  if (!hasFilters) {
    const tasks = await cacheGet(
      CacheKeys.userTasks(user.id, orgId),
      async () => {
        const { data, error } = await supabase
          .from("tasks")
          .select("*, project:projects(*)")
          .eq("assignee_id", user.id)
          .eq("project.organization_id", orgId)
          .order("due_date", { ascending: true })

        if (error) throw error
        return data ?? []
      },
      CacheTTL.TASKS
    )
    return { data: tasks }
  }

  // Filtered - existing logic
  // ...
}
```

**Step 3: Add invalidation to task mutations**

In `createTask`, `updateTask`, `updateTaskStatus`, `deleteTask`:

```typescript
// Get orgId from project for invalidation
const { data: project } = await supabase
  .from("projects")
  .select("organization_id")
  .eq("id", projectId)
  .single()

after(async () => {
  // existing revalidation...
  await invalidate.task(projectId, assigneeId, project?.organization_id ?? "")
})
```

**Step 4: Commit**

```bash
git add lib/actions/tasks.ts
git commit -m "feat(cache): add KV caching to tasks with invalidation"
```

---

### Task 3.2: Add Caching to Workstreams - DONE

**Files:**
- Modify: `lib/actions/workstreams.ts`

**Step 1: Add cache imports and wrap getWorkstreams**

```typescript
import { cacheGet, CacheKeys, CacheTTL, invalidate } from "@/lib/cache"

export async function getWorkstreams(
  projectId: string
): Promise<ActionResult<Workstream[]>> {
  const supabase = await createClient()

  const workstreams = await cacheGet(
    CacheKeys.workstreams(projectId),
    async () => {
      const { data, error } = await supabase
        .from("workstreams")
        .select("*")
        .eq("project_id", projectId)
        .order("position")

      if (error) throw error
      return data ?? []
    },
    CacheTTL.WORKSTREAMS
  )

  return { data: workstreams }
}
```

**Step 2: Add invalidation to mutations**

Add `await invalidate.workstream(projectId)` to create/update/delete functions.

**Step 3: Commit**

```bash
git add lib/actions/workstreams.ts
git commit -m "feat(cache): add KV caching to workstreams with invalidation"
```

---

### Task 3.3: Add Caching to Search - DONE

**Files:**
- Modify: `lib/actions/search.ts`

**Step 1: Add cache imports**

```typescript
import { cacheGet, CacheKeys, CacheTTL, hashQuery } from "@/lib/cache"
```

**Step 2: Cache search results**

```typescript
export async function globalSearch(
  orgId: string,
  query: string
): Promise<ActionResult<SearchResults>> {
  if (!query || query.length < 2) {
    return { data: { projects: [], tasks: [], clients: [] } }
  }

  const queryHash = hashQuery(query.toLowerCase().trim())

  const results = await cacheGet(
    CacheKeys.search(orgId, queryHash),
    async () => {
      const supabase = await createClient()
      const searchTerm = `%${query}%`

      const [projectsResult, tasksResult, clientsResult] = await Promise.all([
        supabase.from("projects").select("*").eq("organization_id", orgId).ilike("name", searchTerm).limit(5),
        supabase.from("tasks").select("*, project:projects(*)").eq("project.organization_id", orgId).ilike("name", searchTerm).limit(5),
        supabase.from("clients").select("*").eq("organization_id", orgId).or(`name.ilike.${searchTerm},contact_email.ilike.${searchTerm}`).limit(5),
      ])

      return {
        projects: projectsResult.data ?? [],
        tasks: tasksResult.data ?? [],
        clients: clientsResult.data ?? [],
      }
    },
    CacheTTL.SEARCH
  )

  return { data: results }
}
```

**Step 3: Commit**

```bash
git add lib/actions/search.ts
git commit -m "feat(cache): add KV caching to global search"
```

---

## Phase 4: Rate Limiting - COMPLETED

### Task 4.1: Create Rate Limiter Module - DONE

**Files:**
- Create: `lib/rate-limit/limiter.ts`

**Step 1: Create rate limiter**

```typescript
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
 * Check rate limit for an identifier.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
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
```

**Step 2: Commit**

```bash
git add lib/rate-limit/limiter.ts
git commit -m "feat(rate-limit): add rate limiter module"
```

---

### Task 4.2: Add Rate Limiting to AI Actions - DONE

**Files:**
- Modify: `lib/actions/ai.ts`

**Step 1: Add rate limit imports**

```typescript
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"
```

**Step 2: Add rate limiting to generate functions**

At the start of AI generation functions (e.g., `generateProjectDescription`):

```typescript
export async function generateProjectDescription(
  input: string
): Promise<ActionResult<string>> {
  const { user } = await requireAuth()

  // Rate limit check
  const limit = await checkRateLimit(rateLimiters.ai, user.id)
  if (!limit.success) {
    return rateLimitError(limit.reset)
  }

  // Existing generation logic...
}
```

**Step 3: Commit**

```bash
git add lib/actions/ai.ts
git commit -m "feat(rate-limit): add rate limiting to AI actions"
```

---

### Task 4.3: Add Rate Limiting to Auth Actions - DONE

**Files:**
- Modify: `lib/actions/auth.ts`

**Step 1: Add rate limit imports**

```typescript
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"
import { headers } from "next/headers"
```

**Step 2: Add rate limiting to signIn**

```typescript
export async function signIn(
  email: string,
  password: string
): Promise<ActionResult<void>> {
  // Get client IP for rate limiting
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  const limit = await checkRateLimit(rateLimiters.auth, ip)
  if (!limit.success) {
    return rateLimitError(limit.reset)
  }

  // Existing auth logic...
}
```

**Step 3: Add rate limiting to signUp similarly**

**Step 4: Commit**

```bash
git add lib/actions/auth.ts
git commit -m "feat(rate-limit): add rate limiting to auth actions"
```

---

### Task 4.4: Create Rate Limit Index Export - DONE

**Files:**
- Create: `lib/rate-limit/index.ts`

**Step 1: Create barrel export**

```typescript
// lib/rate-limit/index.ts
export {
  rateLimiters,
  checkRateLimit,
  rateLimitError,
  type RateLimitResult,
} from "./limiter"
```

**Step 2: Commit**

```bash
git add lib/rate-limit/index.ts
git commit -m "feat(rate-limit): add barrel export"
```

---

## Phase 5: Testing & Verification - COMPLETED

### Task 5.1: Local Development Testing - DONE

**Step 1: Set up local env vars (optional)**

For local testing without Vercel KV, the code gracefully falls back to direct DB queries.
To test with KV locally, add to `.env.local`:

```bash
KV_REST_API_URL=<from-vercel-dashboard>
KV_REST_API_TOKEN=<from-vercel-dashboard>
```

**Step 2: Run dev server**

```bash
pnpm dev
```

**Step 3: Test dashboard load time**

Open browser DevTools Network tab, navigate to dashboard, verify faster loads.

**Step 4: Test cache invalidation**

Create a project, verify it appears in sidebar without full refresh.

---

### Task 5.2: Production Deployment - DONE

**Step 1: Verify Vercel KV is enabled**

Check Vercel dashboard → Storage → KV

**Step 2: Deploy to preview**

```bash
git push origin feature/vercel-kv-caching
```

**Step 3: Test on preview deployment**

Verify cache hits in Vercel KV dashboard metrics.

---

## Summary

| Phase | Tasks | Key Files |
|-------|-------|-----------|
| 1. Foundation | 6 tasks | `lib/cache/*.ts` |
| 2. High-Impact | 4 tasks | `layout.tsx`, `auth-helpers.ts`, `projects.ts`, `clients.ts` |
| 3. Page-Specific | 3 tasks | `tasks.ts`, `workstreams.ts`, `search.ts` |
| 4. Rate Limiting | 4 tasks | `lib/rate-limit/*.ts`, `ai.ts`, `auth.ts` |
| 5. Testing | 2 tasks | Manual verification |

**Total: 19 tasks**

---

## Rollback Plan

If issues occur:
1. Set `KV_REST_API_URL=""` in Vercel env vars to disable caching (falls back to DB)
2. Revert specific commits if needed
3. Cache module has graceful fallback built-in
