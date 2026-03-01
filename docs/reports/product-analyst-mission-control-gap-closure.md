# Product Analyst Report: Mission Control Gap Closure

> **Date:** 2026-03-01 · **Author:** Product Analyst Agent · **Status:** Planning Complete

---

## Executive Summary

An audit against the Alex Finn benchmark revealed five critical mission-control gaps in PMS: no live operational visibility, no schedule overview, no completion quality gates, no memory provenance, and no automated failure recovery. This report summarizes the PRD, phased plan, and task breakdown created to close these gaps.

## Gaps Identified

| # | Gap | Impact | Priority |
|---|---|---|---|
| 1 | **No Live Ops Panel** | Operators can't see what agents are doing right now | P0 — MVP |
| 2 | **No Agent Calendar** | No visibility into scheduled/cron runs or their outcomes | P0 — MVP |
| 3 | **No DoD Policy Engine** | Tasks marked "done" without quality validation | P1 — MVP (warn mode) |
| 4 | **No Memory Explorer** | Can't search agent memory or trace decisions to sources | P1 — Phase 2 |
| 5 | **No Auto Retry/Recovery** | Failed tasks require manual intervention every time | P0 — MVP |

## Deliverables Produced

| File | Description |
|---|---|
| [`specs/mission-control-gap-closure/spec.md`](../../specs/mission-control-gap-closure/spec.md) | Full specification with requirements, acceptance criteria, data model, constraints |
| [`specs/mission-control-gap-closure/plan.md`](../../specs/mission-control-gap-closure/plan.md) | 3-phase rollout: 2-week MVP → Depth (wk 3–5) → Polish (wk 6–8) |
| [`specs/mission-control-gap-closure/tasks.md`](../../specs/mission-control-gap-closure/tasks.md) | 50+ tasks with owner assignments, effort estimates, and phase mapping |

## Phase Summary

**Phase 1 (MVP, Weeks 1–2):** Live Ops Panel (polling), Agent Calendar (week view, read-only), Auto Retry (fixed backoff + Telegram), DoD Engine (2 checks, warn mode). ~17.5 person-days.

**Phase 2 (Weeks 3–5):** Memory Explorer (search + decision trace), Realtime WebSocket upgrade, Calendar enhancements (month view, manual trigger), DoD block mode + 3 more checks, exponential backoff + checkpoint/resume. ~15 person-days.

**Phase 3 (Weeks 6–8):** Export/analytics, compliance dashboard, recovery dashboard, mobile responsive, onboarding UX, marketing announcement. ~14 person-days.

## Key Design Decisions

1. **Memory Explorer deferred to P2** — requires new schema and full-text indexing; MVP focuses on operational visibility first.
2. **DoD starts in warn mode** — avoids blocking existing workflows; block mode in P2 after teams adapt.
3. **Polling before WebSocket** — simpler MVP; Supabase Realtime upgrade in P2 when connection limits are validated.
4. **Heartbeat protocol required** — agents must emit heartbeats for blocker detection; this is a prerequisite that must be defined in P1 even though it's consumed in P2.

## Top Risks

| Risk | Mitigation |
|---|---|
| Agent heartbeat adoption (existing agents don't emit) | Define protocol in P1; retrofit agents before P2 |
| Supabase Realtime connection limits | Polling fallback always available |
| Memory volume → search perf | Postgres full-text index; pagination; consider pgvector later |
| Scope creep past 2-week MVP | Strict scope freeze; anything not listed in P1 tasks is P2+ |

## Recommendations

1. **Start P1 immediately** — the Live Ops Panel and Retry Loop provide the highest operator trust improvement per effort.
2. **Assign a dedicated Dev** for the full 2-week MVP sprint — context switching will kill velocity on this.
3. **Define heartbeat protocol by Day 2** — it's a shared dependency across Ops Panel + Retry.
4. **Design review at P1 exit** — Designer should review all P1 UI before P2 starts.
5. **Track adoption** — after P1 ships, measure daily usage of mission-control page to validate investment.

---

*No implementation was performed. All files are planning artifacts ready for Dev handoff.*
