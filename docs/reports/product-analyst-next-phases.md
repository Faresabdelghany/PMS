# Product Analyst — Next Phases Report

> **Date:** 2026-03-01 · **After:** Phase 1 Gap Closure shipped + All Tasks view shipped  
> **Status:** Planning · **Phases remaining:** 3

---

## What's Done (Phase 1 — Shipped ✅)

- Live Ops Panel (polling, 5s refresh)
- Agent Calendar (week view, read-only)
- Auto Retry/Recovery (fixed backoff + escalation)
- DoD Policy Engine (WARN mode, non-blocking)
- Heartbeat Protocol (shared constants, session upsert, `/api/agent-events`)
- Tasks Page — All Tasks view (My / All toggle, org-scoped, paginated)

**Reviewer verdict:** APPROVED (d4d545e). One non-blocking note carried forward as a concrete task below.

---

## Remaining Phases Overview

| Phase | Name | Timeline | Effort | Key Outcome |
|-------|------|----------|--------|-------------|
| **2** | Production Hardening & Realtime | Weeks 3–5 | ~12 person-days | Live QA validated, realtime filters, WebSocket upgrade |
| **3** | Depth Features | Weeks 6–8 | ~15 person-days | Memory Explorer, DoD enforce mode, Calendar month view |
| **4** | Polish & GTM | Weeks 9–10 | ~10 person-days | Mobile responsive, analytics/export, marketing launch |

---

## Phase 2: Production Hardening & Realtime (Weeks 3–5)

### Goals
1. Complete Phase 1 live production validation (blocked items from dev report)
2. Add server-side realtime filter for "All Tasks" mode (reviewer note)
3. Upgrade Live Ops Panel from polling to WebSocket
4. Calendar: add manual trigger/pause controls

### Key Tasks

| # | Task | Owner | Effort | Priority |
|---|------|-------|--------|----------|
| 2.1 | Authenticated live QA of Phase 1 (all 26 checklist items) | Dev + QA | 2d | P0 |
| 2.2 | **Realtime org-scoped Postgres filter channel** — replace unfiltered `tasks` table subscription in "all" mode with org-level filter to reduce noise at scale | Dev | 1.5d | P1 |
| 2.3 | WebSocket upgrade for Live Ops Panel (replace 5s polling) | Dev | 3d | P1 |
| 2.4 | Calendar manual trigger + pause/resume controls | Dev | 2d | P1 |
| 2.5 | Error monitoring setup (Sentry/equivalent) for retry + heartbeat paths | Dev | 1.5d | P1 |
| 2.6 | Review + signoff | Reviewer | 2d | P0 |

### Task 2.2 — Realtime Filter (Reviewer Note) — Detail

**Context:** Reviewer observed that realtime in "all" mode subscribes to the entire `tasks` table with no server-side filter. `buildTaskWithRelations` drops non-org tasks client-side, and RLS prevents data exposure, so this is **not a security issue**. However, at scale it generates unnecessary traffic.

**Acceptance Criteria:**
- [ ] Supabase realtime subscription in "all" mode uses a Postgres filter on `project_id` (org's project IDs) or equivalent org-scoped channel
- [ ] Client-side fallback filter retained as defense-in-depth
- [ ] No regression in "My Tasks" realtime behavior
- [ ] Verified with ≥2 orgs: org A doesn't receive org B task change events

**Risks:** Supabase realtime filter has a limit on filter complexity (max ~10 values in `in` clause). If org has many projects, may need a composite approach (org_id column on tasks table or a Postgres publication filter).

### Dependencies
- Supabase service-role env vars available in CI/staging
- Phase 1 migration confirmed applied on production DB

### Risks
- Live QA may surface migration issues requiring hotfixes
- WebSocket upgrade needs Vercel compatibility check (serverless WS limitations)

---

## Phase 3: Depth Features (Weeks 6–8)

### Goals
1. Memory Explorer MVP (search + decision trace)
2. DoD enforce mode (block task completion on policy failure)
3. Calendar month view + historical analytics (past 30 days)
4. Exponential backoff + checkpoint/resume for retry

### Key Tasks

| # | Task | Owner | Effort |
|---|------|-------|--------|
| 3.1 | Memory Explorer schema + full-text indexing | Dev | 3d |
| 3.2 | Memory Explorer UI (search, provenance trace) | Dev + Designer | 3d |
| 3.3 | DoD enforce mode + 3 additional check types | Dev | 2.5d |
| 3.4 | Calendar month view + run history | Dev | 2d |
| 3.5 | Exponential backoff + checkpoint/resume | Dev | 2d |
| 3.6 | Design review for Memory Explorer | Designer | 1d |
| 3.7 | Review + signoff | Reviewer | 1.5d |

### Dependencies
- Phase 2 WebSocket infra (Memory Explorer benefits from realtime)
- DoD warn mode validated in production first

### Risks
- Memory Explorer scope creep — keep to search + trace MVP
- DoD enforce mode may disrupt existing team workflows; needs rollout toggle per project

---

## Phase 4: Polish & GTM (Weeks 9–10)

### Goals
1. Mobile responsive for all mission control views
2. Export/analytics dashboards (CSV, charts)
3. Onboarding UX for new mission control features
4. Marketing announcement + docs

### Key Tasks

| # | Task | Owner | Effort |
|---|------|-------|--------|
| 4.1 | Mobile responsive pass (Live Ops, Calendar, Memory) | Dev + Designer | 2.5d |
| 4.2 | Export functionality (CSV) + basic analytics charts | Dev | 2d |
| 4.3 | Compliance/audit dashboard | Dev | 1.5d |
| 4.4 | Onboarding tooltips/guide for mission control | Designer + Dev | 1.5d |
| 4.5 | Documentation update (user-facing + internal) | Product Analyst | 1d |
| 4.6 | Marketing announcement prep | Marketing | 1d |
| 4.7 | Final review + signoff | Reviewer | 0.5d |

### Risks
- Marketing timing depends on all features being stable
- Mobile responsive may surface layout issues requiring design iteration

---

## Summary

3 phases remain. Total estimated effort: **~37 person-days** across Weeks 3–10. The realtime filter item (reviewer note) is placed as task 2.2 in Phase 2 — the earliest practical phase since it builds on the shipped "All Tasks" infrastructure.
