# Cursor-Based Pagination Performance Analysis

**Application:** PMS (Project Management SaaS)
**Stack:** Next.js 16 App Router, React 19, Supabase, Vercel KV
**Date:** 2026-02-14
**Analyst:** Performance Engineering Agent

---

## Executive Summary

The application implements cursor-based pagination with a `limit + 1` pattern (`DEFAULT_PAGE_SIZE = 50`) across four primary list pages: projects, tasks (my tasks), clients, and inbox. This analysis evaluates the user experience performance impact of this pagination architecture, covering initial page loads, Core Web Vitals, load-more interactions, RSC serialization payloads, and real-time subscription edge cases.

**Overall Assessment:** The pagination implementation is architecturally sound and delivers meaningful performance improvements for data-heavy organizations. Several specific issues and optimization opportunities are identified below.

---

## 1. Page Load Performance

### 1.1 Request Flow (Per Page Load)

Every dashboard page follows an identical request pipeline:

```
Middleware (token refresh)
  -> Layout (cachedGetUser + KV org pre-warm)
    -> page.tsx (getPageOrganization ~5ms from KV)
      -> Parallel data fetches (Suspense boundary)
        -> Skeleton rendered immediately
        -> Data streams in when queries complete
```

**Key files in the pipeline:**
- `C:\Users\Fares\Downloads\PMS\middleware.ts` -- refreshes auth token
- `C:\Users\Fares\Downloads\PMS\lib\request-cache.ts` -- `cachedGetUser()` reads session from cookies (~0ms)
- `C:\Users\Fares\Downloads\PMS\lib\page-auth.ts` -- `getPageOrganization()` resolves org from KV (~5ms)
- `C:\Users\Fares\Downloads\PMS\lib\server-cache.ts` -- request-level deduplication via React `cache()`

### 1.2 Per-Page Analysis

#### Projects Page (`app/(dashboard)/projects/page.tsx`)

| Metric | Before (Unbounded) | After (Paginated) |
|--------|--------------------|--------------------|
| Initial query | `SELECT * FROM projects ... ORDER BY updated_at DESC` (all rows) | `SELECT * ... LIMIT 51` |
| KV cache | Stores entire dataset | Stores first 51 rows |
| RSC payload | All projects + relations (members, client, team) | Max 50 projects + relations |
| Suspense skeleton | `<ProjectsListSkeleton />` | Same |

**Analysis:** The projects page fires two parallel fetches (`getCachedProjects` + `getCachedClients`) without waterfall. The KV-cached first-page query (`CacheTTL.PROJECTS = 120s`) means repeated loads within 2 minutes hit KV rather than Supabase. The `limit + 1` pattern (fetching 51 rows to determine `hasMore`) adds negligible overhead at the database level.

**Concern:** The `getProjects()` function in `C:\Users\Fares\Downloads\PMS\lib\actions\projects\crud.ts` (line 263-301) caches the first-page result including the extra row (`limit + 1`), then slices it client-side. This means the KV cache stores 51 items rather than 50. The overhead is minimal (~2% extra payload) but is an unnecessary inefficiency.

#### Tasks Page (`app/(dashboard)/tasks/page.tsx`)

| Metric | Before (Unbounded) | After (Paginated) |
|--------|--------------------|--------------------|
| Initial query | All user tasks across all projects | `LIMIT 51`, ordered by `updated_at DESC` |
| KV cache | `CacheTTL.TASKS = 30s` | Same TTL, stores 51 rows |
| Parallel fetches | 4: tasks, projects, members, tags | Same |
| RSC payload | All tasks + full member/tag objects | Max 50 tasks; members/tags stripped to minimal shapes |

**Analysis:** The tasks page is the most data-heavy due to its 4 parallel queries. The `getCachedMyTasks` function (`C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts`, line 105-217) correctly only caches unfiltered first-page queries. Filtered or cursor-based queries bypass the cache entirely, going directly to Supabase. The 30-second TTL for tasks is appropriate given their volatility.

**Concern:** The `projects` fetch in the tasks page is NOT paginated -- `getCachedProjects(orgId)` still returns all projects (up to 50 with cursor pagination). However, for the tasks page, projects serve as reference data (mapping task.project_id to names), not as the primary list. If an organization has >50 projects, the project reference data will be incomplete, and some tasks may show "Unknown Project" names. This is a functional correctness issue, not strictly a performance issue.

#### Clients Page (`app/(dashboard)/clients/page.tsx`)

| Metric | Before (Unbounded) | After (Paginated) |
|--------|--------------------|--------------------|
| Initial query | All clients + project counts | `LIMIT 51` clients, then project counts for page |
| N+1 risk | Single query for all client project counts | `IN` query scoped to 50 client IDs |
| RSC payload | All clients + breakdown objects | Max 50 clients |

**Analysis:** The `getClientsWithProjectCounts` function (`C:\Users\Fares\Downloads\PMS\lib\actions\clients.ts`, line 387-490) first fetches paginated clients, then enriches them with project counts via a single `IN` query on `client_id`. This two-step pattern is efficient -- the second query is scoped to at most 50 IDs.

**Concern:** The clients page implements DUAL pagination: cursor-based "Load More" (server-side) AND client-side table pagination with `pageSize` (10/7/25 options). This creates a confusing UX where the user sees "Page 1 of 5" (client-side from 50 items) with a "Load More" button below the table. The two pagination mechanisms are independent and potentially conflicting.

#### Inbox Page (`app/(dashboard)/inbox/page.tsx`)

| Metric | Before (Unbounded) | After (Paginated) |
|--------|--------------------|--------------------|
| Initial query | All inbox items | `LIMIT 51` ordered by `created_at DESC` |
| Parallel fetches | 2: inbox items, unread count | Same |
| Unread count | `SELECT id, COUNT(*), head: true` -- lightweight | Unchanged |

**Analysis:** The inbox page is the cleanest pagination implementation. Two parallel queries (`getCachedInboxItems` + `getCachedUnreadCount`) with Suspense streaming. The unread count query uses `head: true` for a lightweight count without fetching rows.

**Concern:** The inbox items are NOT KV-cached -- unlike projects/clients/tasks, `getCachedInboxItems` in `C:\Users\Fares\Downloads\PMS\lib\server-cache.ts` (line 226-229) just wraps with React `cache()` for request dedup. Every page load hits Supabase directly. This is potentially intentional (inbox items change frequently), but for organizations with high notification volume, the lack of even a short TTL cache means every navigation to `/inbox` incurs a full DB round-trip.

### 1.3 Quantitative Impact Estimates

Assuming a typical organization with ~200 projects, ~1000 tasks, ~50 clients, ~500 inbox items:

| Page | Payload Before | Payload After | Reduction |
|------|---------------|---------------|-----------|
| Projects | ~200 projects * ~2KB = ~400KB | ~50 * ~2KB = ~100KB | **75%** |
| Tasks | ~1000 tasks * ~0.8KB = ~800KB | ~50 * ~0.8KB = ~40KB | **95%** |
| Clients | ~50 clients * ~1KB = ~50KB | ~50 * ~1KB = ~50KB | **0%** (below threshold) |
| Inbox | ~500 items * ~0.5KB = ~250KB | ~50 * ~0.5KB = ~25KB | **90%** |

The tasks and inbox pages see the largest improvement. The clients page sees no improvement for organizations with fewer than 50 clients.

---

## 2. Core Web Vitals Impact

### 2.1 Largest Contentful Paint (LCP)

**Positive Impact:**

The combination of Suspense streaming + pagination directly improves LCP:

1. **Skeleton renders instantly** -- The `<Suspense fallback={<ProjectsListSkeleton />}>` pattern means the LCP element (typically the skeleton or page header) renders on the initial HTML flush, before any data queries complete.

2. **Reduced TTFB for data-heavy pages** -- The server-side query completes faster because `LIMIT 51` is dramatically faster than an unbounded scan. For the tasks page with 1000 tasks, this could reduce the Supabase query from ~200ms to ~20ms.

3. **Smaller RSC payload streams faster** -- The reduced payload (40KB vs 800KB for tasks) means the RSC flight data streams to the client faster, making the Suspense boundary resolve sooner.

**Estimated LCP improvement:** 200-800ms reduction on data-heavy pages (scaling with dataset size).

**Caveat:** LCP measurement depends on what element the browser selects. If the LCP element is the skeleton itself (rendered on first flush), pagination has no effect on LCP. If LCP is an element inside the streamed content (e.g., the first project card), pagination helps significantly.

### 2.2 Cumulative Layout Shift (CLS)

**The LoadMoreButton component (`C:\Users\Fares\Downloads\PMS\components\ui\load-more-button.tsx`) is CLS-safe:**

```tsx
export function LoadMoreButton({ hasMore, isLoading, onLoadMore }) {
  if (!hasMore) return null  // Conditional render

  return (
    <div className="flex justify-center py-4">
      <Button variant="outline" size="sm" ...>
        {isLoading ? (<><Loader2 .../> Loading...</>) : "Load More"}
      </Button>
    </div>
  )
}
```

**CLS Analysis:**

1. **Initial render:** The button has a fixed height (`py-4` + `size="sm"` button). When `hasMore` transitions from `false` to `true` (after data loads), this introduces a small layout shift of approximately 52px (32px button + 16px vertical padding). However, this happens during the Suspense resolution phase, which typically occurs before the page becomes interactive.

2. **Load More click:** When loading completes, new items are appended above the button. The button stays in place (no shift). When `hasMore` becomes `false` after the last page, the button disappears, removing its height from the layout. This causes a **layout shift of ~52px** -- but only after user interaction, which is excluded from CLS measurement (CLS only counts unexpected shifts, and user-initiated shifts within 500ms are excluded).

3. **Button state change:** The button text changes from "Load More" to "Loading..." with a spinner. Since both states use the same `size="sm"` variant, there is no width/height change.

**CLS Rating:** The implementation is well-designed from a CLS perspective. The only potential CLS issue is the Suspense fallback-to-content transition, but this is inherent to the Suspense pattern and is handled by the skeleton components matching the content layout dimensions.

**Specific CLS concern on the Clients page:** The clients page renders the `LoadMoreButton` below the table's pagination footer. When the button appears/disappears, it shifts content below it. Since the table has its own fixed pagination area, the visual impact is minimal, but the dual pagination UX may confuse users.

### 2.3 Interaction to Next Paint (INP)

**Load More Button Interaction Analysis:**

The "Load More" click triggers this chain:

```
User click -> loadMore() -> setIsLoading(true) -> fetchMore(cursor) -> server action
  -> Supabase query -> response -> setItems([...prev, ...newItems]) -> setIsLoading(false)
```

**INP breakdown:**

1. **Immediate response (< 1 frame):** The `loadMore` callback sets `isLoading = true` synchronously via `setIsLoading(true)`. This triggers a re-render that shows the spinner. The interaction is acknowledged within a single frame (~16ms).

2. **Network latency (50-500ms):** The `fetchMore(cursor)` call invokes a Next.js Server Action. This makes an HTTP POST to the server, which then queries Supabase. Round-trip time depends on:
   - Server action overhead: ~20ms
   - Supabase query (LIMIT 51 with cursor): ~10-50ms
   - Network round-trip: ~20-100ms
   - Total: ~50-250ms typical

3. **Re-render with new data:** After the response, `setItems([...prev, ...newItems])` triggers a re-render. For 50 new items, this is a moderate React reconciliation cost. The `useMemo` chains in each page component (filtering, sorting, grouping) will recompute.

**INP Rating:** The immediate visual feedback (spinner) means the user perceives responsiveness within 16ms. The actual data render completes within 200-500ms. This is well within the "Good" INP threshold of 200ms for the initial paint change.

**Potential INP concern:** The `useLoadMore` hook uses `loadingRef.current` as a guard to prevent double-clicks. This is correct but creates a subtle issue: if the user clicks "Load More" during a transition animation, the ref guard prevents the call. This is good behavior.

---

## 3. Load-More Interaction UX

### 3.1 Hook Design (`hooks/use-load-more.ts`)

The `useLoadMore` hook (`C:\Users\Fares\Downloads\PMS\hooks\use-load-more.ts`) is well-structured:

```typescript
export function useLoadMore<T>({
  initialItems,
  initialHasMore = false,
  initialCursor = null,
  fetchMore,
}: {
  initialItems: T[]
  initialHasMore: boolean
  initialCursor: string | null
  fetchMore: (cursor: string) => Promise<PaginatedResult<T>>
}) {
```

**Strengths:**
- Generic type parameter `<T>` makes it reusable across all four pages
- `loadingRef.current` prevents concurrent load-more requests (race condition guard)
- Auto-reset via `useEffect` when `initialItems` reference changes (handles server-side re-fetches)
- Manual `reset()` function for imperative reset after refetch

**Issues identified:**

1. **Reference identity comparison for auto-reset (line 61):**
   ```typescript
   if (initialItemsRef.current !== initialItems) {
   ```
   This compares by reference identity, not by value. If the parent re-renders with a new array that contains the same data (e.g., after a `router.refresh()`), the auto-reset triggers unnecessarily, discarding any "Load More" items the user had accumulated. This is a minor UX regression -- the user clicks "Load More" to see 100 items, then some unrelated state change causes a re-render with a new array reference, and they are back to 50 items.

2. **No error retry mechanism:** If `fetchMore` fails, the error is logged to console but the cursor/state is not modified. The user can click "Load More" again to retry, which is acceptable, but there is no visible error state in the button.

3. **No abort on unmount:** If the component unmounts during a fetch (e.g., user navigates away), the Promise continues and may call `setState` on an unmounted component. In React 19 with concurrent features, this is less problematic due to automatic cleanup, but an `AbortController` would be cleaner.

### 3.2 Button Component (`components/ui/load-more-button.tsx`)

The button component is minimal and correct:

```tsx
export function LoadMoreButton({ hasMore, isLoading, onLoadMore }) {
  if (!hasMore) return null

  return (
    <div className="flex justify-center py-4">
      <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoading}>
        {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</>) : "Load More"}
      </Button>
    </div>
  )
}
```

**Accessibility:** The button is keyboard-focusable and has visible disabled state. The `Loader2` spinner provides visual feedback. However, there is no `aria-live` region to announce to screen readers when new items have loaded.

### 3.3 Network Waterfall for Load-More Requests

The load-more request flow:

```
Click -> POST /projects (Server Action RPC)
  -> Server: decodeCursor(cursor)
  -> Server: Supabase query with cursor filter + LIMIT 51
  -> Server: encodeCursor(lastItem) + slice response
  -> Response: { data: T[], nextCursor: string, hasMore: boolean }
```

**Observations:**

1. **Single HTTP request per load:** Each "Load More" click makes exactly one Server Action call. There are no secondary requests or waterfalls.

2. **Cursor decoding is validated:** The `decodeCursor` function in `C:\Users\Fares\Downloads\PMS\lib\actions\cursor.ts` wraps JSON.parse in a try/catch and returns a typed `{ value, id }`. Invalid cursors return an error rather than throwing.

3. **No prefetching:** The implementation does not prefetch the next page. When the user scrolls to the bottom and sees the "Load More" button, they must click it and wait. Prefetching the next page when the button enters the viewport would reduce perceived latency by 100-300ms.

---

## 4. RSC Serialization Payload

### 4.1 Before vs After Comparison

**Before (unbounded queries):**

The server component would fetch all rows, serialize them into the RSC flight format, and stream the entire dataset to the client. For a large organization:

- Projects: All 200 projects with nested `members[]` (each with `profile` sub-object), `client`, and `team` relations
- Tasks: All 1000 tasks with `assignee`, `workstream`, and `project` relations
- Each row includes all database columns (`organization_id`, `created_at`, `updated_at`, etc.)

**After (paginated, current implementation):**

- Projects: Max 50 projects with same relations, plus 3 new fields (`initialHasMore`, `initialCursor`, `nextCursor`)
- Tasks: Max 50 tasks, plus members/tags stripped to minimal shapes

The tasks page demonstrates best-practice RSC payload minimization (`C:\Users\Fares\Downloads\PMS\app\(dashboard)\tasks\page.tsx`, lines 65-81):

```typescript
// Map to minimal shapes to reduce RSC serialization payload
const members = (membersResult.data || []).map(m => ({
  id: m.id,
  user_id: m.user_id,
  role: m.role,
  profile: {
    id: m.profile?.id ?? "",
    full_name: m.profile?.full_name ?? null,
    email: m.profile?.email ?? "",
    avatar_url: m.profile?.avatar_url ?? null,
  },
}))

const tags = (tagsResult.data || []).map(t => ({
  id: t.id,
  name: t.name,
  color: t.color,
}))
```

### 4.2 Payload Optimization Gaps

**Issue 1: Projects page does not strip RSC payload.**

The projects page (`C:\Users\Fares\Downloads\PMS\app\(dashboard)\projects\page.tsx`) passes the full `ProjectWithRelations[]` directly:

```typescript
<ProjectsContent
  initialProjects={projectsResult.data ?? []}  // Full objects
  ...
/>
```

Each `ProjectWithRelations` includes every column from the `projects` table plus nested `members[]`, `client`, and `team`. Fields like `organization_id`, `created_at`, `updated_at`, `description` (which can be large), and all 30+ project columns are serialized even though the list view only displays name, status, priority, progress, dates, members, client, and tags.

**Estimated savings from stripping:** For 50 projects, removing unnecessary fields could reduce the RSC payload by ~30-50%.

**Issue 2: Clients page passes full `ClientWithProjectCount` objects.**

The clients page (`C:\Users\Fares\Downloads\PMS\app\(dashboard)\clients\page.tsx`) passes the raw result directly without minimizing:

```typescript
<ClientsContent
  initialClients={clients}  // Full ClientWithProjectCount objects
  ...
/>
```

**Issue 3: Inbox items include full relation objects.**

The `InboxItemWithRelations` type includes nested `actor`, `project`, `task`, and `client` objects. For the inbox list view, only `actor.avatar_url`, `actor.full_name`, `project.id`, `project.name` are used.

### 4.3 Cursor String Overhead

Each paginated response adds two small fields:
- `nextCursor`: Base64url-encoded JSON of `[value, id]` -- typically 50-80 bytes
- `hasMore`: Boolean -- 4-5 bytes

This overhead is negligible compared to the payload savings.

---

## 5. Real-Time Subscription Interaction

### 5.1 Architecture

The application uses two real-time systems:
1. **Pooled subscriptions** (`C:\Users\Fares\Downloads\PMS\hooks\realtime-context.tsx`): Shared via React context, auto-pauses when tab is hidden
2. **Individual hooks** (`C:\Users\Fares\Downloads\PMS\hooks\use-realtime.ts`): Direct Supabase channel subscriptions

### 5.2 Pagination + Realtime Edge Cases

#### Edge Case 1: Realtime INSERT on a paginated list

When a new project is created (by another user or in another tab), the realtime subscription fires `onInsert`. The handler in `C:\Users\Fares\Downloads\PMS\components\projects-content.tsx` (line 117-126):

```typescript
onInsert: (project: ProjectRow) => {
  setSupabaseProjects(prev => {
    if (prev.some(p => p.id === project.id)) return prev  // dedup
    const newProject: ProjectWithRelations = {
      ...project,
      members: [],
      client: null,
    }
    return [newProject, ...prev]  // Prepend
  })
},
```

**Issue:** This prepends the new item to the local array, which now has 51+ items (50 from initial + 1 from realtime). If the user had loaded 2 pages (100 items), the array grows to 101. This unbounded growth mirrors the old unbounded query problem, just shifted to the client side. Over time with frequent inserts, memory usage increases linearly.

**Impact:** For typical PMS usage (a few projects created per day), this is not a practical problem. For high-throughput scenarios (bulk imports, automated creation), client memory could grow significantly.

**Mitigation:** The `hasMore` flag is not updated when realtime items are added. This means the "Load More" button state correctly reflects the server-side cursor position, not the local item count. Users who load more will not see duplicate items because the cursor-based query uses `(updated_at, id)` compound ordering, which is stable.

#### Edge Case 2: Realtime UPDATE changes sort order

When a project is updated (e.g., its `updated_at` changes), the realtime handler does an in-place update:

```typescript
onUpdate: (project: ProjectRow) => {
  setSupabaseProjects(prev =>
    prev.map(p => p.id === project.id ? { ...p, ...project } : p)
  )
},
```

**Issue:** The list is sorted by `updated_at DESC` on the server. A realtime update changes the item's `updated_at`, but the item stays in its original position in the array. This means the local sort order diverges from the server sort order. If the user clicks "Load More," the next page from the server starts from where the cursor left off, potentially creating a gap or overlap with the locally-modified order.

**Impact:** Minor visual inconsistency. Items may appear out of order after realtime updates. The next "Load More" fetch is still correct because the compound cursor `(updated_at, id)` is immutable once set.

#### Edge Case 3: Realtime DELETE of an item the user has not loaded

If an item on page 3 is deleted while the user is viewing page 1, the server-side data shifts. When the user eventually loads page 3, they may see items they already loaded (duplicates) or miss items. This is an inherent limitation of cursor-based pagination with concurrent modifications and is generally acceptable.

#### Edge Case 4: Inbox realtime uses non-pooled subscriptions

The inbox page uses `useInboxRealtime` from `C:\Users\Fares\Downloads\PMS\hooks\use-realtime.ts` (line 334-348) rather than the pooled `usePooledRealtime`. This creates a separate Supabase channel. Since the inbox is the only page using this particular subscription (`inbox_items` filtered by `user_id`), there is no pooling benefit lost. However, it means the inbox subscription does NOT auto-pause when the tab is hidden (unless `useRealtime` implements its own visibility handling).

**Performance implication:** The inbox subscription maintains an active WebSocket connection even when the tab is backgrounded, consuming bandwidth and battery on mobile devices.

#### Edge Case 5: Tasks page realtime with incomplete project references

The tasks page realtime handler (`C:\Users\Fares\Downloads\PMS\components\tasks\MyTasksPage.tsx`, line 216-237) builds `TaskWithRelations` from raw task data by looking up projects in `projectsRef.current`:

```typescript
const buildTaskWithRelations = useCallback((task: TaskRow) => {
  if (task.assignee_id !== userId) return null
  const project = projectsRef.current.find(p => p.id === task.project_id)
  if (!project) return null  // Task must belong to a known project
  ...
}, [userId])
```

**Issue:** If a new task arrives via realtime and its `project_id` refers to a project that was not included in the initial paginated project list (i.e., a project beyond the first 50), the handler silently drops the task. The user never sees it until they refresh the page.

### 5.3 Realtime + Pagination Interaction Summary

| Scenario | Behavior | Severity |
|----------|----------|----------|
| New item via realtime | Prepended to list, unbounded growth | Low |
| Updated item via realtime | In-place update, sort order diverges | Low |
| Deleted item via realtime | Removed from local list correctly | None |
| Item from unpaginated page inserted | Correctly added if references resolve | Low |
| Inbox subscription when tab hidden | Stays active (not pooled) | Medium |
| Task from unknown project | Silently dropped | Medium |

---

## 6. Project Detail Page: Intentional Unbounded Query

The project detail page (`C:\Users\Fares\Downloads\PMS\app\(dashboard)\projects\[id]\page.tsx`) intentionally does NOT paginate tasks:

```typescript
const tasksPromise = getCachedTasks(id)  // No cursor, returns all tasks
```

The `getTasks()` function (`C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts`, line 20-102) has a dual-mode design:

```typescript
// When no cursor is provided, returns ALL tasks (needed for board/drag-drop views).
// When a cursor is provided, returns paginated results.
if (cursor) {
  // ... paginated query
}

// No cursor: return all tasks (board view, drag-drop, timeline need full set)
const { data, error } = await query.order("sort_order").order("id")
```

**Rationale:** The project detail page includes board views, drag-and-drop reordering, and timeline views that require the complete task set. Pagination would break drag-drop across page boundaries.

**Performance concern:** For projects with many tasks (200+), this unbounded query is the largest remaining payload bottleneck. The RSC serialization of 200 tasks with relations at ~0.8KB each = ~160KB.

---

## 7. Specific Issues and Recommendations

### 7.1 Critical Issues

**[P1] Clients page dual pagination conflict**

The clients page (`C:\Users\Fares\Downloads\PMS\components\clients-content.tsx`) combines cursor-based "Load More" with client-side table pagination (`pageSize` of 10/7/25). The `useMemo` for `clients` on line 297 references `initialClients` instead of `allClients`, meaning loaded-more items are never reflected in the mapped client list:

```typescript
const clients: MappedClient[] = useMemo(() => {
  return allClients.map((c): MappedClient => ({ ... }))
}, [initialClients])  // BUG: dependency is initialClients, not allClients
```

This means "Load More" fetches data but the table never displays it. The `useMemo` dependency array should be `[allClients]`.

**[P1] Task page project reference incompleteness**

When the projects query returns at most 50 projects (paginated), but the user has tasks across more than 50 projects, the realtime handler drops tasks from unknown projects and the initial task list shows "Unknown Project" for those tasks. The `getCachedProjects(orgId)` call in the tasks page should either be unbounded (since it serves as reference data, not a displayed list) or a separate lightweight query that fetches only `{id, name}` for all projects.

### 7.2 Performance Optimizations

**[P2] KV cache stores limit+1 rows**

All first-page cached queries store `limit + 1` items in KV, then slice to `limit` on every read. Slice before storing to reduce KV storage and deserialization:

```typescript
// Current (stores 51, slices on every read):
const projects = await cacheGet(CacheKeys.projects(orgId), async () => {
  const { data } = await supabase...limit(limit + 1)
  return data
}, CacheTTL.PROJECTS)
const hasMore = projects.length > limit
const items = hasMore ? projects.slice(0, limit) : projects

// Recommended (stores 50 + metadata):
const cached = await cacheGet(CacheKeys.projects(orgId), async () => {
  const { data } = await supabase...limit(limit + 1)
  const hasMore = (data?.length || 0) > limit
  const items = hasMore ? data.slice(0, limit) : data
  const nextCursor = hasMore ? encodeCursor(...) : null
  return { items, hasMore, nextCursor }
}, CacheTTL.PROJECTS)
```

**[P2] RSC payload minimization for projects and clients pages**

Apply the same `map()` stripping pattern used on the tasks page to projects and clients. Strip `organization_id`, `created_at`, `updated_at`, `description`, and other UI-unused fields before passing to client components.

**[P3] Prefetch next page when LoadMoreButton enters viewport**

Use `IntersectionObserver` to detect when the button is near-visible and prefetch the next cursor page. This eliminates perceived latency for the load-more interaction.

**[P3] Inbox KV caching**

Add a short-TTL KV cache for inbox items (e.g., `CacheTTL.INBOX = 15`). Even 15 seconds of caching eliminates redundant Supabase queries during rapid navigation.

### 7.3 UX Improvements

**[P2] Error state for LoadMoreButton**

Add an error prop to show a retry message when the fetch fails:

```tsx
{error ? (
  <Button variant="destructive-outline" onClick={onLoadMore}>
    Failed to load. Retry
  </Button>
) : isLoading ? (
  <><Loader2 .../> Loading...</>
) : (
  "Load More"
)}
```

**[P3] Remaining count indicator**

Show how many more items are available (requires server to return total count or an estimate):

```tsx
"Load More (150 remaining)"
```

This gives users context about list size without loading everything upfront.

---

## 8. File Reference Index

| File | Role |
|------|------|
| `C:\Users\Fares\Downloads\PMS\lib\actions\cursor.ts` | Cursor encode/decode utilities |
| `C:\Users\Fares\Downloads\PMS\lib\actions\types.ts` | `PaginatedResult<T>` type definition |
| `C:\Users\Fares\Downloads\PMS\lib\constants.ts` | `DEFAULT_PAGE_SIZE = 50`, `INBOX_PAGE_SIZE = 50` |
| `C:\Users\Fares\Downloads\PMS\hooks\use-load-more.ts` | Generic client-side load-more hook |
| `C:\Users\Fares\Downloads\PMS\components\ui\load-more-button.tsx` | LoadMoreButton UI component |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\projects\page.tsx` | Projects page (SSR + Suspense) |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\tasks\page.tsx` | Tasks page (SSR + Suspense) |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\clients\page.tsx` | Clients page (SSR + Suspense) |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\inbox\page.tsx` | Inbox page (SSR + Suspense) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\projects\crud.ts` | `getProjects()` with cursor pagination |
| `C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts` | `getTasks()`, `getMyTasks()` with cursor pagination |
| `C:\Users\Fares\Downloads\PMS\lib\actions\clients.ts` | `getClients()`, `getClientsWithProjectCounts()` |
| `C:\Users\Fares\Downloads\PMS\lib\actions\inbox.ts` | `getInboxItems()` with cursor pagination |
| `C:\Users\Fares\Downloads\PMS\components\projects-content.tsx` | Projects list client component |
| `C:\Users\Fares\Downloads\PMS\components\tasks\MyTasksPage.tsx` | Tasks list client component |
| `C:\Users\Fares\Downloads\PMS\components\clients-content.tsx` | Clients list client component |
| `C:\Users\Fares\Downloads\PMS\components\inbox\InboxContent.tsx` | Inbox list client component |
| `C:\Users\Fares\Downloads\PMS\hooks\realtime-context.tsx` | Pooled realtime subscriptions |
| `C:\Users\Fares\Downloads\PMS\hooks\use-realtime.ts` | Individual realtime hooks |
| `C:\Users\Fares\Downloads\PMS\lib\server-cache.ts` | Request-level cache wrappers |
| `C:\Users\Fares\Downloads\PMS\lib\cache\keys.ts` | KV cache keys and TTL definitions |
| `C:\Users\Fares\Downloads\PMS\lib\page-auth.ts` | Page-level auth + org resolution |
| `C:\Users\Fares\Downloads\PMS\lib\request-cache.ts` | Auth + Supabase client caching |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\projects\[id]\page.tsx` | Project detail (unbounded tasks) |

---

## 9. Conclusion

The cursor-based pagination implementation is architecturally correct and delivers substantial performance improvements for the primary bottleneck scenario: organizations with large datasets. The `limit + 1` pattern is efficiently implemented, the compound cursors guarantee uniqueness, and the Suspense streaming pattern ensures immediate visual feedback.

The two critical issues (clients page `useMemo` dependency bug and task page project reference incompleteness) should be addressed before considering the pagination feature complete. The recommended optimizations around RSC payload stripping, KV cache structure, and prefetching would further improve the user experience for data-heavy organizations.

The real-time + pagination interaction is handled reasonably well with deduplication guards and in-place updates. The identified edge cases (sort order divergence, unbounded client-side growth) are acceptable tradeoffs for the application's usage patterns but should be documented for future maintainers.
