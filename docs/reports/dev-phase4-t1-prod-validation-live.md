# Dev Report — Phase 4 T1: Phase 1 Production Validation (Live)

**Date:** 2026-03-01  
**Owner:** Dev subagent  
**Target:** Live PMS (`https://pms-nine-gold.vercel.app`) + configured Supabase project (`lazhmdyajdqbnxxwyxun`)  
**Checklist Source:** `specs/phase1-production-validation/spec.md` (26 checks)

---

## Executive Outcome

**Validation Result: FAIL (blocked by missing Phase 1 schema in live DB).**

Critical evidence indicates Phase 1 migration is not applied in the active Supabase schema used for current validation context:

- `agent_sessions`, `scheduled_runs`, `retry_policies`, `retry_log`, `done_policies`, `done_check_results` all return:  
  **`Could not find the table 'public.<table_name>' in the schema cache`**
- `agents.heartbeat_interval_seconds` and `agents.heartbeat_timeout_seconds` columns are missing.
- Mission Control UI shows:
  - **"Live Ops data unavailable."**
  - **"Calendar data unavailable."**

Because core Phase 1 tables are absent, most of the 26 checks are hard-fail or blocked.

---

## Validation Evidence

### A) Live UI evidence (`/mission-control`)

- Page loaded successfully at `https://pms-nine-gold.vercel.app/mission-control`
- Browser navigation timing sample:
  - `domContentLoaded`: **1641.9ms**
  - `loadEventEnd`: **1859.2ms**
- Console sample: no errors observed (only service worker registration log).
- UI text on Live Ops tab: **"Live Ops data unavailable."**
- UI text on Calendar tab: **"Calendar data unavailable."**

### B) DB evidence (Supabase queries)

Authenticated checks against configured Supabase returned:

- `agent_sessions`: `Could not find the table 'public.agent_sessions' in the schema cache`
- `scheduled_runs`: `Could not find the table 'public.scheduled_runs' in the schema cache`
- `retry_policies`: `Could not find the table 'public.retry_policies' in the schema cache`
- `retry_log`: `Could not find the table 'public.retry_log' in the schema cache`
- `done_policies`: `Could not find the table 'public.done_policies' in the schema cache`
- `done_check_results`: `Could not find the table 'public.done_check_results' in the schema cache`
- `agents` query for heartbeat columns failed with: `column agents.heartbeat_interval_seconds does not exist`

### C) Heartbeat endpoint probe

- POST `/api/agent-events` with service-role-style bearer payload returned `{ "ok": true }`.
- However, this endpoint does not validate success of heartbeat table write (no DB error checks in heartbeat upsert), so this is **not sufficient evidence** for heartbeat protocol success.

---

## Full 26-Item Checklist Results

| # | Area | Check | Status | Evidence |
|---|------|-------|--------|----------|
| 1 | Live Ops | Navigate to `/mission-control` | ✅ PASS | Page loaded, `loadEventEnd=1859.2ms` (<2s), no console errors seen |
| 2 | Live Ops | "Now Playing" section | ❌ FAIL | Live Ops panel shows **"Live Ops data unavailable."** |
| 3 | Live Ops | Queue section | ❌ FAIL | Same blocker: Live Ops data unavailable |
| 4 | Live Ops | Blockers section | ❌ FAIL | Same blocker: Live Ops data unavailable |
| 5 | Live Ops | Auto-refresh within 5s | ❌ FAIL | Cannot verify refresh behavior; panel is unavailable |
| 6 | Live Ops | Click-through task → `/tasks?task=...` | ❌ FAIL | No task rows rendered in unavailable state |
| 7 | Live Ops | Filter by agent | ❌ FAIL | Filter interaction not available in unavailable state |
| 8 | Calendar | Week view renders day columns | ❌ FAIL | Calendar tab shows **"Calendar data unavailable."** |
| 9 | Calendar | Scheduled runs appear | ❌ FAIL | No runs; data unavailable |
| 10 | Calendar | Status badges render correctly | ❌ FAIL | No run entries rendered |
| 11 | Calendar | Week navigation works | ❌ FAIL | Data unavailable; cannot validate data changes |
| 12 | Calendar | Click-through to run logs | ❌ FAIL | No run entries available |
| 13 | Retry Loop | `retry_policies` exists/defaults | ❌ FAIL | Table missing in schema cache |
| 14 | Retry Loop | Failed task triggers retry log | ❌ FAIL | `retry_log` table missing |
| 15 | Retry Loop | Backoff respected (`next_retry_at`) | ❌ FAIL | Retry tables missing |
| 16 | Retry Loop | Max attempts escalation fires | ❌ FAIL | Retry system not verifiable with missing schema |
| 17 | Retry Loop | Retry log visible in UI/detail | ❌ FAIL | Retry table missing; no data path to UI |
| 18 | DoD | `done_policies` exists | ❌ FAIL | Table missing in schema cache |
| 19 | DoD | Transition to done triggers checks | ❌ FAIL | DoD persistence table path unavailable |
| 20 | DoD | Warnings surface (non-blocking) | ❌ FAIL | DoD checks cannot be validated with missing tables |
| 21 | DoD | Passing checks show no warnings | ❌ FAIL | Same schema blocker |
| 22 | DoD | `done_check_results` persists | ❌ FAIL | Table missing in schema cache |
| 23 | Heartbeat | Heartbeat creates/updates session | ❌ FAIL | `agent_sessions` table missing; endpoint `ok:true` is not proof of write success |
| 24 | Heartbeat | `agents` heartbeat columns exist | ❌ FAIL | `agents.heartbeat_interval_seconds` column does not exist |
| 25 | Heartbeat | Stale detection in Live Ops | ❌ FAIL | Session table absent + Live Ops unavailable |
| 26 | Heartbeat | `HEARTBEAT.md` exists and accurate | ✅ PASS | `HEARTBEAT.md` present with interval/timeout/status contract |

**Score:** 2 / 26 pass, 24 / 26 fail.

---

## Concrete Hotfix List (Do NOT implement in T1)

### P0 (Blockers)
1. **Apply missing Phase 1 migration to live DB:**  
   `supabase/migrations/20260301000001_mission_control_gap_closure_phase1.sql`
2. **Verify created tables exist and are accessible:**  
   `agent_sessions`, `scheduled_runs`, `retry_policies`, `retry_log`, `done_policies`, `done_check_results`
3. **Ensure `agents` columns exist:**  
   `heartbeat_interval_seconds` (default 30), `heartbeat_timeout_seconds` (default 90)
4. **Run post-migration sanity query pack** confirming all six tables + two columns exist in production schema.
5. **Re-run full 26-item production checklist** after migration.

### P1 (Safety/observability hardening discovered during validation)
6. **Harden `/api/agent-events` auth validation**: current token check decodes JWT payload but does not verify signature; replace with robust verification (or trusted secret/API key flow).
7. **Add explicit DB error handling in heartbeat upsert path** and return non-200 response when writes fail.
8. **Add Mission Control diagnostics fallback** (surface exact backend error reason to authorized admins, not just generic "data unavailable").

---

## Blocker List for Main Track

- **Primary blocker:** Phase 1 schema not present in active validation DB.
- **Secondary blocker:** Mission Control Live Ops/Calendar remain non-functional until schema is applied.
- **Validation gate:** Phase 2 work should remain blocked until this checklist is re-run and passed.
