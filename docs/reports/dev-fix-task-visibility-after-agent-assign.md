# Dev Fix Report — Task Visibility After Agent Assign

**Date:** 2026-03-02  
**Scope:** Fix stale task visibility after create + agent dispatch, plus PageHeader heading semantics.

## Root Cause

The stale visibility issue was caused by two cache invalidation gaps:

1. `createTask` deferred invalidation inside `after(...)`, so the response returned before cache keys were cleared. Immediate navigation to `/tasks` could read stale KV data.
2. `dispatchTaskToAgent` invalidated only `revalidatePath("/tasks")` and did not invalidate KV task keys, so `orgTasks` / `projectTasks` (and user task cache for creator flows) could remain stale until TTL expiry.

## Changes Made

### 1) `lib/actions/tasks/mutations.ts`
- Moved task list invalidation for `createTask` from deferred `after(...)` to synchronous execution before returning.
- Synchronous invalidation now includes:
  - `revalidatePath(`/projects/${projectId}`)`
  - `revalidatePath("/tasks")`
  - `revalidateTag(CacheTags.projectDetails(projectId))`
  - `await invalidateCache.task({ projectId, assigneeId, orgId })`
  - `await invalidate.key(CacheKeys.userTasks(user.id, orgId))` when task is created with agent assignment
- Kept deferred `after(...)` for non-blocking side effects (activity + notifications).

### 2) `lib/actions/tasks-sprint3.ts`
- Updated `dispatchTaskToAgent` to perform KV-aware cache invalidation after task update + subscription:
  - `await invalidateCache.task({ taskId, projectId, assigneeId, orgId })`
  - `await invalidate.key(CacheKeys.userTasks(user.id, orgId))`
- This ensures immediate consistency for All/My/Project task list reads after dispatch in creator-dispatch flow.

### 3) `components/ui/page-header.tsx`
- Replaced title element from `<p>` to `<h1>` to restore heading semantics for accessibility and role-based tests.

## Validation

### Commands Run
1. `npx tsc --noEmit`
- Result: **PASS** (exit code 0)

2. `npm run build`
- Result: **FAIL** (exit code 1)
- Reason: environment could not fetch Google Fonts (`Geist`, `Geist Mono`) from `fonts.googleapis.com` during Next.js build. This is an external network/build-environment issue, not a TypeScript or task-action regression.

## Notes

- Changes are intentionally minimal and scoped to the reported bugs.
- No broader refactors were made.
