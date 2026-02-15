# Service Communication Performance Analysis

**Application:** PMS (Project Management SaaS)
**Architecture:** Next.js 16 App Router monolith on Vercel + Supabase (PostgreSQL, Auth, Realtime, Storage) + Vercel KV (Redis)
**Date:** 2026-02-14

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Next.js to Supabase Communication](#2-nextjs-to-supabase-communication)
3. [Next.js to Vercel KV Communication](#3-nextjs-to-vercel-kv-communication)
4. [Realtime Subscription Patterns](#4-realtime-subscription-patterns)
5. [Vercel Edge/Serverless Function Overhead](#5-vercel-edgeserverless-function-overhead)
6. [External API Calls](#6-external-api-calls)
7. [Summary of Findings](#7-summary-of-findings)
8. [Optimization Recommendations](#8-optimization-recommendations)

---

## 1. Architecture Overview

The PMS application communicates with four external services from Vercel's serverless infrastructure:

```
Browser
  |
  |-- HTTPS --> Vercel Edge (middleware.ts)
  |                  |
  |                  |-- REST/HTTP --> Supabase PostgREST (PostgreSQL queries)
  |                  |-- REST/HTTP --> Supabase Auth (session validation)
  |                  |-- REST/HTTP --> Vercel KV (Redis, session cache)
  |
  |-- HTTPS --> Vercel Serverless (Server Components, Server Actions)
  |                  |
  |                  |-- REST/HTTP --> Supabase PostgREST (data queries)
  |                  |-- REST/HTTP --> Supabase Auth (getSession / getUser)
  |                  |-- REST/HTTP --> Vercel KV (data cache)
  |                  |-- REST/HTTP --> AI Providers (OpenAI, Anthropic, etc.)
  |
  |-- WebSocket --> Supabase Realtime (postgres_changes)
```

**Key latency characteristics (Vercel to Supabase, same region):**
- Supabase PostgREST query: ~15-80ms (simple), ~50-200ms (complex joins)
- Supabase Auth `getSession()`: ~0ms (local cookie read)
- Supabase Auth `getUser()`: ~300-500ms (network validation call)
- Vercel KV `GET`: ~1-5ms (same-region Redis)
- Vercel KV `SET`: ~1-5ms
- AI Provider API: ~500ms-30s (highly variable)

---

## 2. Next.js to Supabase Communication

### 2.1 Supabase Round Trips Per Page Load

Every page load through the dashboard layout triggers a **shared layout data fetch** before page-specific queries. The layout and page share a single Supabase client and auth check via React `cache()` deduplication in `lib/request-cache.ts`.

#### Layout Data (every dashboard page, `app/(dashboard)/layout.tsx`)

| Query | Supabase Calls | Cached Via | Notes |
|-------|---------------|------------|-------|
| `cachedGetUser()` -> `getSession()` | 0 network | React `cache()` | Local cookie read; middleware already refreshed token |
| `getOrganizations()` | 0-1 | KV (10min TTL) | KV hit = 0 Supabase calls; miss = 1 call with nested join: `organization_members` -> `organizations` |
| `getUserProfile()` | 0-1 | KV (10min TTL) | Single row `profiles` lookup |
| `getCachedColorTheme()` | 0-1 | KV (10min TTL) | Single row `user_settings` lookup |
| `getActiveProjects()` | 0-1 | KV (5min TTL) | Sidebar projects query with `.limit(7)` |

**Layout total:** 0 Supabase calls (KV warm) to 4 calls (KV cold). The layout starts `orgs`, `profile`, and `colorTheme` in parallel; `activeProjects` starts after org resolution but does NOT block layout render (streamed via Suspense).

#### Per-Page Analysis

**Projects List (`/projects`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Reuses layout's `cachedGetUser()` + KV org cache |
| `getCachedProjects(orgId)` | 1 | `projects` with nested `clients`, `teams`, `project_members` -> `profiles` |
| `getCachedClients(orgId)` | 1 | Simple `clients` table query |

**Page total: 2 Supabase calls** (parallel). Combined with layout: **2-6 calls**.

---

**Project Detail (`/projects/[id]`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Cached |
| `getCachedProjectWithDetails(id)` | **8** | 1 base project query (with `clients`, `teams`, `project_members` -> `profiles`) + 7 parallel queries (`project_scope`, `project_outcomes`, `project_features`, `project_deliverables`, `project_metrics`, `project_notes` -> `profiles`, `project_files`) |
| `getCachedTasks(id)` | 1 | Tasks with `assignee:profiles`, `workstream:workstreams` |
| `getCachedWorkstreamsWithTasks(id)` | 1 | Workstreams with nested tasks |
| `getCachedClients(orgId)` | 1 | Org clients |
| `getCachedOrganizationMembers(orgId)` | 1 | Org members with profiles |
| `getCachedTags(orgId)` | 1 | Org tags |
| `getProjectReports(id)` | 1 | Project reports |

**Page total: 14 Supabase calls** (most parallel). Combined with layout: **14-18 calls**.

This is the **heaviest page**. The `getProjectWithDetails()` function in `lib/actions/projects/queries.ts` issues 8 queries (1 base + 7 parallel related-data queries). Each query is a separate PostgREST HTTP request.

---

**My Tasks (`/tasks`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Cached |
| `getCachedMyTasks(orgId)` | 1 | Tasks with `assignee:profiles`, `workstream:workstreams`, `project:projects` join |
| `getCachedProjects(orgId)` | 1 | Projects list |
| `getCachedOrganizationMembers(orgId)` | 1 | Org members |
| `getCachedTags(orgId)` | 1 | Org tags |

**Page total: 4 Supabase calls** (parallel). Combined with layout: **4-8 calls**.

---

**Inbox (`/inbox`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Cached |
| `getCachedInboxItems()` | 1 | Inbox items |
| `getCachedUnreadCount()` | 1 | Count query |

**Page total: 2 Supabase calls** (parallel). Combined with layout: **2-6 calls**.

---

**Clients (`/clients`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Cached |
| `getCachedClientsWithProjectCounts(orgId)` | 1 | Clients with project counts |

**Page total: 1 Supabase call**. Combined with layout: **1-5 calls**.

---

**Chat (`/chat`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Cached |
| `getConversations(orgId)` | 1 | Conversations list |
| `getCachedAIConfigured()` | 1 | User settings check |

**Page total: 2 Supabase calls** (parallel). Combined with layout: **2-6 calls**.

---

**Performance (`/performance`):**
| Query | Supabase Calls | Notes |
|-------|---------------|-------|
| `getPageOrganization()` | 0 | Cached |
| `getCachedPerformanceMetrics(orgId)` | 0-1 | KV cached (2min); on miss calls `get_dashboard_stats` RPC (1 Supabase call) or falls back to 3+ parallel count queries |

**Page total: 0-1 Supabase calls** (KV cached). Combined with layout: **0-5 calls**.

---

### 2.2 PostgREST Overhead for Nested Joins

Supabase PostgREST translates nested `.select()` syntax into PostgreSQL joins. The overhead comes from:

1. **Multiple embedded resources in one query.** For example, `getProjectWithDetails()` fetches:
   ```
   projects -> clients(id, name), teams(id, name), project_members -> profiles(id, full_name, email, avatar_url)
   ```
   This translates to a multi-table JOIN. PostgREST handles this reasonably well for single-row lookups (`.single()`), but for list queries returning many rows, each row's embedded relations are fetched per-row, which can create N+1-like behavior at the PostgREST level.

2. **Separate queries for project sub-entities.** The project detail page issues 7 separate HTTP requests for `project_scope`, `project_outcomes`, `project_features`, `project_deliverables`, `project_metrics`, `project_notes`, and `project_files`. Each is a simple table scan filtered by `project_id`, but the HTTP overhead of 7 separate round trips is significant (~15-30ms per request = 105-210ms even in parallel, bounded by concurrency limits).

3. **Task queries with joins.** `getTasks()` uses:
   ```
   tasks -> assignee:profiles(id, full_name, email, avatar_url), workstream:workstreams(id, name)
   ```
   For projects with 100+ tasks, each row includes embedded profile and workstream data. PostgREST generates a LEFT JOIN, which is efficient, but the response payload grows linearly.

### 2.3 Batch/Consolidation Opportunities

**Finding 1: `getProjectWithDetails()` is the prime consolidation candidate.**

The function at `lib/actions/projects/queries.ts:43-120` makes 8 sequential HTTP requests to Supabase (1 base + 7 parallel). These 7 sub-entity tables (`project_scope`, `project_outcomes`, `project_features`, `project_deliverables`, `project_metrics`, `project_notes`, `project_files`) could be consolidated into a single PostgreSQL function (RPC) that returns all data in one round trip.

This pattern already exists for the dashboard page, where `get_dashboard_stats` RPC consolidates what would otherwise be 7+ count queries into a single call. Applying the same pattern to project details would reduce 8 HTTP round trips to 1.

**Estimated savings:** 7 eliminated HTTP round trips x ~20ms each = ~140ms reduction on project detail page cold loads.

**Finding 2: `getCachedTaskStats()` already demonstrates consolidation done right.**

In `lib/server-cache.ts:316-349`, the task stats function issues 4 parallel count queries against the `tasks` table with different filters. These 4 queries share the same base table and could theoretically be a single RPC, but they are already behind a KV cache (`CacheTTL.DASHBOARD_STATS = 30s`), and the `getCachedDashboardStats()` function uses an RPC (`get_dashboard_stats`) that consolidates them. This is the correct pattern.

**Finding 3: Auth helper queries are well-cached via KV.**

`requireOrgMember()` and `requireProjectMember()` in `lib/actions/auth-helpers.ts` both use `cacheGet()` with `CacheTTL.MEMBERSHIP` (5 minutes). This means authorization checks rarely hit Supabase directly. However, each server action that calls these helpers generates a KV read (~1-5ms), which is acceptable.

---

## 3. Next.js to Vercel KV Communication

### 3.1 KV Latency Characteristics

The caching layer at `lib/cache/` implements a cache-aside pattern with two backends:

- **Production (Vercel KV):** Same-region Redis, ~1-5ms per operation. All cache operations are HTTP-based (Vercel KV uses Upstash under the hood with REST API).
- **Local development (memCache):** In-process `Map<string, CacheEntry>` with LRU eviction. ~0ms latency.

The `cacheGet()` function in `lib/cache/utils.ts` follows this flow:
```
1. Try cache.get(key)           -- ~1-5ms (KV) or ~0ms (memCache)
2. If hit: return cached value
3. If miss: call fetcher()      -- ~15-200ms (Supabase query)
4. Fire-and-forget cache.set()  -- Non-blocking write
5. Return fresh data
```

**Key observation:** Cache writes are non-blocking (line 33 in `utils.ts`: `cache.set(key, fresh, { ex: ttlSeconds }).catch(...)`). This means the user never waits for the KV write to complete.

### 3.2 KV Read Volume Per Request

A typical authenticated page request generates these KV reads:

| Operation | KV Reads | Source |
|-----------|---------|--------|
| Middleware session check | 1 | `tryKVSessionCheck()` in `middleware.ts` |
| Layout: user orgs | 1 | `getOrganizations()` -> `cacheGet(CacheKeys.userOrgs(...))` |
| Layout: user profile | 1 | `getUserProfile()` -> `cacheGet(CacheKeys.user(...))` |
| Layout: color theme | 1 | `getCachedColorTheme()` -> `cacheGet(CacheKeys.colorTheme(...))` |
| Layout: sidebar projects | 1 | `getActiveProjects()` -> `cacheGet(CacheKeys.sidebar(...))` |
| Page auth: org from KV | 1 | `getCachedActiveOrgFromKV()` -> `cacheGet(CacheKeys.userOrgs(...))` |

**Total per request: 5-6 KV reads** for layout alone. Each page adds more depending on its data needs. A project detail page might add 0 additional KV reads (the queries are not KV-cached individually, except for the auth helpers).

At ~1-5ms per KV read, this adds **5-30ms** of KV latency to every page load. These reads are sequential in some paths (middleware -> layout -> page) but parallelized where possible.

### 3.3 Cache Stampede Risk

The current `cacheGet()` implementation has a **cache stampede vulnerability**. When a KV entry expires (TTL hits zero), all concurrent requests will experience a cache miss simultaneously and all will call the `fetcher()` function, hitting Supabase in parallel.

**Risk assessment by TTL tier:**

| TTL Tier | Duration | Stampede Risk | Impact |
|----------|----------|--------------|--------|
| TASKS | 30s | **High** | Frequent expiry; task queries can be expensive |
| DASHBOARD_STATS | 30s | **High** | RPC call or 7+ count queries |
| SEARCH | 30s | **Medium** | Only if same search is repeated |
| WORKSTREAMS | 60s | **Medium** | Moderate frequency |
| PROJECTS | 120s | **Low** | Less frequent expiry |
| SIDEBAR | 300s | **Low** | Infrequent |
| USER/ORGS | 600s | **Very Low** | Rare expiry |

The `cacheGet()` function at `lib/cache/utils.ts:10-39` does not implement:
- **Stale-while-revalidate:** Serve stale data while refreshing in the background.
- **Mutex/lock:** Prevent multiple concurrent fetchers for the same key.
- **Probabilistic early revalidation:** Refresh before TTL expires.

For the 30-second TTL tiers under concurrent load, this means every 30 seconds there is a window where multiple serverless function invocations can simultaneously query Supabase for the same data.

### 3.4 In-Memory Fallback Behavior

The `memCache` in `lib/cache/client.ts` is a bounded LRU cache:

- **Max size:** `MAX_MEMORY_CACHE_SIZE` (from `lib/constants.ts`)
- **Eviction strategy:** LRU (least recently accessed entries evicted first)
- **Cleanup interval:** `MEMORY_CACHE_CLEANUP_INTERVAL_MS`
- **Warning threshold:** 80% of max size (`MEMORY_CACHE_WARN_THRESHOLD`)

**Important serverless caveat:** In Vercel's serverless environment, each function instance has its own `memCache`. When a function instance is recycled (cold start), the cache is empty. This means the in-memory fallback only helps within a single warm instance's lifetime. In practice, production should always have KV configured, and the memCache is only for local development where KV env vars are absent.

### 3.5 Cache Invalidation Overhead

The dual-layer invalidation in `lib/cache/invalidation.ts` means every mutation triggers:

1. `revalidateTag()` calls (Next.js data cache, in-process, ~0ms each)
2. KV `DEL` calls (network round trip, ~1-5ms each)

For example, `invalidateCache.project()` at `invalidation.ts:36-41`:
```typescript
revalidateTag(CacheTags.project(opts.projectId))      // ~0ms
revalidateTag(CacheTags.projectDetails(opts.projectId)) // ~0ms
revalidateTag(CacheTags.projects(opts.orgId))           // ~0ms
await invalidate.project(opts.projectId, opts.orgId)    // 1 KV DEL with 6 keys
```

The `invalidate.project()` call at `invalidate.ts:44-53` deletes 6 KV keys in a single `kv.del(...keys)` call. This is efficient -- a single HTTP request to Vercel KV deletes all 6 keys.

The `invalidateCache.profile()` function at `invalidation.ts:190-196` iterates over all `orgIds` and calls `revalidateTag` for each, then deletes multiple KV keys. For a user in 5 organizations, this is 5 `revalidateTag` calls + 1 `kv.del()` with `1 + (5 * 2)` = 11 keys. Still a single HTTP round trip for the KV portion.

---

## 4. Realtime Subscription Patterns

### 4.1 Pooled Subscription Architecture

The `RealtimeProvider` at `hooks/realtime-context.tsx` implements connection pooling:

- **Subscription deduplication:** Multiple components subscribing to the same `table:filter` combination share a single WebSocket channel. The provider maintains a `Map<SubscriptionKey, SubscriptionState>` where the key is `"table:filter"` or `"table:all"`.
- **Listener management:** Each subscription tracks listeners by ID. When the last listener unsubscribes, the channel is removed.
- **Single Supabase client per channel:** Each pooled subscription creates its own `createClient()`, but channels on the same client share the underlying WebSocket.

### 4.2 WebSocket Channels Per User Session

The number of active channels depends on which page the user is on and what components are mounted. Analysis of the realtime hooks:

**From `hooks/use-realtime.ts` (individual, non-pooled):**
- `useTasksRealtime`: tasks table, filter `project_id=eq.{id}` -- 1 channel per project view
- `useWorkstreamsRealtime`: workstreams table, filter `project_id=eq.{id}` -- 1 channel per project view
- `useProjectRealtime`: projects table, filter `id=eq.{id}` -- 1 channel per project detail
- `useProjectsRealtime`: projects table, filter `organization_id=eq.{id}` -- 1 channel per org
- `useClientsRealtime`: clients table, filter `organization_id=eq.{id}` -- 1 channel per org
- `useFilesRealtime`: project_files table, filter `project_id=eq.{id}` -- 1 channel per project
- `useNotesRealtime`: project_notes table, filter `project_id=eq.{id}` -- 1 channel per project
- `useOrganizationMembersRealtime`: organization_members, filter `organization_id=eq.{id}` -- 1 channel per org
- `useInboxRealtime`: inbox_items, filter `user_id=eq.{id}` -- 1 channel per user

**From `hooks/use-task-timeline-realtime.ts` (standalone, not pooled):**
- Single channel `task-timeline-{taskId}` with 4 listeners:
  - task_comments (filter: `task_id=eq.{id}`)
  - task_activities (filter: `task_id=eq.{id}`)
  - task_comment_reactions (no filter -- **receives all reactions globally**)
  - task_comment_reactions DELETE (no filter)

**From `hooks/realtime-context.tsx` (pooled):**
- `usePooledTasksRealtime`: tasks table, pooled
- `usePooledProjectsRealtime`: projects table, pooled
- `usePooledClientsRealtime`: clients table, pooled
- `usePooledWorkstreamsRealtime`: workstreams table, pooled

**Estimated channels per page:**

| Page | Non-Pooled Channels | Pooled Channels | Total |
|------|-------------------|----------------|-------|
| Inbox | 1 (inbox items) | 0 | 1 |
| Projects list | 0-1 (projects) | 1 (projects) | 1-2 |
| Project detail | 2-4 (tasks, workstreams, project, files/notes) | 1-2 (tasks, workstreams) | 3-6 |
| Project detail + task panel | Above + 1 (timeline with 4 listeners) | Above | 4-7 |
| My Tasks | 0-1 | 1 (tasks) | 1-2 |
| Clients | 0-1 (clients) | 1 (clients) | 1-2 |

**Critical observation: Dual subscription risk.** The codebase has BOTH pooled hooks (`usePooledTasksRealtime` from `realtime-context.tsx`) and non-pooled hooks (`useTasksRealtime` from `use-realtime.ts`) for the same entities. If a page uses both (e.g., one component uses the pooled version and another uses the non-pooled version), they will create **duplicate WebSocket channels** for the same data. The non-pooled hooks are unaware of the pooled provider.

### 4.3 Auto-Pause on Tab Hidden

Both subscription systems implement visibility-aware pausing:

**Pooled (`RealtimeProvider`):**
- Uses `useDocumentVisibility()` hook.
- When tab is hidden: calls `channel.unsubscribe()` on all channels. This sends an unsubscribe message over WebSocket but does NOT close the WebSocket connection.
- When tab is visible: calls `channel.subscribe()` on all channels to re-subscribe.
- `setIsConnected(false)` on hide, `setIsConnected(subscriptions.size > 0)` on visible.

**Non-pooled (`useRealtime`):**
- Also uses `useDocumentVisibility()`.
- Separate visibility effect that pauses/resumes without destroying the channel (avoids recreation overhead).
- `pauseWhenHidden` defaults to `true` but is configurable.
- Channel is created once in the main effect; visibility effect only calls `subscribe()`/`unsubscribe()`.

**Concern:** When the tab becomes visible again, there is a gap between re-subscribing and receiving events. Any database changes that occurred while the tab was hidden will be missed. The application does NOT perform a "catch-up" query after re-subscribing. For short-lived hidden tabs this is acceptable, but for tabs hidden for minutes, the displayed data will be stale until the next user-triggered refresh.

### 4.4 Task Timeline Realtime: Global Reaction Listener

The `useTaskTimelineRealtime` hook at `hooks/use-task-timeline-realtime.ts:113-149` subscribes to `task_comment_reactions` with **no filter**:

```typescript
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "task_comment_reactions",
}, ...)
.on("postgres_changes", {
  event: "DELETE",
  schema: "public",
  table: "task_comment_reactions",
}, ...)
```

This means every reaction INSERT/DELETE across the entire database is received by this client. The callbacks check `reaction.comment_id` to determine relevance, but the WebSocket still transmits every reaction event. For a busy application with many concurrent users, this creates unnecessary bandwidth consumption.

Additionally, each realtime event for comments and activities triggers a follow-up Supabase query (`fetchCommentWithRelations` or `fetchActivityWithRelations`) to hydrate the record with its relations. This means each realtime INSERT event generates 1 additional Supabase round trip from the client.

---

## 5. Vercel Edge/Serverless Function Overhead

### 5.1 Middleware Overhead (`middleware.ts`)

The middleware runs on every non-static request (matcher excludes `_next/static`, `_next/image`, favicons, images). Its performance path:

**Fast path (no auth cookie):**
```
Request -> Check cookies -> No auth cookie -> Redirect to /login (~0ms processing)
```

**Prefetch fast path:**
```
Request -> Has cookie + prefetch header -> Skip getUser(), return immediately (~0ms processing)
```

**KV session cache hit path:**
```
Request -> Has cookie -> getSession() (cookie read) -> KV check (1-5ms) -> Hit -> Return (~5-10ms)
```

**Full validation path (cold):**
```
Request -> Has cookie -> getSession() (~0ms) -> KV miss -> getUser() (300-500ms) -> Cache in KV -> Return
```

The middleware's `getUser()` call is the single most expensive operation in the request lifecycle. The KV session cache (`CacheTTL.SESSION = 300s`) effectively eliminates this for 5-minute windows. After initial validation, subsequent requests within 5 minutes skip the `getUser()` call entirely.

**Quantified middleware overhead:**
- Best case: ~0ms (no auth cookie, or prefetch)
- Typical case: ~5ms (KV session cache hit)
- Worst case: ~300-500ms (first request after session cache expires)

### 5.2 Cold Start Impact

Vercel serverless functions have cold starts of ~50-200ms for Node.js functions. Combined with the middleware overhead:

**Cold start + cold KV session scenario:**
```
Cold start (~100ms) + Middleware getUser() (~400ms) + Page data (~100ms) = ~600ms before first byte
```

**Warm function + warm KV session scenario:**
```
Warm function (~0ms) + Middleware KV check (~5ms) + Page data (~50ms) = ~55ms before first byte
```

The `warmUserCache()` function at `lib/cache/warm.ts` pre-populates KV after login with user profile, organizations, memberships, sidebar projects, and color theme. This means the very first page load after login benefits from warm KV cache, avoiding the worst-case waterfall.

### 5.3 Server Action Invocation Overhead

Server Actions in Next.js are invoked via POST requests to the same origin. The overhead per server action call includes:

1. HTTP request/response: ~5-20ms (Vercel's internal routing)
2. Function invocation: ~0ms (warm) to ~100ms (cold start)
3. Auth check via `cachedGetUser()`: ~0ms (request-level cached)
4. KV authorization check (e.g., `requireOrgMember`): ~1-5ms
5. Supabase query: ~15-200ms
6. Cache invalidation (mutations only): ~1-5ms

**Total per server action:** ~20-330ms

For "load more" pagination clicks, the flow is:
```
Click -> POST to server action -> requireAuth() (cached) -> Supabase query with cursor -> Return data
```
Estimated: ~30-80ms for warm function, ~130-280ms for cold start.

The cursor-based pagination in `lib/actions/tasks/queries.ts` uses compound cursors (`sort_order` + `id`), which is efficient at the database level (uses index scans, not offset).

---

## 6. External API Calls

### 6.1 AI Provider Communication

The AI chat system at `lib/actions/ai/chat.ts` follows this communication flow per message:

```
1. verifyAIConfig()
   a. getAISettings()           -> 1 Supabase query (user_settings)
   b. getDecryptedApiKey()      -> 1 Supabase query (user_settings) + AES decryption
2. cachedGetUser()              -> 0 (request cached)
3. checkRateLimit (daily)       -> 1 KV call (Upstash sliding window)
4. checkRateLimit (concurrent)  -> 1 KV call (Upstash sliding window)
5. AI provider API call         -> 1 HTTP call (500ms - 30s)
6. parseChatResponse()          -> 0 (CPU only)
```

**Total per AI message:** 2 Supabase queries + 2 KV calls + 1 AI API call

The AI provider calls at `lib/actions/ai/providers.ts` are **not streamed** -- they use standard `fetch()` and `await response.json()`. This means the entire response must be generated and received before the user sees anything. For large responses (~2000-8192 tokens), this can be 5-30 seconds of perceived latency.

The `verifyAIConfig()` function at `lib/actions/ai/config.ts:8-36` makes 2 sequential Supabase calls (`getAISettings()` then `getDecryptedApiKey()`). These could be parallelized since they are independent.

### 6.2 Rate Limiting Overhead

The rate limiter at `lib/rate-limit/limiter.ts` uses Upstash's `@upstash/ratelimit` with Vercel KV as the backing store.

**Per rate limit check:**
- KV available: 1 HTTP call to Vercel KV (~1-5ms). Uses sliding window algorithm.
- KV unavailable: In-memory counter (~0ms). Per-instance only in serverless.

**AI operations check 2 rate limiters sequentially:**
```typescript
const dailyLimit = await checkRateLimit(rateLimiters.ai, user.id)      // ~1-5ms
const concurrentLimit = await checkRateLimit(rateLimiters.aiConcurrent, user.id) // ~1-5ms
```

These two checks are sequential (not parallelized), adding ~2-10ms. They could be parallelized with `Promise.all()` since they are independent operations.

**Auth rate limiting** (`rateLimiters.auth` and `rateLimiters.authByEmail`) adds 1-2 KV calls per login attempt.

---

## 7. Summary of Findings

### Communication Volume by Page

| Page | Supabase Calls (cold) | KV Reads | WebSocket Channels |
|------|--------------------|----------|-------------------|
| Layout (shared) | 0-4 | 5-6 | 0 |
| /inbox | 2 | 0 | 1 |
| /projects | 2 | 0 | 1-2 |
| /projects/[id] | **14** | 0-2 | 3-7 |
| /tasks | 4 | 0 | 1-2 |
| /clients | 1 | 0 | 1-2 |
| /chat | 2 | 0 | 0 |
| /performance | 0-1 | 1 | 0 |

### Latency Budget Breakdown (typical warm request)

```
Middleware KV check:        ~5ms
Layout data (KV cached):   ~5ms (5 parallel KV reads)
Page data (Supabase):      ~50-200ms (depends on page)
RSC serialization:         ~10-20ms
Network to client:         ~20-50ms
Total:                     ~90-280ms
```

### Latency Budget Breakdown (cold start, KV cold)

```
Cold start:                ~100ms
Middleware getUser():      ~400ms
Layout data (Supabase):   ~150ms (4 parallel queries)
Page data (Supabase):     ~200ms
RSC serialization:        ~20ms
Network to client:        ~30ms
Total:                    ~900ms
```

---

## 8. Optimization Recommendations

### High Priority

**8.1 Consolidate `getProjectWithDetails()` into a single RPC.**

Current: 8 separate HTTP round trips (1 base + 7 parallel sub-entity queries).
Proposed: Single PostgreSQL function returning all project data as JSON.
Estimated savings: ~140ms on project detail page cold loads.
Location: `lib/actions/projects/queries.ts:43-120`

**8.2 Add filter to `task_comment_reactions` realtime subscription.**

Current: Subscribes to ALL reaction events globally (no filter).
Proposed: Filter by `comment_id` using a list of visible comment IDs, or subscribe at the task level using a database function / view that filters server-side.
Location: `hooks/use-task-timeline-realtime.ts:113-149`
Risk: High bandwidth waste in multi-user environments.

**8.3 Implement stale-while-revalidate for KV cache.**

Current: Cache miss blocks on fetcher. Multiple concurrent requests stampede.
Proposed: Return stale data immediately while refreshing in background. Use a soft TTL (serve stale) and hard TTL (force refresh).
Location: `lib/cache/utils.ts:10-39`

### Medium Priority

**8.4 Parallelize `verifyAIConfig()` internal calls.**

Current: `getAISettings()` and `getDecryptedApiKey()` are sequential.
Proposed: `Promise.all([getAISettings(), getDecryptedApiKey()])`.
Location: `lib/actions/ai/config.ts:8-36`
Savings: ~15-30ms per AI message.

**8.5 Parallelize AI rate limit checks.**

Current: Two sequential `checkRateLimit()` calls.
Proposed: `Promise.all([checkRateLimit(daily), checkRateLimit(concurrent)])`.
Location: `lib/actions/ai/chat.ts:35-43`
Savings: ~1-5ms per AI message.

**8.6 Add "catch-up" query after realtime re-subscribe.**

Current: When tab becomes visible, channels re-subscribe but miss events from hidden period.
Proposed: After re-subscribe, fetch latest data from server to reconcile any missed changes.
Location: `hooks/realtime-context.tsx:70-86` and `hooks/use-realtime.ts:80-89`

**8.7 Audit for duplicate pooled/non-pooled subscriptions.**

Current: Both `usePooledTasksRealtime` and `useTasksRealtime` exist for the same entities.
Risk: If both are used in the same page, duplicate channels are created.
Proposed: Audit component usage and standardize on pooled subscriptions.
Location: All components importing from `hooks/use-realtime.ts` vs `hooks/realtime-context.tsx`.

### Low Priority

**8.8 Consider streaming for AI responses.**

Current: AI providers return complete response via `fetch()` + `response.json()`.
Proposed: Use streaming (SSE or ReadableStream) for AI responses to show partial content as it generates.
Location: `lib/actions/ai/providers.ts`, `lib/actions/ai/chat-providers.ts`
Impact: Perceived latency reduction of 2-20 seconds for AI chat.

**8.9 Reduce layout KV reads with batched `MGET`.**

Current: 5-6 individual `kv.get()` calls for layout data.
Proposed: Use `kv.mget()` to batch all layout KV reads into a single HTTP call.
Location: `app/(dashboard)/layout.tsx`
Savings: ~4-20ms (eliminating 4-5 sequential KV round trips).

**8.10 Consider connection pooling for PostgREST.**

The Supabase JS client creates a new HTTP connection for each query. In Vercel serverless, there is no connection reuse across invocations. Supabase's managed PostgREST handles connection pooling on their side, but the HTTP overhead per request (~10-15ms of TLS handshake on cold connections) accumulates across 14 calls on the project detail page. HTTP/2 multiplexing or keep-alive connections within a single invocation could reduce this.

---

## File References

| File | Purpose |
|------|---------|
| `C:\Users\Fares\Downloads\PMS\middleware.ts` | Edge middleware with auth, KV session cache, CSP |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\layout.tsx` | Dashboard layout with parallel KV-cached data fetching |
| `C:\Users\Fares\Downloads\PMS\lib\request-cache.ts` | Request-level auth/client caching via React `cache()` |
| `C:\Users\Fares\Downloads\PMS\lib\server-cache.ts` | Request-level data caching, dashboard stats RPC |
| `C:\Users\Fares\Downloads\PMS\lib\page-auth.ts` | Standardized page auth + org resolution |
| `C:\Users\Fares\Downloads\PMS\lib\cache\client.ts` | KV client + in-memory LRU fallback |
| `C:\Users\Fares\Downloads\PMS\lib\cache\utils.ts` | `cacheGet()` cache-aside pattern |
| `C:\Users\Fares\Downloads\PMS\lib\cache\keys.ts` | Cache keys and TTL tiers |
| `C:\Users\Fares\Downloads\PMS\lib\cache\invalidation.ts` | Dual-layer cache invalidation helpers |
| `C:\Users\Fares\Downloads\PMS\lib\cache\invalidate.ts` | KV-specific key deletion helpers |
| `C:\Users\Fares\Downloads\PMS\lib\cache\warm.ts` | Post-login KV cache warming |
| `C:\Users\Fares\Downloads\PMS\lib\rate-limit\limiter.ts` | Rate limiting with KV + in-memory fallback |
| `C:\Users\Fares\Downloads\PMS\hooks\realtime-context.tsx` | Pooled realtime subscription provider |
| `C:\Users\Fares\Downloads\PMS\hooks\use-realtime.ts` | Individual realtime subscription hooks |
| `C:\Users\Fares\Downloads\PMS\hooks\use-task-timeline-realtime.ts` | Task timeline realtime (comments, activities, reactions) |
| `C:\Users\Fares\Downloads\PMS\hooks\use-document-visibility.ts` | Tab visibility detection |
| `C:\Users\Fares\Downloads\PMS\lib\actions\projects\queries.ts` | Project detail queries (8 round trips) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts` | Task queries with cursor pagination |
| `C:\Users\Fares\Downloads\PMS\lib\actions\auth-helpers.ts` | KV-cached authorization helpers |
| `C:\Users\Fares\Downloads\PMS\lib\actions\ai\config.ts` | AI config verification (sequential DB calls) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\ai\chat.ts` | AI chat with rate limiting |
| `C:\Users\Fares\Downloads\PMS\lib\actions\ai\providers.ts` | AI provider HTTP calls (non-streaming) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\ai\chat-providers.ts` | Multi-turn AI chat provider calls |
