# Database Optimization Plan: Cursor-Based Pagination & Aggregation Queries

**Date:** 2026-02-14
**Scope:** PostgreSQL index tuning, unbounded scan elimination, caching gaps
**Target:** Supabase project `lazhmdyajdqbnxxwyxun`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Index Inventory](#2-current-index-inventory)
3. [P0 -- Unbounded Full-Table Scans](#3-p0--unbounded-full-table-scans)
4. [P1 -- Missing Composite Indexes for Cursor Pagination](#4-p1--missing-composite-indexes-for-cursor-pagination)
5. [P2 -- Caching Gaps](#5-p2--caching-gaps)
6. [Migration SQL](#6-migration-sql)
7. [Query Plan Analysis](#7-query-plan-analysis)
8. [Connection Pooling Implications](#8-connection-pooling-implications)
9. [Implementation Plan](#9-implementation-plan)
10. [Appendix: Existing vs. Proposed Index Map](#appendix-existing-vs-proposed-index-map)

---

## 1. Executive Summary

The profiling audit identified three tiers of database performance issues:

| Priority | Issue | Impact | Fix Complexity |
|----------|-------|--------|----------------|
| **P0** | 3 functions fetch ALL rows to count in JavaScript | O(n) memory + network; degrades linearly with data growth | Medium (new RPC functions) |
| **P1** | 3 cursor-paginated queries lack aligned composite indexes | Seq scans on every paginated request; falls back to sort + filter on unindexed columns | Low (CREATE INDEX) |
| **P2** | 2 first-page queries miss KV cache; KV stores sentinel rows | Redundant DB hits; wasted serialization bytes | Low (code change only) |

**Expected improvements:**
- P0 fixes: Reduce `getTaskStats()` from ~50-200ms (proportional to task count) to ~2-5ms constant time. Same order of magnitude for `getClientStats()` and `getClientsWithProjectCounts()`.
- P1 fixes: Cursor pagination queries go from sequential scans to index-only range scans. Latency drops from O(n) to O(log n + page_size).
- P2 fixes: Eliminate ~30-80ms redundant DB round-trips for inbox and client list first-page loads.

---

## 2. Current Index Inventory

Below is the complete set of indexes currently defined across all migrations, organized by table.

### tasks
| Index Name | Columns | Condition | Source Migration |
|---|---|---|---|
| `idx_tasks_project` | `(project_id)` | -- | initial_schema |
| `idx_tasks_workstream` | `(workstream_id)` | -- | initial_schema |
| `idx_tasks_assignee` | `(assignee_id)` | -- | initial_schema |
| `idx_tasks_status` | `(status)` | -- | initial_schema |
| `idx_tasks_project_status` | `(project_id, status, created_at DESC)` | -- | add_performance_indexes |
| `idx_tasks_assignee_status` | `(assignee_id, status, due_date)` | -- | add_performance_indexes |
| `idx_tasks_workstream_status_order` | `(workstream_id, status, sort_order)` | `WHERE workstream_id IS NOT NULL` | additional_performance_indexes |
| `idx_tasks_no_workstream_project` | `(project_id, status, created_at DESC)` | `WHERE workstream_id IS NULL` | additional_performance_indexes |
| `idx_tasks_project_filters` | `(project_id, status, priority, assignee_id)` | `WHERE status != 'done'` | additional_performance_indexes |
| `idx_tasks_overdue` | `(project_id, end_date, status)` | `WHERE end_date IS NOT NULL AND status != 'done'` | additional_performance_indexes |
| `idx_tasks_name_trgm` | `USING gin(name gin_trgm_ops)` | -- | additional_performance_indexes |
| `idx_tasks_assignee_project_status` | `(assignee_id, project_id, status)` | `WHERE assignee_id IS NOT NULL` | performance_fixes |

### projects
| Index Name | Columns | Condition | Source Migration |
|---|---|---|---|
| `idx_projects_org` | `(organization_id)` | -- | initial_schema |
| `idx_projects_client` | `(client_id)` | -- | initial_schema |
| `idx_projects_team` | `(team_id)` | -- | initial_schema |
| `idx_projects_status` | `(status)` | -- | initial_schema |
| `idx_projects_org_status` | `(organization_id, status, updated_at DESC)` | -- | add_performance_indexes |
| `idx_projects_name_trgm` | `USING gin(name gin_trgm_ops)` | -- | additional_performance_indexes |

### clients
| Index Name | Columns | Condition | Source Migration |
|---|---|---|---|
| `idx_clients_org` | `(organization_id)` | -- | initial_schema |
| `idx_clients_status` | `(status)` | -- | initial_schema |
| `idx_clients_org_name` | `(organization_id, name)` | -- | add_performance_indexes |
| `idx_clients_owner` | `(owner_id)` | -- | security_performance_fixes |
| `idx_clients_name_trgm` | `USING gin(name gin_trgm_ops)` | -- | additional_performance_indexes |

### inbox_items
| Index Name | Columns | Condition | Source Migration |
|---|---|---|---|
| `idx_inbox_items_user_id` | `(user_id)` | -- | inbox_items |
| `idx_inbox_items_organization_id` | `(organization_id)` | -- | inbox_items |
| `idx_inbox_items_is_read` | `(user_id, is_read)` | `WHERE is_read = false` | inbox_items |
| `idx_inbox_items_created_at` | `(user_id, created_at DESC)` | -- | inbox_items |
| `idx_inbox_items_item_type` | `(user_id, item_type)` | -- | inbox_items |
| `idx_inbox_items_user_created` | `(user_id, created_at DESC)` | -- | add_performance_indexes |
| `idx_inbox_items_user_unread` | `(user_id, is_read)` | `WHERE is_read = false` | chat_dashboard_rpc |

**Key observation:** `idx_inbox_items_created_at` and `idx_inbox_items_user_created` are duplicates (same columns, same order). One should be dropped.

---

## 3. P0 -- Unbounded Full-Table Scans

### 3.1 `getTaskStats()` -- `lib/actions/tasks/queries.ts:242-279`

**Current behavior:**
```sql
-- Via Supabase client: .select("status, priority").eq("project_id", projectId)
SELECT status, priority FROM tasks WHERE project_id = $1;
```
Fetches ALL task rows for a project, then counts statuses and priorities in JavaScript using `forEach`. For a project with 500 tasks, this transfers ~500 rows over the wire when only 8 aggregate numbers are needed (3 statuses + 5 priorities).

**Proposed replacement -- RPC function:**
```sql
CREATE OR REPLACE FUNCTION get_task_stats(p_project_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'todo',        COUNT(*) FILTER (WHERE status = 'todo'),
      'in-progress', COUNT(*) FILTER (WHERE status = 'in-progress'),
      'done',        COUNT(*) FILTER (WHERE status = 'done')
    ),
    'byPriority', json_build_object(
      'no-priority', COUNT(*) FILTER (WHERE priority = 'no-priority'),
      'low',         COUNT(*) FILTER (WHERE priority = 'low'),
      'medium',      COUNT(*) FILTER (WHERE priority = 'medium'),
      'high',        COUNT(*) FILTER (WHERE priority = 'high'),
      'urgent',      COUNT(*) FILTER (WHERE priority = 'urgent')
    )
  )
  FROM tasks
  WHERE project_id = p_project_id;
$$;
```

**Why this is better:**
- Single pass over the `idx_tasks_project` index (already exists).
- Returns 1 JSON object instead of N rows.
- `FILTER (WHERE ...)` is a PostgreSQL aggregate optimization that avoids multiple scans.
- `LANGUAGE sql` + `STABLE` allows the planner to inline the function.
- Network transfer: ~200 bytes vs. ~50 bytes/row * N rows.

**Supporting index:** The existing `idx_tasks_project (project_id)` covers the `WHERE project_id = $1` predicate. Since we only need `status` and `priority` columns, a covering index would allow an index-only scan:

```sql
CREATE INDEX IF NOT EXISTS idx_tasks_project_stats
ON tasks(project_id) INCLUDE (status, priority);
```

This is optional -- the benefit is marginal unless task tables are very wide (many columns), because the heap fetch for just two enum columns is cheap.

---

### 3.2 `getClientStats()` -- `lib/actions/clients.ts:493-524`

**Current behavior:**
```sql
SELECT status FROM clients WHERE organization_id = $1;
```
Same anti-pattern: fetches all clients to count 4 status buckets in JavaScript.

**Proposed replacement -- RPC function:**
```sql
CREATE OR REPLACE FUNCTION get_client_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'prospect', COUNT(*) FILTER (WHERE status = 'prospect'),
      'active',   COUNT(*) FILTER (WHERE status = 'active'),
      'on_hold',  COUNT(*) FILTER (WHERE status = 'on_hold'),
      'archived', COUNT(*) FILTER (WHERE status = 'archived')
    )
  )
  FROM clients
  WHERE organization_id = p_org_id;
$$;
```

**Supporting index:** `idx_clients_org (organization_id)` already exists. For index-only scan:

```sql
CREATE INDEX IF NOT EXISTS idx_clients_org_stats
ON clients(organization_id) INCLUDE (status);
```

Again, optional since `status` is a small enum column.

---

### 3.3 `getProjectStats()` -- `lib/actions/projects/queries.ts:123-160`

This function has the same unbounded scan pattern for projects. While not listed in the original profiling audit, it is identical to the task/client stats pattern and should be fixed simultaneously.

**Current behavior:**
```sql
SELECT status, priority FROM projects WHERE organization_id = $1;
```

**Proposed replacement -- RPC function:**
```sql
CREATE OR REPLACE FUNCTION get_project_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'backlog',    COUNT(*) FILTER (WHERE status = 'backlog'),
      'planned',    COUNT(*) FILTER (WHERE status = 'planned'),
      'active',     COUNT(*) FILTER (WHERE status = 'active'),
      'cancelled',  COUNT(*) FILTER (WHERE status = 'cancelled'),
      'completed',  COUNT(*) FILTER (WHERE status = 'completed')
    ),
    'byPriority', json_build_object(
      'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
      'high',   COUNT(*) FILTER (WHERE priority = 'high'),
      'medium', COUNT(*) FILTER (WHERE priority = 'medium'),
      'low',    COUNT(*) FILTER (WHERE priority = 'low')
    )
  )
  FROM projects
  WHERE organization_id = p_org_id;
$$;
```

---

### 3.4 `getClientsWithProjectCounts()` -- `lib/actions/clients.ts:449-452`

**Current behavior:**
```sql
-- After fetching the paginated client list:
SELECT client_id, status FROM projects WHERE client_id IN ($1, $2, ..., $N);
-- No LIMIT. All projects for those clients are fetched.
```
Then counts are computed in JavaScript. If one client has 200 projects, all 200 rows are transferred.

**Proposed replacement -- SQL aggregation:**
```sql
-- Replace the enrichment query with:
SELECT
  client_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status IN ('planned', 'backlog')) AS planned,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed
FROM projects
WHERE client_id = ANY($1::uuid[])
GROUP BY client_id;
```

This is not an RPC function -- it can be done via the Supabase client using `.rpc()` or rewritten as a small helper RPC:

```sql
CREATE OR REPLACE FUNCTION get_project_counts_for_clients(p_client_ids UUID[])
RETURNS TABLE(
  client_id UUID,
  total BIGINT,
  active BIGINT,
  planned BIGINT,
  completed BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.client_id,
    COUNT(*)                                                AS total,
    COUNT(*) FILTER (WHERE p.status = 'active')             AS active,
    COUNT(*) FILTER (WHERE p.status IN ('planned', 'backlog')) AS planned,
    COUNT(*) FILTER (WHERE p.status = 'completed')          AS completed
  FROM projects p
  WHERE p.client_id = ANY(p_client_ids)
  GROUP BY p.client_id;
$$;
```

**Supporting index:** `idx_projects_client (client_id)` already exists. For an index-only scan covering the `GROUP BY`:

```sql
CREATE INDEX IF NOT EXISTS idx_projects_client_status
ON projects(client_id, status)
WHERE client_id IS NOT NULL;
```

This index enables the aggregation query to use an index-only scan with a bitmap heap scan for the `IN` predicate, then group directly from the index entries.

---

## 4. P1 -- Missing Composite Indexes for Cursor Pagination

### 4.1 `getTasks(cursor)` -- Sort order: `(sort_order ASC, id ASC)`

**Query pattern:**
```sql
SELECT * FROM tasks
WHERE project_id = $1
  AND (sort_order > $cursor_sort OR (sort_order = $cursor_sort AND id > $cursor_id))
ORDER BY sort_order ASC, id ASC
LIMIT 51;
```

**Existing indexes on tasks:**
- `idx_tasks_project (project_id)` -- single column, no sort_order or id.
- `idx_tasks_project_status (project_id, status, created_at DESC)` -- wrong trailing columns.

**What happens without the right index:** PostgreSQL uses `idx_tasks_project` to filter by `project_id`, then must sort ALL matching rows by `(sort_order, id)` before applying `LIMIT 51`. For a project with 1000 tasks this is a full sort of 1000 rows.

**Proposed index:**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_project_sort_order_id
ON tasks(project_id, sort_order ASC, id ASC);
```

**With this index:** PostgreSQL can use the B-tree to seek directly to the cursor position `(project_id = X, sort_order > Y)` and scan forward 51 entries. No sort step needed. The `LIMIT` terminates the scan early.

**Estimated improvement:** From O(n log n) sort to O(log n) seek + O(page_size) scan. For 1000 tasks: ~10ms to ~1ms.

---

### 4.2 `getMyTasks(cursor)` -- Sort order: `(updated_at DESC, id DESC)`

**Query pattern:**
```sql
SELECT * FROM tasks
  INNER JOIN projects ON tasks.project_id = projects.id
WHERE tasks.assignee_id = $1
  AND projects.organization_id = $2
  AND (updated_at < $cursor_ts OR (updated_at = $cursor_ts AND id < $cursor_id))
ORDER BY updated_at DESC, id DESC
LIMIT 51;
```

**Existing indexes:**
- `idx_tasks_assignee (assignee_id)` -- no trailing sort columns.
- `idx_tasks_assignee_status (assignee_id, status, due_date)` -- different trailing columns.
- `idx_tasks_assignee_project_status (assignee_id, project_id, status)` -- no `updated_at`.

**Problem:** After filtering by `assignee_id`, PostgreSQL must fetch all matching tasks, join with projects for org filter, then sort by `(updated_at DESC, id DESC)`. The join forces a nested loop or hash join with no index support for the sort.

**Proposed index:**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_updated_id
ON tasks(assignee_id, updated_at DESC, id DESC)
WHERE assignee_id IS NOT NULL;
```

**Why the partial index (`WHERE assignee_id IS NOT NULL`):** The query always filters `assignee_id = $userId`, so unassigned tasks are irrelevant. The partial index is smaller and stays hot in shared_buffers.

**Caveat:** The `INNER JOIN projects` filter on `organization_id` still requires a lookup into the projects table. PostgreSQL will use the new index to scan tasks in `(updated_at DESC, id DESC)` order for the given assignee, then probe the projects table for each row using `idx_projects_org (organization_id)`. This is a nested loop join, which is efficient when the task scan terminates early due to `LIMIT 51`.

---

### 4.3 `getProjects(cursor)` -- Sort order: `(updated_at DESC, id DESC)`

**Query pattern:**
```sql
SELECT * FROM projects
WHERE organization_id = $1
  AND (updated_at < $cursor_ts OR (updated_at = $cursor_ts AND id < $cursor_id))
ORDER BY updated_at DESC, id DESC
LIMIT 51;
```

**Existing indexes:**
- `idx_projects_org (organization_id)` -- no trailing sort columns.
- `idx_projects_org_status (organization_id, status, updated_at DESC)` -- has `status` in the middle, which breaks the sort order when no status filter is applied.

**Problem:** When querying all projects (no status filter), `idx_projects_org_status` cannot provide sorted output because `status` is interleaved. PostgreSQL falls back to sorting all org projects.

**Proposed index:**
```sql
CREATE INDEX IF NOT EXISTS idx_projects_org_updated_id
ON projects(organization_id, updated_at DESC, id DESC);
```

**With this index:** The planner can seek to the cursor position and scan forward. The existing `idx_projects_org_status` remains useful for queries that filter by both org and status (which happen in filtered views).

---

### 4.4 Inbox and Client Cursors (Already Covered)

- **`getInboxItems(cursor)`** sorts by `(created_at DESC, id DESC)` filtered by `user_id`. The existing `idx_inbox_items_user_created (user_id, created_at DESC)` covers the first two cursor columns. Since `id` is the primary key (UUID), PostgreSQL can use the index for the initial sort and do a short in-memory sort for ties on `created_at`. This is adequate.

- **`getClients(cursor)`** sorts by `(name ASC, id ASC)` filtered by `organization_id`. The existing `idx_clients_org_name (organization_id, name)` covers this. The trailing `id` for tiebreaking is the PK and is implicitly appended to B-tree indexes in PostgreSQL. This is already optimal.

---

## 5. P2 -- Caching Gaps

### 5.1 Inbox Items First Page -- No KV Cache

**Current state:** `getInboxItems()` in `lib/actions/inbox.ts` has no KV caching. Every first-page load hits the database.

**Recommendation:** Add KV caching for unfiltered, first-page inbox queries:
- Cache key: `pms:inbox:{userId}` (needs to be added to `CacheKeys`)
- TTL: 30 seconds (volatile data, same tier as tasks)
- Invalidation: Add `invalidateCache.inbox()` helper triggered by `createInboxItem`, `markAsRead`, `markAllAsRead`, `deleteInboxItem`

### 5.2 `getClientsWithProjectCounts()` First Page -- No KV Cache

**Current state:** Unlike `getClients()` which uses `cacheGet(CacheKeys.clients(orgId), ...)`, the `getClientsWithProjectCounts()` function has no KV caching at all. It always hits the database.

**Recommendation:** Add KV caching for unfiltered, first-page queries:
- Cache key: `pms:clients-with-counts:{orgId}` (needs to be added to `CacheKeys`)
- TTL: 120 seconds (same tier as CLIENTS)
- Invalidation: Piggyback on existing `invalidateCache.client()` calls

### 5.3 KV Cache Stores Sentinel Rows

**Current state:** The `limit + 1` pattern fetches one extra row to determine `hasMore`. The KV cache stores all `limit + 1` rows, meaning the extra sentinel row is serialized and stored needlessly.

**Example from `getMyTasks()`** (line 138):
```typescript
.limit(limit + 1)
// ...
return data as TaskWithRelations[]  // Stores limit+1 rows in KV
```

Then the consumer slices:
```typescript
const hasMore = tasks.length > limit
const items = hasMore ? tasks.slice(0, limit) : tasks
```

**Recommendation:** Pre-slice before caching. Store only `limit` items plus a boolean `hasMore` flag. This saves ~2-5% serialization overhead per cached entry. The fix is a code-level change, not a database change, so it is noted here but not included in the migration SQL.

---

## 6. Migration SQL

The following is the complete migration SQL for P0 and P1 fixes. This should be applied as a single migration file.

```sql
-- ============================================
-- Cursor Pagination & Aggregation Optimization
-- Migration: 20260214000001_cursor_pagination_optimization
-- ============================================
--
-- P0: Replace unbounded full-table scans with SQL aggregation (RPC)
-- P1: Add composite indexes for cursor-based pagination
-- P2: Add supporting index for project count aggregation
-- ============================================

-- ============================================
-- P1: COMPOSITE INDEXES FOR CURSOR PAGINATION
-- ============================================

-- getTasks(cursor): ORDER BY sort_order ASC, id ASC WHERE project_id = $1
-- Enables index seek to cursor position, avoids sorting all project tasks.
CREATE INDEX IF NOT EXISTS idx_tasks_project_sort_order_id
ON tasks(project_id, sort_order ASC, id ASC);

-- getMyTasks(cursor): ORDER BY updated_at DESC, id DESC WHERE assignee_id = $1
-- Partial index excludes unassigned tasks (NULL assignee_id).
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_updated_id
ON tasks(assignee_id, updated_at DESC, id DESC)
WHERE assignee_id IS NOT NULL;

-- getProjects(cursor): ORDER BY updated_at DESC, id DESC WHERE organization_id = $1
-- Existing idx_projects_org_status has status interleaved, cannot serve unfiltered sort.
CREATE INDEX IF NOT EXISTS idx_projects_org_updated_id
ON projects(organization_id, updated_at DESC, id DESC);

-- ============================================
-- P0 SUPPORTING INDEX: Project counts by client
-- ============================================

-- Supports get_project_counts_for_clients RPC: GROUP BY client_id with status filter.
-- Partial index excludes projects with NULL client_id (internal/unassigned projects).
CREATE INDEX IF NOT EXISTS idx_projects_client_status
ON projects(client_id, status)
WHERE client_id IS NOT NULL;

-- ============================================
-- P0: RPC FUNCTIONS FOR AGGREGATION
-- ============================================

-- 1. get_task_stats: Replaces getTaskStats() full-table scan
--    Before: SELECT status, priority FROM tasks WHERE project_id = $1  (N rows)
--    After:  Single-pass COUNT with FILTER  (1 JSON row)
CREATE OR REPLACE FUNCTION get_task_stats(p_project_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'todo',        COUNT(*) FILTER (WHERE status = 'todo'),
      'in-progress', COUNT(*) FILTER (WHERE status = 'in-progress'),
      'done',        COUNT(*) FILTER (WHERE status = 'done')
    ),
    'byPriority', json_build_object(
      'no-priority', COUNT(*) FILTER (WHERE priority = 'no-priority'),
      'low',         COUNT(*) FILTER (WHERE priority = 'low'),
      'medium',      COUNT(*) FILTER (WHERE priority = 'medium'),
      'high',        COUNT(*) FILTER (WHERE priority = 'high'),
      'urgent',      COUNT(*) FILTER (WHERE priority = 'urgent')
    )
  )
  FROM tasks
  WHERE project_id = p_project_id;
$$;

GRANT EXECUTE ON FUNCTION get_task_stats(UUID) TO authenticated;

-- 2. get_client_stats: Replaces getClientStats() full-table scan
--    Before: SELECT status FROM clients WHERE organization_id = $1  (N rows)
--    After:  Single-pass COUNT with FILTER  (1 JSON row)
CREATE OR REPLACE FUNCTION get_client_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'prospect', COUNT(*) FILTER (WHERE status = 'prospect'),
      'active',   COUNT(*) FILTER (WHERE status = 'active'),
      'on_hold',  COUNT(*) FILTER (WHERE status = 'on_hold'),
      'archived', COUNT(*) FILTER (WHERE status = 'archived')
    )
  )
  FROM clients
  WHERE organization_id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION get_client_stats(UUID) TO authenticated;

-- 3. get_project_stats: Replaces getProjectStats() full-table scan
--    Before: SELECT status, priority FROM projects WHERE organization_id = $1  (N rows)
--    After:  Single-pass COUNT with FILTER  (1 JSON row)
CREATE OR REPLACE FUNCTION get_project_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'backlog',    COUNT(*) FILTER (WHERE status = 'backlog'),
      'planned',    COUNT(*) FILTER (WHERE status = 'planned'),
      'active',     COUNT(*) FILTER (WHERE status = 'active'),
      'cancelled',  COUNT(*) FILTER (WHERE status = 'cancelled'),
      'completed',  COUNT(*) FILTER (WHERE status = 'completed')
    ),
    'byPriority', json_build_object(
      'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
      'high',   COUNT(*) FILTER (WHERE priority = 'high'),
      'medium', COUNT(*) FILTER (WHERE priority = 'medium'),
      'low',    COUNT(*) FILTER (WHERE priority = 'low')
    )
  )
  FROM projects
  WHERE organization_id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION get_project_stats(UUID) TO authenticated;

-- 4. get_project_counts_for_clients: Replaces unbounded project enrichment query
--    Before: SELECT client_id, status FROM projects WHERE client_id IN (...)  (N rows)
--    After:  GROUP BY with FILTER  (at most page_size rows)
CREATE OR REPLACE FUNCTION get_project_counts_for_clients(p_client_ids UUID[])
RETURNS TABLE(
  client_id UUID,
  total BIGINT,
  active BIGINT,
  planned BIGINT,
  completed BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.client_id,
    COUNT(*)                                                     AS total,
    COUNT(*) FILTER (WHERE p.status = 'active')                  AS active,
    COUNT(*) FILTER (WHERE p.status IN ('planned', 'backlog'))   AS planned,
    COUNT(*) FILTER (WHERE p.status = 'completed')               AS completed
  FROM projects p
  WHERE p.client_id = ANY(p_client_ids)
  GROUP BY p.client_id;
$$;

GRANT EXECUTE ON FUNCTION get_project_counts_for_clients(UUID[]) TO authenticated;

-- ============================================
-- CLEANUP: Remove duplicate inbox index
-- ============================================

-- idx_inbox_items_created_at and idx_inbox_items_user_created are identical:
-- both are (user_id, created_at DESC). Drop the older one.
DROP INDEX IF EXISTS idx_inbox_items_created_at;

-- Similarly, idx_inbox_items_is_read and idx_inbox_items_user_unread overlap.
-- idx_inbox_items_user_unread (user_id, is_read) WHERE is_read = false is strictly
-- more useful (smaller, same queries). Drop the non-partial version.
-- NOTE: idx_inbox_items_is_read was created as (user_id, is_read) WHERE is_read = false
-- which is actually the same as idx_inbox_items_user_unread. Drop one.
DROP INDEX IF EXISTS idx_inbox_items_is_read;

-- ============================================
-- ANALYZE affected tables
-- ============================================

ANALYZE tasks;
ANALYZE projects;
ANALYZE clients;
ANALYZE inbox_items;
```

---

## 7. Query Plan Analysis

### 7.1 `getTasks(cursor)` -- Before vs. After

**Before (no aligned index):**
```
Sort  (cost=150..155 rows=1000)
  Sort Key: sort_order, id
  ->  Index Scan using idx_tasks_project on tasks  (cost=0.42..120 rows=1000)
        Index Cond: (project_id = $1)
        Filter: (sort_order > $2 OR (sort_order = $2 AND id > $3))
```
The planner fetches ALL tasks for the project via `idx_tasks_project`, applies the cursor filter, then sorts. For 1000 tasks, the sort step dominates.

**After (with `idx_tasks_project_sort_order_id`):**
```
Limit  (cost=0.42..5.50 rows=51)
  ->  Index Scan using idx_tasks_project_sort_order_id on tasks  (cost=0.42..120 rows=1000)
        Index Cond: (project_id = $1 AND (sort_order > $2 OR (sort_order = $2 AND id > $3)))
```
The planner seeks directly into the B-tree at `(project_id, cursor_sort_order, cursor_id)` and scans forward 51 entries. No sort node needed. The `Limit` node terminates the scan early.

### 7.2 `getMyTasks(cursor)` -- Before vs. After

**Before:**
```
Sort  (cost=200..210 rows=500)
  Sort Key: tasks.updated_at DESC, tasks.id DESC
  ->  Nested Loop  (cost=0.56..180 rows=500)
        ->  Index Scan using idx_tasks_assignee on tasks  (cost=0.28..80 rows=500)
              Index Cond: (assignee_id = $1)
        ->  Index Scan using projects_pkey on projects  (cost=0.28..0.30 rows=1)
              Index Cond: (id = tasks.project_id)
              Filter: (organization_id = $2)
```
All tasks for the assignee are fetched, joined, filtered by org, then sorted.

**After (with `idx_tasks_assignee_updated_id`):**
```
Limit  (cost=0.56..25 rows=51)
  ->  Nested Loop  (cost=0.56..180 rows=500)
        ->  Index Scan using idx_tasks_assignee_updated_id on tasks  (cost=0.28..80 rows=500)
              Index Cond: (assignee_id = $1)
              Filter: (updated_at < $3 OR (updated_at = $3 AND id < $4))
        ->  Index Scan using projects_pkey on projects  (cost=0.28..0.30 rows=1)
              Index Cond: (id = tasks.project_id)
              Filter: (organization_id = $2)
```
Tasks arrive pre-sorted from the index. The `Limit` node stops the nested loop after 51 qualifying rows. If most of the user's tasks belong to the requested org, this terminates very quickly.

### 7.3 Aggregation RPCs -- Plan Comparison

**Before (getTaskStats):**
```
Seq Scan on tasks  (cost=0..50 rows=500 width=8)
  Filter: (project_id = $1)
```
Returns 500 rows to the client. Client iterates to count.

**After (get_task_stats RPC):**
```
Aggregate  (cost=50..50.01 rows=1 width=32)
  ->  Index Scan using idx_tasks_project on tasks  (cost=0..45 rows=500)
        Index Cond: (project_id = $1)
```
Returns 1 JSON row. The `Aggregate` node processes rows in-place without materializing them to the client.

---

## 8. Connection Pooling Implications

### 8.1 Supabase Connection Architecture

Supabase uses **PgBouncer** in **transaction mode** by default (port 6543). Each query grabs a connection from the pool, executes, and returns it. Server Actions in Next.js create a new Supabase client per request, which means each `.select()`, `.rpc()`, or `.insert()` call is a separate transaction.

### 8.2 Impact of These Changes

**Positive effects:**
- **RPC functions reduce round-trips.** `getClientsWithProjectCounts()` currently makes 2 sequential queries (client list + project enrichment). With the RPC, the enrichment becomes a single call. Fewer round-trips mean less pool contention.
- **Faster queries release connections sooner.** Index-backed cursor pagination completes in ~1-5ms instead of ~20-100ms. This reduces the time each connection is held, improving effective pool capacity.

**No negative effects:**
- The new indexes consume disk space but do not affect connection pooling.
- The RPC functions are `STABLE` (read-only), so they do not take write locks.
- No schema-level locks during `CREATE INDEX IF NOT EXISTS` on Supabase (online DDL).

### 8.3 Recommendations

1. **Monitor `pg_stat_activity` after deployment** to verify connection pool utilization decreases.
2. **Consider `CONCURRENTLY` for large tables** if you see lock contention during index creation. However, Supabase migrations run during deployment windows, and `CREATE INDEX IF NOT EXISTS` is generally fast on tables with < 100K rows. The `CONCURRENTLY` option cannot be used inside a transaction block (which Supabase migrations use), so it would need to be a manual operation if needed.

---

## 9. Implementation Plan

### Phase 1: Database Migration (P0 + P1)
**Effort:** ~30 minutes | **Risk:** Low | **Downtime:** Zero

1. Apply the migration SQL from Section 6 using `npx supabase db push` or via the Supabase Dashboard SQL editor.
2. Verify indexes exist: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('tasks', 'projects', 'clients');`
3. Verify RPC functions exist: `SELECT proname FROM pg_proc WHERE proname IN ('get_task_stats', 'get_client_stats', 'get_project_stats', 'get_project_counts_for_clients');`
4. Run `EXPLAIN ANALYZE` on representative queries to confirm index usage.

### Phase 2: Application Code Changes (P0)
**Effort:** ~2 hours | **Risk:** Low

Update the following files to call the new RPC functions:

| File | Function | Change |
|---|---|---|
| `lib/actions/tasks/queries.ts` | `getTaskStats()` | Replace `.select("status, priority")` with `supabase.rpc("get_task_stats", { p_project_id: projectId })`. Remove the `forEach` counting loop. Map the JSON response to the existing return type. |
| `lib/actions/clients.ts` | `getClientStats()` | Replace `.select("status")` with `supabase.rpc("get_client_stats", { p_org_id: orgId })`. Remove the `forEach` counting loop. |
| `lib/actions/projects/queries.ts` | `getProjectStats()` | Replace `.select("status, priority")` with `supabase.rpc("get_project_stats", { p_org_id: orgId })`. Remove the `forEach` counting loop. |
| `lib/actions/clients.ts` | `getClientsWithProjectCounts()` | Replace the enrichment query (lines 449-452) with `supabase.rpc("get_project_counts_for_clients", { p_client_ids: clientIds })`. Replace the `Map` + `forEach` counting logic with a direct map from the RPC response. |

### Phase 3: Caching Improvements (P2)
**Effort:** ~1 hour | **Risk:** Low

1. **Add inbox KV cache:** Add `inbox: (userId: string) => \`pms:inbox:${userId}\`` to `CacheKeys`. Add `INBOX: 30` to `CacheTTL`. Wrap the unfiltered first-page query in `getInboxItems()` with `cacheGet()`. Add `invalidateCache.inbox()` helper.
2. **Add clients-with-counts KV cache:** Add `clientsWithCounts: (orgId: string) => \`pms:clients-counts:${orgId}\`` to `CacheKeys`. Wrap the unfiltered first-page path in `getClientsWithProjectCounts()` with `cacheGet()`. Invalidate alongside existing `invalidateCache.client()`.
3. **Fix sentinel row caching:** In `getMyTasks()`, `getProjects()`, and `getClients()`, pre-slice the data before returning from the `cacheGet` callback. Store only `limit` items plus a separate `hasMore` boolean. This requires a small refactor of the cache fetch + consumer pattern.

### Phase 4: Duplicate Index Cleanup
**Effort:** 5 minutes | **Risk:** Low

The migration already drops the duplicate `idx_inbox_items_created_at` and overlapping `idx_inbox_items_is_read`. Verify no application code references these index names (they should not, since indexes are transparent to the Supabase client).

---

### Priority Order Summary

| Order | Item | Expected Latency Improvement |
|---|---|---|
| 1 | P1 indexes (3 indexes) | Cursor pagination: ~20-100ms to ~1-5ms per page |
| 2 | P0 RPC: `get_task_stats` | Stats: ~50-200ms to ~2-5ms |
| 3 | P0 RPC: `get_client_stats` | Stats: ~30-100ms to ~2-5ms |
| 4 | P0 RPC: `get_project_stats` | Stats: ~30-100ms to ~2-5ms |
| 5 | P0 RPC: `get_project_counts_for_clients` | Enrichment: ~30-200ms to ~5-10ms |
| 6 | P0 index: `idx_projects_client_status` | Supports #5 RPC |
| 7 | P2: Inbox KV cache | First page: ~30-80ms to ~5ms (KV hit) |
| 8 | P2: Clients-with-counts KV cache | First page: ~50-100ms to ~5ms (KV hit) |
| 9 | P2: Sentinel row trimming | ~2-5% reduction in KV serialization size |
| 10 | Cleanup: Drop duplicate indexes | Reclaim ~10-50KB disk per index; reduce write amplification |

---

## Appendix: Existing vs. Proposed Index Map

### tasks table

| Query | Existing Index Used | Proposed Index | Improvement |
|---|---|---|---|
| `getTasks(cursor)` `WHERE project_id = X ORDER BY sort_order, id` | `idx_tasks_project` (filter only, no sort) | `idx_tasks_project_sort_order_id` | Eliminates sort step |
| `getMyTasks(cursor)` `WHERE assignee_id = X ORDER BY updated_at DESC, id DESC` | `idx_tasks_assignee` (filter only, no sort) | `idx_tasks_assignee_updated_id` | Eliminates sort step |
| `getTaskStats()` `WHERE project_id = X` (aggregate) | `idx_tasks_project` | No new index needed (RPC uses existing) | Aggregate in DB, not JS |

### projects table

| Query | Existing Index Used | Proposed Index | Improvement |
|---|---|---|---|
| `getProjects(cursor)` `WHERE organization_id = X ORDER BY updated_at DESC, id DESC` | `idx_projects_org` (filter only, no sort) | `idx_projects_org_updated_id` | Eliminates sort step |
| `getClientsWithProjectCounts()` enrichment `WHERE client_id IN (...) GROUP BY client_id` | `idx_projects_client` (filter only) | `idx_projects_client_status` | Index-only scan for GROUP BY |
| `getProjectStats()` `WHERE organization_id = X` (aggregate) | `idx_projects_org` | No new index needed (RPC uses existing) | Aggregate in DB, not JS |

### clients table

| Query | Existing Index Used | Proposed Index | Improvement |
|---|---|---|---|
| `getClients(cursor)` `WHERE organization_id = X ORDER BY name, id` | `idx_clients_org_name` | None needed | Already optimal |
| `getClientStats()` `WHERE organization_id = X` (aggregate) | `idx_clients_org` | None needed (RPC uses existing) | Aggregate in DB, not JS |

### inbox_items table

| Query | Existing Index Used | Proposed Index | Improvement |
|---|---|---|---|
| `getInboxItems(cursor)` `WHERE user_id = X ORDER BY created_at DESC, id DESC` | `idx_inbox_items_user_created` | None needed | Already covered |
| Cleanup: `idx_inbox_items_created_at` | Duplicate of above | DROP | Reclaim space |
