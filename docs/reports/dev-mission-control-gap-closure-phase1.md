# Dev Report: Mission Control Gap Closure (Phase 1 MVP)

Date: 2026-03-01  
Branch: `main`

## Scope Implemented (Phase 1 only)

Implemented the following P1 items from:
- `specs/mission-control-gap-closure/spec.md`
- `specs/mission-control-gap-closure/plan.md`
- `specs/mission-control-gap-closure/tasks.md`
- `docs/reports/product-analyst-mission-control-gap-closure.md`

### 1) Live Ops Panel (polling, no websocket)
- Added `/mission-control` dashboard route with tabs for:
  - Live Ops (`Now Playing`, `Queue`, `Blockers`)
  - Agent Calendar (week view)
- Added 5-second polling in client (`setInterval`) with server actions:
  - `getLiveOpsSnapshot`
  - `getAgentCalendarWeek`
- Added status badges and click-through links to task detail (`/tasks?task=...`)

### 2) Agent Calendar week view (read-only)
- Added week-based scheduled run view with status indicators:
  - ✅ success, ❌ failed, ⏭ skipped, 🔄 running, ⏳ pending
- Read-only by design for P1 (no trigger/pause/resume actions)

### 3) Auto Retry/Recovery basics
- Added retry core logic (fixed backoff + max attempts)
- Added retry service integration on `task_failed` agent event:
  - Writes attempts to `retry_log`
  - Reads policy from `retry_policies` (fallback defaults if missing)
  - Schedules retry metadata (`next_retry_at`) and sets task dispatch status to `dispatched`
  - Escalates to Telegram after max attempts (if env configured)

### 4) DoD Policy Engine in WARN mode
- Added DoD check runner for:
  - `required_fields`
  - `reviewer_approved`
- Integrated warn checks into task transition to `done` in `updateTask` (non-blocking)
- Persisted check results to `done_check_results`
- Added DoD warnings display in task detail panel

### 5) Shared heartbeat protocol dependency
- Implemented shared heartbeat constants and stale logic in `lib/mission-control/heartbeat-protocol.ts`
- Added heartbeat/session upsert service and integrated it into `/api/agent-events`
- Updated `HEARTBEAT.md` with protocol contract (interval, timeout, status mapping)

## Database & RLS

Added migration:
- `supabase/migrations/20260301000001_mission_control_gap_closure_phase1.sql`

Includes:
- New tables: `agent_sessions`, `scheduled_runs`, `retry_policies`, `retry_log`, `done_policies`, `done_check_results`
- Indexes for read paths used by live ops/calendar/retry/dod warnings
- RLS enabled + policies for all new tables
- `agents` heartbeat protocol columns:
  - `heartbeat_interval_seconds` (default 30)
  - `heartbeat_timeout_seconds` (default 90)

## Tests Added

Unit-style tests (Playwright runner):
- `e2e/retry-service.unit.spec.ts`
- `e2e/dod-runner.unit.spec.ts`

E2E smoke tests:
- `e2e/mission-control-smoke.spec.ts`

## Checks Run + Results

1. `npx next typegen`  
   - Result: PASS

2. `npx tsc --noEmit`  
   - Result: PASS

3. `npx eslint ...` (targeted changed files)  
   - Result: PASS

4. `pnpm build`  
   - Result: FAIL (environment/network)  
   - Blocker: `next/font` could not fetch Google Fonts (`Geist`, `Geist Mono`) due outbound connectivity limits.

5. `pnpm test:e2e e2e/retry-service.unit.spec.ts e2e/dod-runner.unit.spec.ts --project=chromium`  
   - Result: FAIL (environment restriction)  
   - Blocker: process spawn denied (`spawn EPERM` in Playwright worker startup).

6. `pnpm test:e2e e2e/mission-control-smoke.spec.ts --project=chromium`  
   - Result: FAIL (environment restriction)  
   - Blocker: process spawn denied (`spawn EPERM` in Playwright worker startup).

## Blockers / Risks

1. Build verification is blocked in this environment by Google Fonts network fetch failures.
2. Playwright execution is blocked in this environment by `spawn EPERM`, preventing runtime execution of both unit-style and e2e smoke tests.
3. `.next-docs` local docs folder referenced by AGENTS instructions is missing. Attempt to run:
   - `npx @next/codemod agents-md --output AGENTS.md`
   failed due npm/network/permission restrictions.

## Notes on Scope Control

- No websocket/realtime upgrades were introduced (kept polling-only for P1).
- No Memory Explorer work was included (deferred to P2 per plan).
- No DoD block mode/override UI was added (warn mode only for P1).
- Existing task flows/pages kept intact; DoD integration is non-blocking and additive.
