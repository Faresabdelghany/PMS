# Product Analyst — Next Step Report

> **Date:** 2026-03-01 · **After:** Phase 1 Mission Control Gap Closure (merged & approved)

---

## Phase 1 Status: ✅ Shipped

Phase 1 MVP merged to `origin/main` with reviewer approval. Delivered:
- Live Ops Panel (polling-based, 5s refresh)
- Agent Calendar (week view, read-only)
- Auto Retry/Recovery (fixed backoff + escalation)
- DoD Policy Engine (WARN mode, non-blocking)
- Heartbeat Protocol (shared constants, session upsert, `/api/agent-events`)

## Immediate Next Steps

### 1. Production Validation Checklist (P0)

Before building more features, Phase 1 needs validated on live PMS. Spec produced at `specs/phase1-production-validation/`.

Key validation areas:
- Live Ops Panel renders active sessions, queue, blockers
- Agent Calendar shows scheduled runs with correct status badges
- Retry loop fires on task failure, respects policy, escalates after max attempts
- DoD warn mode surfaces warnings on task→done transition without blocking
- Heartbeat protocol: agent sessions update heartbeat, stale detection works

### 2. Tasks Page — Show All Tasks (P1)

Fares requested the tasks page display **all tasks in the organization**, not just "My Tasks." Currently `getMyTasks()` filters by `assignee_id = user.id`. Spec produced at `specs/tasks-page-all-tasks/`.

Scope:
- Add `getAllTasks()` server action (org-scoped, paginated, RLS-gated)
- Add tab toggle: "My Tasks" / "All Tasks" on the tasks page
- Preserve existing filters, sorting, pagination for both views
- No new DB tables or migrations needed

### 3. Future Backlog (not yet spec'd)

- Phase 2 Mission Control: WebSocket live ops, calendar trigger/pause, DoD ENFORCE mode
- Memory provenance UI
- Agent Calendar month view + historical analytics
