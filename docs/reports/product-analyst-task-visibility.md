# Task Visibility Issue — Analysis Report

**Date:** 2026-02-27  
**Reporter:** Fares  
**Issue:** Tasks created via Telegram/OpenClaw chat do not appear in PMS `/tasks` list.

---

## 1. Current Flow: Telegram → PMS

```
User texts Ziko (Telegram)
  → OpenClaw agent processes message
  → Agent calls POST /api/agent-events with event_type: "task_create"
  → Route handler inserts into `tasks` table via Supabase admin client
  → Returns { ok: true, task_id }
```

## 2. Root Cause Analysis

### Primary Cause: `assignee_id` is never set on agent-created tasks

The `/api/agent-events` route (line ~130) inserts tasks with:
- `assigned_agent_id` — the AI agent reference
- **No `assignee_id`** — the human user UUID field

The `/tasks` page calls `getMyTasks(orgId)` which queries:
```sql
SELECT * FROM tasks WHERE assignee_id = <current_user_id> AND ...
```

Since `assignee_id` is NULL on agent-created tasks, they are **invisible** to `getMyTasks`.

### Secondary Cause: No `status` field set explicitly

The agent-events insert sets `dispatch_status: "pending"` but does not set `status`. The DB default is presumably `"todo"` or similar, which shouldn't block visibility — but it's an implicit dependency.

### Contributing Factor: No `organization_id` scoping on task insert

The `getMyTasks` query joins `projects!inner` filtering by `project.organization_id = orgId`. If the agent supplies a valid `project_id` within the org, this is fine. But there's no validation in agent-events that the project belongs to the specified `org_id`.

### Additional Factor: No cache invalidation

`/api/agent-events` does NOT call `revalidatePath("/tasks")` or `invalidateCache.task(...)` after creating a task. Even if `assignee_id` were set, the cached response from `getMyTasks` (TTL-based via `cacheGet`) would serve stale data until the cache expires.

## 3. Summary of Gaps

| Gap | Location | Impact |
|-----|----------|--------|
| `assignee_id` not set | `/api/agent-events` POST handler | Tasks invisible in `/tasks` |
| No cache invalidation after insert | `/api/agent-events` POST handler | Stale task list even if assignee fixed |
| No org-project validation | `/api/agent-events` POST handler | Potential cross-org task creation |
| `status` not explicitly set | `/api/agent-events` POST handler | Relies on DB default |

## 4. What Works

- Task **is** inserted into the `tasks` table (confirmed by code path)
- Task appears in project-level views (`getTasks(projectId)`) if you navigate to the project
- Manual task creation via `createTask()` server action works correctly (sets `assignee_id`, invalidates cache)
