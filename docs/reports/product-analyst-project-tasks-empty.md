# Root Cause Analysis: Empty Task Lists on Tasks Page & Project Tasks Tab

**Date:** 2026-03-01  
**Severity:** High — core task visibility is broken  
**Status:** Analysis complete, ready for implementation

---

## Summary

Both the **Tasks page** (`/tasks`) and the **Project Details → Tasks tab** (`/projects/[id]`) can appear empty even when tasks exist in the database. There are **two distinct root causes** — one query-level, one UI-level.

---

## Root Cause 1: `getMyTasks` over-restricts agent-assigned tasks (Tasks Page — "My Tasks" view)

### Location
`lib/actions/tasks/queries.ts` — `getMyTasks()`, lines ~132 and ~165

### The Problem
The filter used is:
```sql
.or(`assignee_id.eq.${user.id},and(assigned_agent_id.not.is.null,created_by.eq.${user.id})`)
```

This means "My Tasks" shows:
1. Tasks where **I am the human assignee**, OR
2. Tasks where **an agent is assigned AND I created the task**

**What's missing:** Tasks assigned to an agent where the current user is a **project member** but did NOT create the task are invisible. If user A creates a task and assigns agent X, user B (same org, same project) will never see that task in "My Tasks" — and if they switch to "All Tasks", it works fine, but **the default view is "My Tasks"**.

### Impact
- The default landing on `/tasks` is the "My Tasks" view
- If most tasks are agent-assigned by other team members, the page appears empty
- Users don't realize they need to switch to "All Tasks" view

### Evidence
- `parseTasksView()` defaults to `"my"` — line 22 of `app/(dashboard)/tasks/page.tsx`
- The `getMyTasks` cached path and filtered path both use the same restrictive `.or()` clause

---

## Root Cause 2: `getTasks` (Project Tasks tab) works correctly at query level, but `projects!inner` join in `getMyTasks`/`getAllTasks` silently drops tasks

### Location
`lib/actions/tasks/queries.ts` — `getAllTasks()` and `getMyTasks()`

### The Problem
Both `getMyTasks` and `getAllTasks` use a `projects!inner` join:
```sql
project:projects!inner(id, name, organization_id)
```
combined with:
```sql
.eq("project.organization_id", orgId)
```

The `!inner` join means: if the join condition on `project.organization_id` doesn't match, **the entire task row is excluded from results**. This is correct for org-scoping, but it creates a silent failure mode:
- If `orgId` passed to the function doesn't match the project's actual `organization_id` (e.g., stale session, multi-org user viewing wrong org context), **all tasks disappear** with no error.

### The `getTasks` (project-scoped) function
Used by the Project Details page via `getCachedTasks(projectId)`. This function filters by `project_id` directly and does NOT use `projects!inner` — it uses a regular (left) join. **This is correct and should work.** If the Project Tasks tab is also empty, the issue is elsewhere (see Root Cause 3).

---

## Root Cause 3: Project Tasks tab receives data but UI defaults may hide it

### Location
`components/projects/ProjectDetailsPage.tsx` → `ProjectTasksTabLazy`

### The Problem
The Project Details page passes `tasks={tasks}` (from `getCachedTasks`) to `ProjectTasksTabLazy`. The `getCachedTasks` calls `getTasks(projectId)` which:
- Filters by `project_id` ✓
- Filters `parent_task_id IS NULL` (top-level only) ✓
- Orders by `sort_order` ✓
- Limits to 1000 ✓

If tasks exist for the project, they WILL be returned. If the tab appears empty, check:
1. **All tasks are subtasks** (`parent_task_id IS NOT NULL`) — they're filtered out as top-level
2. **Client-side filter state** — the `ProjectTasksTabLazy` component may have persistent filter chips that exclude all visible tasks
3. **Workstream filter** — if a workstream filter is active and no tasks belong to that workstream

---

## Root Cause 4: Cache staleness

### Location
`lib/actions/tasks/queries.ts` — `cacheGet()` calls in `getMyTasks` and `getAllTasks`

### The Problem
Both functions use `cacheGet()` with `CacheTTL.TASKS` for the unfiltered, uncursored case. If the cache was populated when there were no tasks (or during a transient error that returned empty), it will continue serving empty results until TTL expires.

The `getCachedTasks` in `lib/server-cache.ts` uses React's `cache()` (request-level dedup) — this is fine, it only caches within a single request.

---

## Data Flow Summary

```
/tasks page
  ├─ view=my (default) → getMyTasks(orgId)
  │    └─ BUG: .or() filter too restrictive for agent tasks
  │    └─ BUG: cacheGet may serve stale empty
  └─ view=all → getAllTasks(orgId)
       └─ OK: returns all org tasks (no assignee filter)
       └─ BUG: cacheGet may serve stale empty

/projects/[id] page → Tasks tab
  └─ getCachedTasks(projectId) → getTasks(projectId)
       └─ OK: project-scoped, no assignee filter
       └─ Potential: .is("parent_task_id", null) hides subtask-only projects
```

---

## RLS Verification

RLS policy on `tasks` table:
```sql
CREATE POLICY "Org members can view tasks" ON tasks FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
```

**This is correct** — any org member can view all tasks in their org's projects. RLS is NOT the cause.

---

## Recommendations

See `specs/project-tasks-empty-fix/spec.md` for the full fix specification and `specs/project-tasks-empty-fix/tasks.md` for implementation tasks.
