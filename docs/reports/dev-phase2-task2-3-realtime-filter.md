# Dev Report — Phase 2 Task 2.3: Realtime Org-Scoped Filter Hardening

Date: 2026-03-01

## Scope completed
Implemented Phase 2 / Task 2.3 for realtime org-scoped filtering in Tasks, including scalability hardening for Supabase `in` filter limits, defense-in-depth fallback retention, and verification tests.

## What changed

### 1) Server-side filtering for "All Tasks" realtime mode
- Updated `components/tasks/MyTasksPage.tsx` to use **org project-scoped realtime filters** in `currentView === "all"`.
- Instead of subscribing to unfiltered `tasks`, the page now builds project-scoped filter clauses:
  - `project_id=in.(...)`
  - chunked to avoid Supabase `in` clause limits.

### 2) Supabase `in` filter limit hardening (scalable fallback)
- Added `lib/realtime/task-org-filter.ts`:
  - `buildTaskProjectRealtimeFilters(projectIds, maxPerFilter=10)`
  - De-duplicates + sanitizes project IDs
  - Splits project IDs into chunks of 10 to avoid oversized realtime filters.
- Added `usePooledRealtimeMulti` in `hooks/realtime-context.tsx` to support subscribing to multiple filter chunks safely.

This avoids the reviewer-noted risk where a single `in` clause can break at larger org/project counts.

### 3) Defense-in-depth retained
- Kept client-side fallback isolation in `buildTaskWithRelations`:
  - task is dropped if its `project_id` is not in known org projects.
- Existing behavior in "My Tasks" remains unchanged:
  - still uses `assignee_id=eq.{userId}` server-side filter.

### 4) Correctness and isolation tests
- Added unit-style Playwright spec: `e2e/task-realtime-org-filter.unit.spec.ts`
  - verifies single filter generation (<=10)
  - verifies chunked filter generation (>10)
  - verifies org A/B scope isolation
  - verifies event-volume reduction vs unfiltered baseline (synthetic sample: 8 -> 4 events for org A, 50% reduction)

## Acceptance criteria mapping
- [x] "All" mode subscription uses server-side org filter
- [x] Client-side fallback remains active
- [x] "My Tasks" mode unaffected
- [x] Cross-org leakage test coverage added (org A/B isolation assertions)
- [x] Event volume reduced vs unfiltered baseline (measured in deterministic test fixture)

## Validation run

### Tests
- `npx playwright test e2e/task-realtime-org-filter.unit.spec.ts e2e/dod-runner.unit.spec.ts`
  - passed
- `npx playwright test e2e/task-realtime-org-filter.unit.spec.ts`
  - passed

### Type/build checks
- `npx tsc --noEmit`
  - passed
- `npm run build`
  - passed

## Files changed
- `components/tasks/MyTasksPage.tsx`
- `hooks/realtime-context.tsx`
- `lib/realtime/task-org-filter.ts` (new)
- `e2e/task-realtime-org-filter.unit.spec.ts` (new)

## Notes
- No DB migration required for this task because chunked `project_id` server-side filtering + pooled multi-subscription resolves the Supabase clause-size risk while preserving current schema.
