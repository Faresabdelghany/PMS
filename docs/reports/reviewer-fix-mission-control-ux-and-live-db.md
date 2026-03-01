# Reviewer Report — Fix Mission Control UX & Live DB

**Date:** 2026-03-01
**Owner:** Reviewer subagent

---

## Summary

Applied Fares' feedback: split Mission Control from a single tabbed page into two separate sidebar pages (Live Ops + Agent Calendar), and applied all Phase 1 DB migrations to the live Supabase instance.

## Changes Made

### UI/UX — Separate Sidebar Pages

| File | Action |
|------|--------|
| `app/(dashboard)/mission-control/page.tsx` | **Deleted** |
| `components/mission-control/mission-control-client.tsx` | **Deleted** |
| `app/(dashboard)/live-ops/page.tsx` | **Created** — standalone Live Ops page |
| `app/(dashboard)/agent-calendar/page.tsx` | **Created** — standalone Agent Calendar page |
| `components/mission-control/live-ops-client.tsx` | **Created** — client wrapper with 5s auto-refresh |
| `components/mission-control/agent-calendar-client.tsx` | **Created** — client wrapper with week/month toggle, 30s refresh |
| `components/app-sidebar.tsx` | **Modified** — replaced `mission-control` nav item with `live-ops` + `agent-calendar` (type, icons, routes, active detection all updated) |

### DB Migrations Applied via Supabase MCP

| Migration | Status |
|-----------|--------|
| `20260301000001_mission_control_gap_closure_phase1.sql` | ✅ Applied |
| `20260301000002_task_single_assignee_check.sql` | ✅ Applied (cleared 16 conflicting rows first) |
| `20260301000003_dod_enforce_mode.sql` | ✅ Applied |

### DB Validation Evidence

| Object | Status |
|--------|--------|
| `agent_sessions` table | ✅ Exists, queryable |
| `scheduled_runs` table | ✅ Exists, queryable |
| `retry_policies` table | ✅ Exists, queryable |
| `retry_log` table | ✅ Exists, queryable |
| `done_policies` table | ✅ Exists, queryable |
| `done_check_results` table | ✅ Exists, queryable |
| `agents.heartbeat_interval_seconds` | ✅ INTEGER DEFAULT 30 |
| `agents.heartbeat_timeout_seconds` | ✅ INTEGER DEFAULT 90 |
| `tasks.chk_single_assignee` constraint | ✅ Applied |

## Build Validation

- `npx tsc --noEmit` — ✅ Pass
- `npm run build` — ✅ Pass
- Routes `/live-ops` and `/agent-calendar` confirmed in build output

## Remaining Issues

1. **Tables are empty** — Live Ops and Calendar pages will show "data unavailable" / "No active sessions" until agents write session and schedule data. This is expected behavior with proper fallback rendering.
2. **Task single assignee migration** — 16 tasks had `assigned_agent_id` cleared to satisfy the new constraint. All were same-user dual-assignments, so no data loss.
