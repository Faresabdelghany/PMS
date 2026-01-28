# Vercel KV Caching & Rate Limiting Design

**Date:** 2026-01-28
**Status:** Approved
**Author:** Claude + Fares

## Overview

Add Vercel KV (Redis) caching to the PMS project to improve page load performance while maintaining real-time data freshness through existing Supabase real-time subscriptions.

### Problem Statement

Users experience slow page loads across all dashboard pages despite small data volume (<100 users, <10 projects). Root causes:
- Vercel serverless cold starts (~200-500ms)
- Database round-trip latency on every page load
- Authorization checks on every server action

### Solution

Hybrid cache + real-time architecture:
- **Cache** for fast initial page loads
- **Real-time subscriptions** for immediate updates
- **Aggressive invalidation** on mutations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel Edge/Serverless                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Cache Check    │───▶│  Vercel KV      │◀── TTL: 1-10 min    │
│  │  (Redis)        │    │  (Global Edge)  │                     │
│  └────────┬────────┘    └─────────────────┘                     │
│           │ miss                                                 │
│           ▼                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Supabase Query │───▶│  Cache Write    │                     │
│  └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Client (Browser)                            │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Initial Render │    │  Real-Time Sub  │◀── Supabase         │
│  │  (from cache)   │    │  (WebSocket)    │    Realtime         │
│  └─────────────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           └──────────────────────┘                               │
│                      │                                           │
│                      ▼                                           │
│           ┌─────────────────────┐                               │
│           │  Merged UI State    │◀── Cache for speed            │
│           │  (always fresh)     │    Real-time for freshness    │
│           └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Initial page load → Check Vercel KV cache first (<5ms at edge)
2. Cache miss → Query Supabase, write result to cache
3. Client renders → Shows cached data instantly
4. Real-time connects → Subscribes to changes via WebSocket
5. Data changes → Real-time updates UI immediately
6. Mutations → Invalidate cache keys, real-time broadcasts change

---

## Cache Strategy

### Cache Key Structure

```
pms:{entity}:{scope}:{id}
```

### Cache Keys Module

```typescript
// lib/cache/keys.ts
export const CacheKeys = {
  // User-scoped
  user: (userId: string) => `pms:user:${userId}`,
  userOrgs: (userId: string) => `pms:user:orgs:${userId}`,
  userTasks: (userId: string, orgId: string) => `pms:tasks:user:${userId}:${orgId}`,

  // Org-scoped
  membership: (orgId: string, userId: string) => `pms:membership:${orgId}:${userId}`,
  sidebar: (orgId: string) => `pms:sidebar:${orgId}`,
  projects: (orgId: string) => `pms:projects:${orgId}`,
  clients: (orgId: string) => `pms:clients:${orgId}`,
  orgMembers: (orgId: string) => `pms:org:members:${orgId}`,
  teams: (orgId: string) => `pms:teams:${orgId}`,

  // Project-scoped
  project: (projectId: string) => `pms:project:${projectId}`,
  projectMembers: (projectId: string) => `pms:project:members:${projectId}`,
  projectTasks: (projectId: string) => `pms:tasks:project:${projectId}`,
  workstreams: (projectId: string) => `pms:workstreams:${projectId}`,

  // Search (with query hash)
  search: (orgId: string, queryHash: string) => `pms:search:${orgId}:${queryHash}`,
}
```

### What to Cache

#### Tier 1: Cache Aggressively (Every Page Load)

| Data | Cache Key | TTL | Invalidate On |
|------|-----------|-----|---------------|
| User profile | `pms:user:{userId}` | 10 min | Profile update |
| User's orgs | `pms:user:orgs:{userId}` | 10 min | Join/leave org |
| Org membership role | `pms:membership:{orgId}:{userId}` | 5 min | Role change |
| Sidebar projects | `pms:sidebar:{orgId}` | 5 min | Project create/update/delete |

#### Tier 2: Cache for Page Performance

| Data | Cache Key | TTL | Invalidate On |
|------|-----------|-----|---------------|
| Project list | `pms:projects:{orgId}` | 2 min | Project mutations |
| Project details | `pms:project:{projectId}` | 2 min | Project update |
| Project members | `pms:project:members:{projectId}` | 2 min | Member changes |
| Org members | `pms:org:members:{orgId}` | 5 min | Member changes |
| Client list | `pms:clients:{orgId}` | 2 min | Client mutations |
| Teams list | `pms:teams:{orgId}` | 5 min | Team mutations |

#### Tier 3: Short-Lived Cache (Frequent Changes)

| Data | Cache Key | TTL | Invalidate On |
|------|-----------|-----|---------------|
| My Tasks | `pms:tasks:user:{userId}:{orgId}` | 30 sec | Task mutations |
| Project tasks | `pms:tasks:project:{projectId}` | 30 sec | Task mutations |
| Workstreams | `pms:workstreams:{projectId}` | 1 min | Workstream mutations |
| Search results | `pms:search:{orgId}:{hash}` | 30 sec | Any mutation |

### Do NOT Cache

| Data | Reason |
|------|--------|
| Inbox items | Real-time notifications must be instant |
| File download URLs | Signed URLs are time-sensitive |
| AI responses | Unique per request |
| Auth tokens/sessions | Security sensitive |

---

## Cache Invalidation

### Invalidation Matrix

| Mutation | Cache Keys to Invalidate |
|----------|-------------------------|
| **User** | |
| Update profile | `user:{userId}` |
| **Organization** | |
| Create org | `user:orgs:{userId}` |
| Update org | `user:orgs:{userId}` (all members) |
| Delete org | `user:orgs:{userId}` (all members), `projects:{orgId}`, `clients:{orgId}` |
| Add member | `org:members:{orgId}`, `user:orgs:{newUserId}` |
| Remove member | `org:members:{orgId}`, `user:orgs:{removedUserId}`, `membership:{orgId}:{userId}` |
| Change role | `membership:{orgId}:{userId}` |
| **Project** | |
| Create project | `projects:{orgId}`, `sidebar:{orgId}` |
| Update project | `project:{id}`, `projects:{orgId}`, `sidebar:{orgId}` |
| Delete project | `project:{id}`, `projects:{orgId}`, `sidebar:{orgId}`, `tasks:project:{id}`, `workstreams:{id}` |
| Add member | `project:members:{projectId}` |
| Remove member | `project:members:{projectId}` |
| **Task** | |
| Create task | `tasks:project:{projectId}`, `tasks:user:{assigneeId}:{orgId}` |
| Update task | `tasks:project:{projectId}`, `tasks:user:{assigneeId}:{orgId}` (old + new if reassigned) |
| Delete task | `tasks:project:{projectId}`, `tasks:user:{assigneeId}:{orgId}` |
| Bulk update | `tasks:project:{projectId}`, `tasks:user:{*}:{orgId}` (all affected users) |
| **Workstream** | |
| Create/Update/Delete | `workstreams:{projectId}` |
| **Client** | |
| Create/Update/Delete | `clients:{orgId}` |
| **Team** | |
| Create/Update/Delete | `teams:{orgId}` |

### Implementation

```typescript
// lib/cache/invalidate.ts
import { kv } from '@vercel/kv'
import { CacheKeys } from './keys'

export const invalidate = {
  async key(key: string) {
    await kv.del(key)
  },

  async keys(keys: string[]) {
    if (keys.length === 0) return
    await kv.del(...keys)
  },

  async pattern(pattern: string) {
    const keys = await kv.keys(pattern)
    if (keys.length > 0) {
      await kv.del(...keys)
    }
  },

  // Preset invalidation groups
  async project(projectId: string, orgId: string) {
    await this.keys([
      CacheKeys.project(projectId),
      CacheKeys.projects(orgId),
      CacheKeys.sidebar(orgId),
    ])
  },

  async task(projectId: string, assigneeId: string | null, orgId: string) {
    const keys = [CacheKeys.projectTasks(projectId)]
    if (assigneeId) {
      keys.push(CacheKeys.userTasks(assigneeId, orgId))
    }
    await this.keys(keys)
  },

  async userOrgMembership(userId: string, orgId: string) {
    await this.keys([
      CacheKeys.userOrgs(userId),
      CacheKeys.membership(orgId, userId),
      CacheKeys.orgMembers(orgId),
    ])
  },
}
```

---

## Cache Utilities

```typescript
// lib/cache/utils.ts
import { kv } from '@vercel/kv'

export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try cache first
  const cached = await kv.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Cache miss - fetch fresh data
  const fresh = await fetcher()

  // Write to cache (non-blocking)
  kv.set(key, fresh, { ex: ttlSeconds }).catch(console.error)

  return fresh
}

export async function cacheInvalidateAndFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  await kv.del(key)
  const fresh = await fetcher()
  await kv.set(key, fresh, { ex: ttlSeconds })
  return fresh
}
```

---

## Rate Limiting

### Configuration

```typescript
// lib/rate-limit/config.ts
export const RateLimits = {
  // CRITICAL - Security
  auth: {
    signIn: { limit: 5, window: '15m', key: 'ip' },
    signUp: { limit: 3, window: '1h', key: 'ip' },
    resetPassword: { limit: 3, window: '1h', key: 'email' },
  },

  // COST CONTROL - AI Operations
  ai: {
    generate: { limit: 50, window: '24h', key: 'user' },
    concurrent: { limit: 3, window: '1m', key: 'user' },
  },

  // COST CONTROL - File Operations
  files: {
    upload: { limit: 50, window: '1h', key: 'user' },
  },

  // PROTECTIVE - Prevent Accidents
  destructive: {
    delete: { limit: 20, window: '1h', key: 'user' },
  },

  // PROTECTIVE - Email Spam Prevention
  email: {
    invite: { limit: 20, window: '1h', key: 'org' },
  },
}
```

### Implementation

```typescript
// lib/rate-limit/limiter.ts
import { kv } from '@vercel/kv'
import { Ratelimit } from '@upstash/ratelimit'

export const rateLimiters = {
  auth: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(5, '15m'),
    prefix: 'rl:auth',
  }),

  ai: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(50, '24h'),
    prefix: 'rl:ai',
  }),

  aiConcurrent: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(3, '1m'),
    prefix: 'rl:ai:concurrent',
  }),
}

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation
- [ ] Set up Vercel KV project and environment variables
- [ ] Create `lib/cache/keys.ts` - cache key definitions
- [ ] Create `lib/cache/utils.ts` - cacheGet, cacheInvalidateAndFetch
- [ ] Create `lib/cache/invalidate.ts` - invalidation helpers

### Phase 2: High-Impact Caching
- [ ] Cache dashboard layout queries (profile, orgs, sidebar)
- [ ] Cache auth membership checks in `auth-helpers.ts`
- [ ] Cache project list in `projects.ts`
- [ ] Add invalidation to all project mutations

### Phase 3: Page-Specific Caching
- [ ] Cache project details
- [ ] Cache client list
- [ ] Cache My Tasks (short TTL)
- [ ] Cache workstreams
- [ ] Add invalidation to all relevant mutations

### Phase 4: Rate Limiting
- [ ] Install `@upstash/ratelimit` package
- [ ] Create `lib/rate-limit/limiter.ts`
- [ ] Add rate limiting to AI endpoints
- [ ] Add rate limiting to auth endpoints

---

## Expected Impact

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| Dashboard layout load | ~300-500ms | ~50-100ms |
| Page navigation | ~200-400ms | ~50-150ms |
| Server action auth checks | ~50-100ms each | ~5-10ms (cached) |
| Overall perceived speed | Sluggish | Snappy |

---

## Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| Vercel KV costs | LOW | Free tier: 30K requests/day, 256MB storage |
| Cache stampede | LOW | <100 users, can add mutex later |
| Stale data | NONE | Real-time subscriptions override cache |
| Complexity | MEDIUM | Clean abstraction minimizes maintenance |

---

## Dependencies

- `@vercel/kv` - Vercel KV client
- `@upstash/ratelimit` - Rate limiting library (uses same KV)

---

## Environment Variables

```bash
# Add to .env.local and Vercel project settings
KV_URL=<from-vercel-dashboard>
KV_REST_API_URL=<from-vercel-dashboard>
KV_REST_API_TOKEN=<from-vercel-dashboard>
KV_REST_API_READ_ONLY_TOKEN=<from-vercel-dashboard>
```
