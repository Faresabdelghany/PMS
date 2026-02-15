# Cursor-Based Pagination Performance Audit

**Date:** 2026-02-14
**Application:** PMS (Next.js 16 + Supabase)
**Scope:** All paginated server actions, caching layer, frontend load-more components, and page entry points

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Server Action Analysis](#3-server-action-analysis)
4. [Database Index Coverage](#4-database-index-coverage)
5. [Caching Layer Analysis](#5-caching-layer-analysis)
6. [Frontend Component Analysis](#6-frontend-component-analysis)
7. [Page Entry Point Analysis](#7-page-entry-point-analysis)
8. [Remaining Unbounded Queries](#8-remaining-unbounded-queries)
9. [Memory Usage Patterns](#9-memory-usage-patterns)
10. [Bundle Size Impact](#10-bundle-size-impact)
11. [Risk Matrix](#11-risk-matrix)
12. [Recommendations](#12-recommendations)

---

## 1. Executive Summary

The cursor-based pagination implementation is architecturally sound. The compound cursor pattern `(ordering_column, id)` guarantees deterministic ordering even with tied values, and the `limit + 1` fetch pattern efficiently determines `hasMore` without a separate COUNT query. However, the audit identified several performance concerns:

**Critical findings:**

- **P0**: `getTaskStats()` and `getClientStats()` still perform unbounded full-table scans -- they fetch ALL rows to count statuses client-side instead of using `COUNT` with `GROUP BY`
- **P0**: `getClientsWithProjectCounts()` fetches all project rows for the current page's clients (`select("client_id, status")` with `.in("client_id", clientIds)`) without a LIMIT -- unbounded if a client has thousands of projects
- **P1**: `getTasks()` without a cursor returns ALL tasks for a project (board/drag-drop mode) -- this is an intentional design decision but represents a scaling risk
- **P1**: Missing composite indexes on the exact cursor column pairs used in pagination queries
- **P2**: First-page KV cache stores `limit + 1` rows then slices on every cache hit -- the slice computation is trivial but the extra row is serialized/deserialized via KV unnecessarily

**Positive findings:**

- Dashboard stat cards (`getCachedProjectCount`, `getCachedClientCount`, `getCachedTaskStats`) already use lightweight `COUNT` queries with `head: true` -- well optimized
- `getCachedDashboardStats` consolidates all stats into a single RPC call with 30s KV TTL
- All paginated endpoints use compound cursors with correct tiebreaker (UUID id)
- `useLoadMore` hook is well-designed: ref-guarded against double-clicks, auto-resets on SSR data changes, supports manual reset
- Page entry points use `Promise.all` with Suspense streaming -- no sequential waterfalls

---

## 2. Architecture Overview

The pagination system spans four layers:

```
Page (SSR)                    Server Action              KV Cache           Supabase
  |                              |                         |                  |
  |-- getCachedProjects(orgId) --|-- cacheGet() ----------|-- KV.get ------->|
  |                              |                         |  (hit? return)   |
  |                              |-- getProjects(orgId) --|                   |
  |                              |   .limit(51)           |                   |-- SQL query
  |                              |   .order(updated_at)   |                   |
  |                              |<- 51 rows -------------|                   |
  |                              |-- slice to 50 ---------|                   |
  |                              |-- encodeCursor(last)   |                   |
  |<--- {data, nextCursor, hasMore}                       |                   |
  |                                                        |                   |
  |-- [User clicks Load More] ----------------------------|                   |
  |-- getProjects(orgId, _, cursor) ----------------------|                   |
  |   (bypasses cache)                                     |-- SQL query ----->|
  |<--- {data, nextCursor, hasMore}                       |                   |
```

**Key design decisions:**
- First page: KV-cached (2-minute TTL for projects/clients, 30s for tasks)
- Subsequent pages: Direct Supabase query (no cache)
- Filtered queries: Always direct Supabase (no cache)
- Cursor encoding: Base64url of JSON `[orderingValue, id]`

---

## 3. Server Action Analysis

### 3.1 `getTasks()` -- `lib/actions/tasks/queries.ts`

**Cursor columns:** `(sort_order, id)` ASC

**Query pattern (with cursor):**
```sql
SELECT *, assignee:profiles(...), workstream:workstreams(...)
FROM tasks
WHERE project_id = $1
  AND (sort_order > $cursor_sort OR (sort_order = $cursor_sort AND id > $cursor_id))
ORDER BY sort_order ASC, id ASC
LIMIT 51
```

**Performance characteristics:**
- **O(log n)** with proper composite index on `(project_id, sort_order, id)` -- **this index does not exist**
- Existing index `idx_tasks_project_status` is on `(project_id, status, created_at DESC)` -- not aligned with cursor columns
- The `OR` compound cursor condition prevents a simple range scan; Postgres must evaluate both branches
- Joins to `profiles` and `workstreams` are foreign-key lookups (1:1) -- O(1) per row via PK index
- **Without cursor:** Returns ALL tasks for the project -- unbounded, intentional for board/drag-drop views

**Concern:** The `sort_order` column has default value 0 for all rows, meaning many rows will tie on sort_order. The tiebreaker on `id` (UUID) handles correctness but the OR condition in the cursor filter is suboptimal without an exact composite index.

---

### 3.2 `getMyTasks()` -- `lib/actions/tasks/queries.ts`

**Cursor columns:** `(updated_at, id)` DESC

**Query pattern (with cursor):**
```sql
SELECT *, assignee:profiles(...), workstream:workstreams(...),
       project:projects!inner(id, name, organization_id)
FROM tasks
WHERE assignee_id = $user_id
  AND project.organization_id = $org_id
  AND (updated_at < $cursor_ts OR (updated_at = $cursor_ts AND id < $cursor_id))
ORDER BY updated_at DESC, id DESC
LIMIT 51
```

**Performance characteristics:**
- Uses `!inner` join on projects to filter by organization -- this forces a join condition into the WHERE clause
- Existing index `idx_tasks_assignee_status` on `(assignee_id, status, due_date)` -- partially useful (first column matches)
- Existing index `idx_tasks_assignee_project_status` on `(assignee_id, project_id, status)` -- better but still not aligned with ORDER BY columns
- **Missing index:** `(assignee_id, updated_at DESC, id DESC)` would be optimal
- First page (no cursor, no filters): KV-cached with 30s TTL via `CacheKeys.userTasks()`
- The inner join on `projects` means the planner must join before applying the cursor filter -- potential for suboptimal plans on large task tables

**Concern:** The `!inner` join creates a dependency on the projects table for every query. If the tasks table grows large, the absence of a compound index on `(assignee_id, updated_at DESC)` will force a sort step.

---

### 3.3 `getProjects()` -- `lib/actions/projects/crud.ts`

**Cursor columns:** `(updated_at, id)` DESC

**Query pattern (with cursor):**
```sql
SELECT *, client:clients(...), team:teams(...),
       members:project_members(id, role, user_id, profile:profiles(...))
FROM projects
WHERE organization_id = $org_id
  AND (updated_at < $cursor_ts OR (updated_at = $cursor_ts AND id < $cursor_id))
ORDER BY updated_at DESC, id DESC
LIMIT 51
```

**Performance characteristics:**
- Existing index `idx_projects_org_status` on `(organization_id, status, updated_at DESC)` -- partially aligned but `status` in middle disrupts range scan on `updated_at`
- **Missing index:** `(organization_id, updated_at DESC, id DESC)` would be optimal
- The `members:project_members(...)` is a nested join that returns ALL members per project -- for 50 projects with 5 members each, that is 250 profile lookups via PostgREST subquery
- The `profile:profiles(...)` nested inside `members` adds another level -- PostgREST generates a single joined query but the payload can be large
- First page (no cursor, no filters): KV-cached with 2-minute TTL

**Concern:** The SELECT includes `*` on the projects table, pulling all columns including `description`, `tags`, `metadata`, etc. For pagination lists, a projection of only needed columns would reduce I/O and network payload.

---

### 3.4 `getClients()` -- `lib/actions/clients.ts`

**Cursor columns:** `(name, id)` ASC

**Query pattern (with cursor):**
```sql
SELECT *, owner:profiles(id, full_name, email, avatar_url)
FROM clients
WHERE organization_id = $org_id
  AND (name > $cursor_name OR (name = $cursor_name AND id > $cursor_id))
ORDER BY name ASC, id ASC
LIMIT 51
```

**Performance characteristics:**
- Existing index `idx_clients_org_name` on `(organization_id, name)` -- well aligned for this cursor
- UUID id as tiebreaker works with PK index
- Owner profile is a single FK lookup per row -- efficient
- First page (no cursor, no filters): KV-cached with 2-minute TTL

**Assessment:** This is the best-indexed paginated endpoint. The existing composite index on `(organization_id, name)` directly supports the cursor condition and ORDER BY.

---

### 3.5 `getClientsWithProjectCounts()` -- `lib/actions/clients.ts`

**Two-phase query:**
1. Fetch paginated clients (same pattern as `getClients()`)
2. Fetch ALL projects for the current page's clients: `.select("client_id, status").in("client_id", clientIds)`

**Performance characteristics:**
- Phase 1: Same as `getClients()` -- well-indexed
- Phase 2: **Unbounded.** If a single client has 10,000 projects, all 10,000 rows are fetched and iterated in JavaScript
- The `.in("client_id", clientIds)` generates an `IN (...)` clause for up to 50 UUIDs -- this is efficient for the filter but returns all matching project rows
- No index on `projects(client_id)` exists -- only `projects(organization_id, status, updated_at DESC)` which does not help

**Concern:** This is the highest-risk query. A client with many projects will cause large response payloads and JavaScript processing overhead. The count-by-status aggregation should be done in SQL via `GROUP BY`.

---

### 3.6 `getInboxItems()` -- `lib/actions/inbox.ts`

**Cursor columns:** `(created_at, id)` DESC

**Query pattern (with cursor):**
```sql
SELECT *, actor:profiles!inbox_items_actor_id_fkey(...),
       project:projects(...), task:tasks(...), client:clients(...)
FROM inbox_items
WHERE user_id = $user_id
  AND (created_at < $cursor_ts OR (created_at = $cursor_ts AND id < $cursor_id))
ORDER BY created_at DESC, id DESC
LIMIT 51
```

**Performance characteristics:**
- Existing index `idx_inbox_items_user_created` on `(user_id, created_at DESC)` -- well aligned
- Duplicate index `idx_inbox_items_created_at` on `(user_id, created_at DESC)` -- redundant
- Four FK joins (actor, project, task, client) -- each is a single PK lookup, efficient
- Page size: 50 (INBOX_PAGE_SIZE constant)
- **No KV cache** on first page -- `getCachedInboxItems` only uses React `cache()` (request-level dedup)

**Assessment:** Well-indexed. The main cost is the four FK subqueries per row, which PostgREST handles as lateral joins. For 50 rows, that is up to 200 additional PK lookups, but these are all index-only scans on primary keys.

---

## 4. Database Index Coverage

### Index Alignment Matrix

| Endpoint | Cursor Columns | Existing Index | Aligned? | Missing Index |
|---|---|---|---|---|
| `getTasks(cursor)` | `(sort_order, id)` ASC | `idx_tasks_project_status (project_id, status, created_at DESC)` | No | `(project_id, sort_order, id)` |
| `getMyTasks(cursor)` | `(updated_at, id)` DESC | `idx_tasks_assignee_status (assignee_id, status, due_date)` | Partial (1st col) | `(assignee_id, updated_at DESC, id DESC)` |
| `getProjects(cursor)` | `(updated_at, id)` DESC | `idx_projects_org_status (organization_id, status, updated_at DESC)` | Partial (1st, 3rd col) | `(organization_id, updated_at DESC, id DESC)` |
| `getClients(cursor)` | `(name, id)` ASC | `idx_clients_org_name (organization_id, name)` | Yes | None needed |
| `getInboxItems(cursor)` | `(created_at, id)` DESC | `idx_inbox_items_user_created (user_id, created_at DESC)` | Yes | None needed |

### Impact Assessment

Without aligned composite indexes, Postgres must:
1. Use the partial index to filter the leading column(s)
2. Fetch all matching rows into a sort buffer
3. Sort by the cursor columns
4. Apply the LIMIT

With aligned indexes, Postgres can:
1. Seek directly to the cursor position in the B-tree
2. Scan forward/backward for `limit + 1` rows
3. No sort step needed (index already in correct order)

**Estimated improvement:** For tables with >1,000 rows per partition (project/org), adding aligned composite indexes can reduce query time from **O(n log n)** (filter + sort) to **O(log n + k)** (seek + scan) where k = page size.

---

## 5. Caching Layer Analysis

### 5.1 Two-Tier Cache Architecture

```
Request boundary                  Cross-request boundary
  React cache()                     Vercel KV / memCache
  (request-level dedup)             (TTL-based, 30s-10min)
```

**Flow for first-page loads:**

1. `getCachedProjects(orgId)` -- React `cache()` dedup within the request
2. Inside: calls `getProjects(orgId)` which calls `cacheGet(CacheKeys.projects(orgId), fetcher, 120)`
3. KV hit: Return cached data (~5ms latency to Vercel KV)
4. KV miss: Execute Supabase query, write to KV non-blocking, return data

### 5.2 Cache Hit/Miss Scenarios

| Scenario | Cache Layer Hit | Latency Profile |
|---|---|---|
| First page, no filters, KV warm | React cache + KV | ~5-15ms |
| First page, no filters, KV cold | React cache + Supabase | ~50-200ms |
| First page with filters | React cache only (no KV) | ~50-200ms |
| Subsequent pages (cursor) | No cache | ~50-200ms |
| Same page requested twice in one request | React cache | ~0ms (dedup) |

### 5.3 Cache Invalidation Correctness

After mutations, `invalidateCache.*` helpers invalidate both KV keys and Next.js revalidation tags. This is correct for the first page, but subsequent pages fetched via "Load More" are never cached and always hit Supabase directly.

**Concern:** When a mutation occurs while the user has loaded multiple pages:
- The first page is invalidated (KV + Next.js tags)
- Pages 2+ are stale in the client's React state -- only refreshed on full page reload or realtime events
- The `useLoadMore` hook does not have a mechanism to invalidate or refetch previously loaded pages

This is acceptable for most UX scenarios because realtime subscriptions handle live updates, but there is a window where stale data can appear in the loaded pages.

### 5.4 KV Cache Payload Concern

The first-page cache stores `limit + 1` rows (51 items) in KV. On every cache hit, the code:
1. Deserializes all 51 items from KV
2. Checks `items.length > limit`
3. Slices to 50 items
4. Encodes a cursor from the 50th item

This means every KV cache hit deserializes one extra row that is immediately discarded. For projects with nested `members` arrays, this extra row could be several KB. The serialization overhead is negligible in isolation but adds up across all cache reads.

### 5.5 TTL Strategy Assessment

| Entity | TTL | Appropriateness |
|---|---|---|
| Tasks | 30s | Appropriate -- tasks change frequently |
| Projects | 2min | Appropriate -- moderate change frequency |
| Clients | 2min | Could be 5min -- clients change infrequently |
| Inbox | No KV cache | **Gap** -- inbox first page has no KV caching, only request-level dedup |
| Dashboard stats | 30s | Appropriate for volatile aggregate data |

---

## 6. Frontend Component Analysis

### 6.1 `useLoadMore` Hook -- `hooks/use-load-more.ts`

**Strengths:**
- Double-click protection via `loadingRef` (synchronous guard before async operation)
- Auto-reset via `useEffect` when `initialItems` reference changes (SSR navigation)
- Manual `reset()` for explicit state management
- Generic type parameter -- reusable across all paginated views

**Performance characteristics:**
- `setItems(prev => [...prev, ...newItems])` -- creates a new array on every "Load More" click
- After N pages of 50 items, the state array holds `50 * N` items
- Each state update triggers a re-render of the entire item list
- No virtualization -- all items are rendered in the DOM

**Concern:** For aggressive "Load More" usage (e.g., loading 10 pages = 500 tasks), the React state and DOM will hold all 500 items. The `useMemo` computations in parent components (filtering, grouping, mapping) will process all 500 items on every filter change.

### 6.2 `ProjectsContent` -- `components/projects-content.tsx`

**Data flow:**
```
SSR: 50 projects -> useLoadMore -> supabaseProjects (state)
                                       |
                                       v
                                  useMemo: toMockProject (map each project)
                                       |
                                       v
                                  useMemo: filteredProjects (filter + sort)
                                       |
                                       v
                                  useMemo: filterCounts (compute counts)
```

**Performance characteristics:**
- Three chained `useMemo` hooks process all projects on every filter/sort change
- `toMockProject()` creates `Date` objects and maps member arrays -- moderate allocation cost
- `filteredProjects` uses `Array.slice()` before sort -- creates a copy to avoid mutation
- Real-time subscription (`usePooledRealtime`) on `projects` table adds/updates/removes items in local state
- `fetchProjects()` callback (for post-create refresh) fetches the **entire first page** again and replaces all items -- does not preserve loaded subsequent pages

**Concern:** The `toMockProject` transformation creates legacy-format objects for view compatibility. This intermediate format (`MockProject`) adds an unnecessary mapping step and allocates extra objects per project. The views could be refactored to accept `ProjectWithRelations` directly.

### 6.3 `MyTasksPage` -- `components/tasks/MyTasksPage.tsx`

**Data flow:**
```
SSR: 50 tasks -> useLoadMore -> tasks (state)
                                    |
                                    v
                               useMemo: groups (group by project)
                                    |
                                    v
                               useMemo: counts (filter counts)
                               useMemo: filterMembers
                               useMemo: uniqueTagStrings
                               useMemo: filterTags
                               useMemo: visibleGroups (apply filters)
                               useMemo: allVisibleTasks
```

**Performance characteristics:**
- Seven `useMemo` hooks chain from the tasks state
- `groups` uses a `Map<string, ProjectTaskGroup>` -- O(n) iteration over all tasks
- Each `useMemo` has correct dependency arrays -- no unnecessary recomputation
- `projectsRef` and `membersRef` prevent stale closure issues in realtime callbacks
- `buildTaskWithRelations` does a `projects.find()` for each incoming realtime event -- O(p) per event where p = project count
- Dynamic imports for `TaskWeekBoardView` and `TaskListDndWrapper` keep @dnd-kit out of initial bundle

**Concern:** The `tasks.find(t => t.id === taskId)` pattern in `toggleTask`, `changeTaskTag`, and `moveTaskDate` is O(n) per interaction. For 500 loaded tasks, this is measurable but likely <1ms. However, these callbacks are not debounced -- rapid clicking could trigger redundant server action calls.

### 6.4 `ClientsContent` -- `components/clients-content.tsx`

**Data flow:**
```
SSR: 50 clients -> useLoadMore -> allClients (state)
                                      |
                                      v
                                 useMemo: clients (map to MappedClient)
                                      |
                                      v
                                 useMemo: filtered (filter + sort)
                                      |
                                      v
                                 visibleClients = filtered.slice(pageStart, pageStart + pageSize)
```

**Performance characteristics:**
- Local client-side pagination (10 items per page) on top of server-side cursor pagination
- After loading 3 pages (150 clients), the `filtered` memo processes all 150 on every keystroke in the search box
- `ClientTableRow` is memoized with `memo()` -- prevents re-renders of unchanged rows
- Heavy modal components (`ClientWizard`, `ClientDetailsDrawer`) are lazy-loaded

**Concern -- Stale `useMemo` dependency:** On line 309, the `clients` memo depends on `initialClients` instead of `allClients`:
```typescript
const clients: MappedClient[] = useMemo(() => {
  return allClients.map((c): MappedClient => ({...}))
}, [initialClients])  // BUG: should be [allClients]
```
This means when the user clicks "Load More" and `allClients` grows from 50 to 100, the `clients` memo will NOT recompute. The newly loaded clients will be invisible in the filtered/sorted view until a full re-render is triggered. **This is a correctness bug, not just a performance issue.**

### 6.5 `InboxContent` -- `components/inbox/InboxContent.tsx`

**Data flow:**
```
SSR: 50 inbox items -> useLoadMore -> items (state)
                                          |
                                          v
                                     useMemo: filtered (tab + type + search)
                                          |
                                          v
                                     render: filtered.map(InboxItemRow)
```

**Performance characteristics:**
- `InboxItemRow` is memoized with `memo()` -- only re-renders when item/callback props change
- `content-visibility: auto` CSS property on rows enables browser-native virtualization for off-screen items
- `contain-intrinsic-size: auto 80px` provides layout hints to prevent CLS during content-visibility transitions
- `handleMarkAsRead`, `handleMarkAllAsRead`, `handleDelete` have `useCallback` -- stable references prevent row re-renders
- Uses `useInboxRealtime` (non-pooled) instead of `usePooledRealtime` -- creates its own Supabase channel

**Assessment:** This is the best-optimized component. The combination of `memo()` rows, `content-visibility: auto`, stable callbacks, and load-more pagination provides near-optimal rendering performance.

---

## 7. Page Entry Point Analysis

### 7.1 `projects/page.tsx`

```typescript
const projectsPromise = getCachedProjects(orgId)
const clientsPromise = getCachedClients(orgId)
// Both started in parallel, resolved in Suspense boundary
```

**Assessment:** Optimal. Both data fetches start immediately after auth, resolve in parallel via `Promise.all` inside the `ProjectsListStreamed` component. Skeleton shows instantly via `<Suspense fallback={<ProjectsListSkeleton />}>`.

### 7.2 `tasks/page.tsx`

```typescript
const tasksPromise = getCachedMyTasks(orgId)
const projectsPromise = getCachedProjects(orgId)
const membersPromise = getCachedOrganizationMembers(orgId)
const tagsPromise = getCachedTags(orgId)
// All 4 started in parallel
```

**Assessment:** Optimal. Four parallel fetches with `Promise.all` in the streamed component. RSC payload is minimized by mapping members and tags to Pick types before serialization.

**Concern:** `getCachedProjects(orgId)` is called here AND in the projects page. React `cache()` deduplicates within a single request, but these are different page navigations. The KV cache (2min TTL) handles cross-request dedup effectively.

However, `getCachedProjects` calls `getProjects(orgId)` which returns `PaginatedResult<ProjectWithRelations>` with nested members. The tasks page only needs `{id, name, workstreams}` from projects -- it receives the full project payload including all members, descriptions, and metadata. This is wasteful RSC serialization.

### 7.3 `clients/page.tsx`

```typescript
const result = await getCachedClientsWithProjectCounts(orgId)
```

**Assessment:** Single await inside the `ClientsList` component, wrapped in Suspense. The `getCachedClientsWithProjectCounts` wrapper calls `getClientsWithProjectCounts(orgId)` -- this executes TWO queries sequentially (clients, then projects for counts). No KV caching because the server-cache wrapper calls through without filters/cursor.

**Concern:** The server-cache wrapper `getCachedClientsWithProjectCounts` only provides request-level dedup (React `cache()`). Unlike `getCachedProjects`, it does not have KV caching internally. The underlying `getClientsWithProjectCounts` makes two sequential Supabase queries, which could be ~100-200ms on cold cache.

### 7.4 `inbox/page.tsx`

```typescript
const inboxPromise = getCachedInboxItems()
const unreadPromise = getCachedUnreadCount()
// Both started in parallel
```

**Assessment:** Parallel fetch, Suspense-streamed. `getCachedInboxItems()` only uses React `cache()` -- no KV cache. `getCachedUnreadCount()` similarly no KV cache.

**Concern:** Inbox data is inherently volatile, but the complete absence of KV caching means every page load hits Supabase directly. For frequently accessed pages, even a 10-15 second KV TTL would reduce database load.

---

## 8. Remaining Unbounded Queries

These queries fetch an unlimited number of rows:

### 8.1 `getTaskStats()` -- `lib/actions/tasks/queries.ts:242-279`

```typescript
const { data, error } = await supabase
  .from("tasks")
  .select("status, priority")
  .eq("project_id", projectId)
// No .limit() -- fetches ALL tasks for the project
```

Iterates all rows in JavaScript to build `byStatus` and `byPriority` counts. For a project with 5,000 tasks, this fetches 5,000 rows over the network.

**Fix:** Use PostgreSQL aggregation:
```sql
SELECT status, priority, COUNT(*) as count
FROM tasks
WHERE project_id = $1
GROUP BY status, priority
```

### 8.2 `getClientStats()` -- `lib/actions/clients.ts:493-524`

```typescript
const { data, error } = await supabase
  .from("clients")
  .select("status")
  .eq("organization_id", orgId)
// No .limit() -- fetches ALL clients for the org
```

Same pattern as getTaskStats -- fetches all rows to count statuses client-side.

### 8.3 `getClientsWithProjectCounts()` -- project enrichment query

```typescript
const { data: projectData } = await supabase
  .from("projects")
  .select("client_id, status")
  .in("client_id", clientIds)
// No .limit() -- fetches ALL projects for up to 50 clients
```

If the 50 clients collectively have 2,000 projects, all 2,000 are fetched and processed in JavaScript.

### 8.4 `getTasks()` without cursor -- `lib/actions/tasks/queries.ts:94-101`

```typescript
// No cursor: return all tasks (board view, drag-drop, timeline need full set)
const { data, error } = await query
  .order("sort_order", { ascending: true })
  .order("id", { ascending: true })
// No .limit()
```

This is intentional -- board/drag-drop views require the complete task set for DnD operations. However, it means a project with 500+ tasks fetches all of them. The application does apply `style={{ contain: "strict" }}` on the scrollable container, which helps with rendering performance but not data transfer.

---

## 9. Memory Usage Patterns

### 9.1 Server-Side (per request)

| Operation | Memory Pattern | Scaling Behavior |
|---|---|---|
| Paginated query (50 items) | ~50KB per page (estimated, depends on row size) | Constant per request |
| `getTaskStats()` full scan | ~20 bytes per row * N rows | Linear with project size |
| `getClientsWithProjectCounts()` project enrichment | ~40 bytes per project row * M projects | Linear with total projects |
| KV deserialization (51 items) | Full JSON parse of cached payload | Constant but includes 1 extra row |

### 9.2 Client-Side (accumulated)

| Operation | Memory Pattern | After 10 "Load More" clicks |
|---|---|---|
| `useLoadMore` items state | `[...prev, ...new]` array spread | 500 items in state |
| `useMemo` transformations | Maps, filters create new arrays | 500+ intermediate arrays per render |
| DOM nodes | One row/card per item | 500 DOM subtrees |
| InboxContent with `content-visibility` | Browser can reclaim off-screen layout | Only visible rows computed |

### 9.3 KV/Memory Cache (process-level)

| Cache | Bound | Eviction |
|---|---|---|
| Vercel KV | Unlimited (managed) | TTL-based (30s-10min) |
| In-memory fallback (`memCache`) | 500 entries max | LRU eviction + TTL sweep every 60s |
| React `cache()` | Per-request (automatic GC) | Request boundary |

---

## 10. Bundle Size Impact

### Load-More Infrastructure

| Module | Estimated Size (gzipped) | Notes |
|---|---|---|
| `hooks/use-load-more.ts` | ~400 bytes | Minimal hook with useState/useCallback/useRef |
| `components/ui/load-more-button.tsx` | ~300 bytes | Button + Loader2 icon |
| `lib/actions/cursor.ts` | ~200 bytes | Base64url encode/decode |
| `lib/actions/types.ts` | ~0 bytes (types only) | Erased at compile time |

**Total infrastructure overhead:** ~900 bytes gzipped -- negligible.

### Per-Page Component Sizes

| Component | Key Imports | Dynamic Imports |
|---|---|---|
| `ProjectsContent` | useLoadMore, realtime-context | ProjectTimeline, ProjectBoardView (ssr: false) |
| `MyTasksPage` | useLoadMore, realtime-context, filter utils | TaskWeekBoardView, TaskListDndWrapper (~25KB saved) |
| `ClientsContent` | useLoadMore, table components | ClientWizard, ClientDetailsDrawer (lazy) |
| `InboxContent` | useLoadMore, realtime hooks | None (all inline) |

**Assessment:** Dynamic imports are well-placed. The heaviest modules (@dnd-kit/core, @dnd-kit/sortable, timeline/board views) are code-split and only loaded when the corresponding view is active. The load-more pattern adds minimal bundle overhead compared to alternative solutions (virtual scrolling libraries like react-window at ~6KB gzipped, or tanstack-virtual at ~3KB gzipped).

---

## 11. Risk Matrix

| ID | Finding | Severity | Impact | Effort to Fix |
|---|---|---|---|---|
| P0-1 | `getTaskStats()` unbounded full scan | Critical | Linear memory/network growth with task count | Low -- single SQL GROUP BY query |
| P0-2 | `getClientStats()` unbounded full scan | Critical | Linear memory/network growth with client count | Low -- single SQL GROUP BY query |
| P0-3 | `getClientsWithProjectCounts()` unbounded project fetch | Critical | Linear growth with total projects across clients | Medium -- SQL GROUP BY or RPC |
| P1-1 | Missing composite index for `getTasks` cursor | High | Sort step on every paginated query | Low -- single CREATE INDEX |
| P1-2 | Missing composite index for `getMyTasks` cursor | High | Sort step on cross-project task pagination | Low -- single CREATE INDEX |
| P1-3 | Missing composite index for `getProjects` cursor | High | Sort step on project list pagination | Low -- single CREATE INDEX |
| P1-4 | `getTasks()` no-cursor mode unbounded | High | All tasks fetched for board/timeline views | High -- requires virtual scrolling or chunked loading |
| P1-5 | `ClientsContent` stale useMemo dependency bug | High | Newly loaded clients invisible after Load More | Low -- change `[initialClients]` to `[allClients]` |
| P2-1 | No KV cache for inbox/unread first page | Medium | Every inbox page load hits Supabase directly | Low -- add KV cache wrapper |
| P2-2 | `getCachedClientsWithProjectCounts` no KV cache | Medium | Two sequential Supabase queries on every load | Low -- add KV cache wrapper |
| P2-3 | KV caches `limit + 1` rows (1 extra row serialized) | Low | ~1-5KB extra data per cache read | Low -- slice before caching |
| P2-4 | Tasks page receives full project payloads | Low | Excess RSC serialization | Medium -- dedicated slim query |
| P2-5 | No client-side debounce on task interactions | Low | Rapid clicks trigger duplicate server actions | Low -- add debounce |
| P3-1 | `toMockProject()` legacy format transformation | Informational | Unnecessary intermediate allocation | High -- refactor view components |
| P3-2 | No virtualization for loaded items | Informational | DOM grows linearly with loaded pages | Medium -- add virtual scrolling |

---

## 12. Recommendations

### Immediate (P0 -- Critical)

**12.1** Replace `getTaskStats()` and `getClientStats()` with SQL aggregation queries:
```sql
-- getTaskStats via Supabase .rpc() or raw SQL
SELECT status, priority, COUNT(*) as count
FROM tasks WHERE project_id = $1
GROUP BY status, priority;
```

**12.2** Replace the project enrichment query in `getClientsWithProjectCounts()` with a SQL aggregation:
```sql
SELECT client_id, status, COUNT(*) as count
FROM projects
WHERE client_id = ANY($1)
GROUP BY client_id, status;
```

### Short-Term (P1 -- High)

**12.3** Add composite indexes aligned with cursor columns:
```sql
CREATE INDEX idx_tasks_project_sort_id ON tasks(project_id, sort_order, id);
CREATE INDEX idx_tasks_assignee_updated_id ON tasks(assignee_id, updated_at DESC, id DESC) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_projects_org_updated_id ON projects(organization_id, updated_at DESC, id DESC);
```

**12.4** Fix the `ClientsContent` useMemo dependency from `[initialClients]` to `[allClients]` at `components/clients-content.tsx:309`.

### Medium-Term (P2 -- Medium)

**12.5** Add KV caching for inbox first page in `getInboxItems()` (similar to how `getMyTasks` caches unfiltered first page).

**12.6** Add KV caching for `getClientsWithProjectCounts()` first page (unfiltered, no cursor).

**12.7** Slice to `limit` items BEFORE writing to KV cache to avoid serializing the extra sentinel row:
```typescript
const items = hasMore ? data.slice(0, limit) : data
// Cache the sliced items, not the raw limit+1 response
cache.set(key, items, { ex: ttl })
```

**12.8** Create a slim `getProjectsMinimal(orgId)` query for the tasks page that only returns `{id, name, workstreams}` instead of full `ProjectWithRelations`.

### Long-Term (P3 -- Informational)

**12.9** Consider virtual scrolling (react-window or @tanstack/virtual) for views that accumulate many items via Load More.

**12.10** Refactor view components to accept `ProjectWithRelations` directly, eliminating the `toMockProject()` transformation layer.

**12.11** Consider implementing infinite scroll with intersection observer instead of manual "Load More" button for improved UX.

---

## Appendix: File Inventory

| File | Role |
|---|---|
| `C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts` | Task paginated queries (getTasks, getMyTasks, getTaskStats) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\projects\crud.ts` | Project paginated queries (getProjects) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\clients.ts` | Client paginated queries (getClients, getClientsWithProjectCounts, getClientStats) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\inbox.ts` | Inbox paginated queries (getInboxItems) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\cursor.ts` | Cursor encode/decode utilities |
| `C:\Users\Fares\Downloads\PMS\lib\actions\types.ts` | PaginatedResult type definition |
| `C:\Users\Fares\Downloads\PMS\lib\server-cache.ts` | Request-level cache wrappers (React cache()) |
| `C:\Users\Fares\Downloads\PMS\lib\cache\index.ts` | Cache module barrel export |
| `C:\Users\Fares\Downloads\PMS\lib\cache\keys.ts` | KV cache keys and TTL definitions |
| `C:\Users\Fares\Downloads\PMS\lib\cache\utils.ts` | cacheGet/cacheInvalidateAndFetch utilities |
| `C:\Users\Fares\Downloads\PMS\lib\cache\client.ts` | KV client and in-memory fallback |
| `C:\Users\Fares\Downloads\PMS\lib\constants.ts` | Page sizes and limits |
| `C:\Users\Fares\Downloads\PMS\hooks\use-load-more.ts` | Generic load-more pagination hook |
| `C:\Users\Fares\Downloads\PMS\components\ui\load-more-button.tsx` | Load More button component |
| `C:\Users\Fares\Downloads\PMS\components\projects-content.tsx` | Projects list with load-more |
| `C:\Users\Fares\Downloads\PMS\components\tasks\MyTasksPage.tsx` | My Tasks page with load-more |
| `C:\Users\Fares\Downloads\PMS\components\clients-content.tsx` | Clients list with load-more |
| `C:\Users\Fares\Downloads\PMS\components\inbox\InboxContent.tsx` | Inbox with load-more |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\projects\page.tsx` | Projects page entry point |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\tasks\page.tsx` | Tasks page entry point |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\clients\page.tsx` | Clients page entry point |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\inbox\page.tsx` | Inbox page entry point |
| `C:\Users\Fares\Downloads\PMS\supabase\migrations\20260122000001_initial_schema.sql` | Table definitions |
| `C:\Users\Fares\Downloads\PMS\supabase\migrations\20260127000001_inbox_items.sql` | Inbox table + indexes |
| `C:\Users\Fares\Downloads\PMS\supabase\migrations\20260202000002_add_performance_indexes.sql` | Performance indexes |
| `C:\Users\Fares\Downloads\PMS\supabase\migrations\20260204000001_additional_performance_indexes.sql` | Additional indexes |
| `C:\Users\Fares\Downloads\PMS\supabase\migrations\20260206000001_performance_fixes.sql` | Index fixes |
