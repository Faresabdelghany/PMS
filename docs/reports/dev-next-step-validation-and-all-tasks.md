# Dev Next Step — Phase 1 Production Validation + Tasks All Tasks

**Date:** 2026-03-01  
**Owner:** Dev Subagent

## Scope Completed

1. Reviewed and executed handoff docs in required order:
   - `specs/phase1-production-validation/spec.md`
   - `specs/phase1-production-validation/tasks.md`
   - `specs/tasks-page-all-tasks/spec.md`
   - `specs/tasks-page-all-tasks/tasks.md`
   - `docs/reports/product-analyst-next-step.md`
2. Implemented Tasks page `My` / `All` view toggle with URL param.
3. Ran build and lint checks.
4. Produced validation status report for Phase 1 production checklist.

---

## A) Phase 1 Production Validation (live PMS checklist)

### Environment constraints observed

- Live app URL is reachable (`/mission-control` redirects to `/login`), but this run had no authenticated production session.
- Runtime environment for this task did **not** expose Supabase service/admin env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` unavailable in shell), so direct DB validation and authenticated event pushes could not be executed from this run.

### What was validated now

#### Migration + RLS readiness (code-level verification)
Verified in `supabase/migrations/20260301000001_mission_control_gap_closure_phase1.sql`:
- Tables exist in migration:
  - `agent_sessions`
  - `scheduled_runs`
  - `retry_policies`
  - `retry_log`
  - `done_policies`
  - `done_check_results`
- RLS explicitly enabled on all above tables.
- Policies defined for org membership scoping on all above tables.
- `agents` table columns present in migration:
  - `heartbeat_interval_seconds`
  - `heartbeat_timeout_seconds`

#### Heartbeat protocol docs
- `HEARTBEAT.md` exists and matches implementation-level constants and endpoint contract.

#### Live route availability
- `https://pms-nine-gold.vercel.app/mission-control` is reachable and redirects to login (expected for unauthenticated access).

### Checklist status (this run)

- **Pass (verified by code/docs):** 1, 18 (policy table exists in migration), 24, 26
- **Blocked (needs authenticated live QA + DB/event access):** 2–17, 19–23, 25

### Recommended immediate follow-up to fully close validation

Run the existing checklist as an authenticated reviewer/dev session with service-role-enabled environment:
- Open live `/mission-control` and complete Live Ops + Calendar click/refresh checks.
- Push `task_failed` and `heartbeat` events to `/api/agent-events` (existing script: `scripts/push-event.ps1`).
- Confirm rows in `retry_log`, `done_check_results`, and `agent_sessions` in live DB.
- Capture evidence (screenshots/log snippets/query outputs) and append to this report.

---

## B) Tasks Page — Add `All Tasks` View

### Implemented

#### 1) Server action: `getAllTasks()`
**File:** `lib/actions/tasks/queries.ts`
- Added `getAllTasks(orgId, filters?, cursor?, limit?)`.
- Org-scoped via join filter: `project.organization_id = orgId`.
- Preserves RLS-based access control.
- Excludes subtasks: `parent_task_id IS NULL`.
- Supports filters: status, priority, assignee, workstream, search.
- Supports cursor pagination using existing `encodeCursor` / `decodeCursor` pattern.
- Added cached no-filter/no-cursor path similar to `getMyTasks`.

#### 2) Cache key support for org-wide task list
**Files:**
- `lib/cache/keys.ts`
- `lib/cache/invalidate.ts`
- `lib/actions/tasks/bulk.ts`

Changes:
- Added `CacheKeys.orgTasks(orgId)`.
- Included org-wide task key in task invalidation paths.
- Bulk updates now invalidate org-wide task cache as well.

#### 3) Tasks page server route view switch
**File:** `app/(dashboard)/tasks/page.tsx`
- Added `view` parsing from search params (`my|all`, default `my`).
- Uses `getAllTasks()` when `view=all`, else `getMyTasks()`.
- Passes `initialView` into client page.
- Added `key={view}` to force clean hydration/state swap when changing views.

#### 4) Client UI toggle + data loading behavior
**File:** `components/tasks/MyTasksPage.tsx`
- Added top toggle buttons: **My Tasks** / **All Tasks**.
- Toggle updates URL (`?view=all`; `my` removes param for clean default URL).
- `loadMore` path now calls `getAllTasks` or `getMyTasks` based on active view.
- Realtime behavior:
  - `my` view keeps assignee filter subscription.
  - `all` view subscribes broadly, then keeps only tasks from known org projects.
- Empty-state copy now adapts by active view.

### Security/permissions posture

- Org scoping retained through `projects!inner(... organization_id)` filtering.
- RLS remains the gatekeeper; no bypass added.
- No schema migration added.

---

## Verification Run Results

### Build
- `pnpm build` ✅ passed.

### Lint
- `pnpm lint` ❌ failed due to pre-existing repository lint errors outside this scope (not introduced by this change set), plus existing warnings in this file family.
- No build/type break introduced by the new functionality.

---

## Files Changed

- `app/(dashboard)/tasks/page.tsx`
- `components/tasks/MyTasksPage.tsx`
- `lib/actions/tasks/queries.ts`
- `lib/actions/tasks/index.ts`
- `lib/cache/keys.ts`
- `lib/cache/invalidate.ts`
- `lib/actions/tasks/bulk.ts`
- `docs/reports/dev-next-step-validation-and-all-tasks.md`

---

## Commit / Push

Not yet completed in this run.

Suggested commit message:
`feat(tasks): add org-wide all tasks view with ?view=my|all toggle + validation report`
