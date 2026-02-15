# Continuous Performance Optimization Plan

**Application:** PMS (Project Management SaaS)
**Stack:** Next.js 16.1, React 19, Supabase, Vercel
**Date:** 2026-02-14
**Scope:** Performance budget tracking, optimization backlog, capacity planning, review cycles, A/B testing

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Performance Budget Tracking System](#2-performance-budget-tracking-system)
3. [Optimization Backlog with Priorities](#3-optimization-backlog-with-priorities)
4. [Capacity Planning Model](#4-capacity-planning-model)
5. [Review Cycle Schedule and Process](#5-review-cycle-schedule-and-process)
6. [A/B Testing Framework for Performance Changes](#6-ab-testing-framework-for-performance-changes)
7. [Operational Runbooks](#7-operational-runbooks)
8. [Appendix: Cross-Reference to Previous Reports](#appendix-cross-reference-to-previous-reports)

---

## 1. Executive Summary

This document establishes the continuous optimization process for the PMS application. It consolidates findings from all previous phases (profiling, database, backend, frontend, CDN, mobile, load testing, and regression testing) into a sustainable, repeatable operational framework.

### Current Performance Posture

The application is well-optimized for its current scale (50-100 concurrent users). Key architectural strengths include cursor-based pagination, two-tier caching (React `cache()` + Vercel KV), 28+ dynamic imports, comprehensive skeleton components, and streaming Suspense boundaries. The remaining work falls into two categories: (1) identified but unimplemented optimizations from the audit, and (2) ongoing monitoring and governance to prevent regression.

### What This Plan Delivers

| Deliverable | Purpose | Section |
|---|---|---|
| Performance budget tracking system | Enforce and track budgets over time | [Section 2](#2-performance-budget-tracking-system) |
| Optimization backlog with priorities | Ranked list of all improvements from all phases | [Section 3](#3-optimization-backlog-with-priorities) |
| Capacity planning model | Predict when infrastructure needs scaling | [Section 4](#4-capacity-planning-model) |
| Review cycle schedule and process | Weekly/monthly performance reviews | [Section 5](#5-review-cycle-schedule-and-process) |
| A/B testing framework | Validate optimization impact with data | [Section 6](#6-ab-testing-framework-for-performance-changes) |

---

## 2. Performance Budget Tracking System

### 2.1 Budget Registry

All performance budgets are defined in a single source of truth and enforced at multiple levels: CI/CD gates, monitoring alerts, and periodic reviews.

#### Tier 1: Hard Budgets (Block PRs)

These budgets are enforced in CI. A PR that exceeds any hard budget cannot merge.

| Metric | Budget | Enforcement Mechanism | Source |
|---|---|---|---|
| Lighthouse Performance Score | >= 75 | `lighthouserc.cjs` assertions, `.github/workflows/lighthouse.yml` | 11-regression-testing.md Section 4 |
| LCP (Lighthouse) | < 2,500ms | `lighthouserc.cjs` | Google "Good" CWV threshold |
| CLS (Lighthouse) | < 0.10 | `lighthouserc.cjs` | Google "Good" CWV threshold |
| TBT (Lighthouse) | < 500ms | `lighthouserc.cjs` | 11-regression-testing.md Section 4 |
| FCP (Lighthouse) | < 1,800ms | `lighthouserc.cjs` | Google "Good" CWV threshold |
| Route transition time | < 3,000ms | `e2e/navigation-performance.spec.ts` | Existing test threshold |
| RSC payload: /projects | < 150KB | `e2e/performance-budgets.spec.ts` | 11-regression-testing.md Section 8 |
| RSC payload: /tasks | < 100KB | `e2e/performance-budgets.spec.ts` | 11-regression-testing.md Section 8 |
| RSC payload: /clients | < 120KB | `e2e/performance-budgets.spec.ts` | 11-regression-testing.md Section 8 |
| RSC payload: /inbox | < 80KB | `e2e/performance-budgets.spec.ts` | 11-regression-testing.md Section 8 |
| Bundle size per route | Per-route table (see 11-regression-testing.md Section 7) | `scripts/check-bundle-size.mjs` | 11-regression-testing.md Section 7 |
| Bundle size total increase | < 10% vs baseline | `scripts/check-bundle-size.mjs` | 11-regression-testing.md Section 7 |

#### Tier 2: Soft Budgets (Warn, Track Trend)

These budgets produce warnings in CI output and are tracked for trend analysis. They do not block merging due to inherent variance.

| Metric | Warning Threshold | Tracking Mechanism |
|---|---|---|
| TTFB per page | > 500ms (data pages), > 300ms (lightweight pages) | `e2e/performance-budgets.spec.ts` |
| API requests per navigation | > 15 | `e2e/navigation-performance.spec.ts` |
| Load More response time | > 500ms | `e2e/performance-budgets.spec.ts` |
| Build time | > 120s | CI workflow timer |
| Lighthouse Performance (auth pages) | < 80 | `.github/workflows/lighthouse.yml` |

#### Tier 3: Operational Budgets (Monitor in Production)

These budgets apply to production monitoring, not CI. They require the observability stack described in `02-observability.md`.

| Metric | Budget | Alert Threshold | Monitoring Tool |
|---|---|---|---|
| p50 page response time (50 VUs) | < 300ms | > 500ms for 5 min | Vercel Analytics / RUM |
| p95 page response time (50 VUs) | < 1,500ms | > 2,000ms for 5 min | Vercel Analytics / RUM |
| Error rate (all pages) | < 1% | > 2% for 5 min | Vercel Logs / Sentry |
| KV cache hit rate | > 80% | < 60% for 15 min | Custom metrics (future) |
| Supabase query p95 | < 200ms | > 500ms for 5 min | Supabase Dashboard |
| Realtime WebSocket connections | < 80% of plan limit | > 90% sustained | Supabase Dashboard |
| PgBouncer utilization | < 70% | > 85% sustained | Supabase Dashboard |

### 2.2 Budget Lifecycle

```
Define Budget
    |
    v
Implement in CI/CD (hard) or Monitoring (operational)
    |
    v
Enforce on every PR / Monitor in production
    |
    v
Quarterly Review (Section 5.3)
    |
    +--> Tighten budget if actual values have improved significantly
    |    (e.g., optimization reduced LCP from 2.5s baseline to 1.5s sustained;
    |     tighten budget from 2.5s to 2.0s)
    |
    +--> Loosen budget if feature legitimately increases metric
    |    (e.g., new rich-text column adds 15KB to RSC payload;
    |     increase /projects budget from 150KB to 170KB with justification)
    |
    +--> Keep budget unchanged if within normal variance
```

### 2.3 Budget Update Process

When a budget needs to change:

1. **Propose the change** in the PR description. Include the old budget, new budget, and reason.
2. **Update the budget value** in the relevant file (test spec, lighthouse config, or baseline JSON).
3. **Never increase a budget in response to flaky CI.** Investigate the root cause first. If the test is truly flaky, fix the test (add retries, widen tolerance), do not raise the budget.
4. **Document the change** in the PR. The reviewer must approve budget changes explicitly.
5. **Add a line to the quarterly review tracker** (see Section 5.3) noting when and why the budget changed.

### 2.4 Tracking Trends Over Time

#### Phase 1 (Current): CI Artifact Storage

All performance data is stored as GitHub Actions artifacts with 30-day retention. The following data is captured per CI run:

- Lighthouse JSON results (`.lighthouseci/*.json`)
- Bundle size report (text output from `check-bundle-size.mjs`)
- RSC payload measurements (`[PERF]` lines in Playwright output)
- Core Web Vitals (`[CWV-DATA]` JSON lines in Playwright output)
- Navigation timing (`[PERF]` lines in existing navigation test)

Trend analysis at this phase is manual: download artifacts from recent runs and compare.

#### Phase 2 (Recommended): Automated Trend Dashboard

Deploy one of the following:

| Option | Effort | Best For |
|---|---|---|
| Lighthouse CI Server (self-hosted) | Medium | Historical Lighthouse comparisons with built-in charts |
| GitHub Pages dashboard | Medium | Lightweight custom dashboard from CI data |
| Vercel Web Analytics (already integrated) | None | Basic real-user CWV trends (already active) |
| Datadog RUM or SpeedCurve | High | Enterprise-grade RUM with alerting |

**Recommendation:** Start with Vercel Web Analytics (already active) for production CWV trends. When the team needs historical CI comparison, deploy a Lighthouse CI Server and change the `lighthouserc.cjs` upload target.

#### Phase 3 (Future): Full Observability

Implement the stack described in `02-observability.md`:
- Structured logging with trace correlation
- Custom metrics for KV hit/miss rates, query latency, pagination depth
- SLI/SLO tracking with automated alerting
- Real User Monitoring beyond Vercel's built-in analytics

---

## 3. Optimization Backlog with Priorities

This is the consolidated, ranked list of every optimization identified across all phases. Items are grouped into priority tiers and ordered by impact-to-effort ratio within each tier.

### 3.1 Tier 0: Critical (Correctness + Performance)

These items fix bugs or address correctness issues that also affect performance.

| # | Item | Source | Impact | Effort | Status |
|---|---|---|---|---|---|
| T0-1 | Fix Service Worker `vercel.app` hostname skip (SW does nothing in production) | 08-cdn.md Section 6b | Critical | Low | **Not started** |
| T0-2 | Fix `ClientsContent` stale useMemo dependency (`[initialClients]` should be `[allClients]`) | 01-profiling.md Section 6.4 | High (correctness bug) | Low | **Fixed** (PR merged) |

### 3.2 Tier 1: High Impact, Low-Medium Effort

These items deliver the largest performance improvements for reasonable implementation effort.

| # | Item | Source | Impact | Effort | Estimated Improvement |
|---|---|---|---|---|---|
| T1-1 | Replace `getTaskStats()` with SQL aggregation RPC (`get_task_stats`) | 04-database.md Section 3.1 | Critical | Medium | ~50-200ms to ~2-5ms per call |
| T1-2 | Replace `getClientStats()` with SQL aggregation RPC (`get_client_stats`) | 04-database.md Section 3.2 | Critical | Medium | ~30-100ms to ~2-5ms per call |
| T1-3 | Replace `getProjectStats()` with SQL aggregation RPC (`get_project_stats`) | 04-database.md Section 3.3 | Critical | Medium | ~30-100ms to ~2-5ms per call |
| T1-4 | Replace `getClientsWithProjectCounts()` enrichment with `get_project_counts_for_clients` RPC | 04-database.md Section 3.4 | Critical | Medium | ~30-200ms to ~5-10ms per call |
| T1-5 | Add composite index `idx_tasks_project_sort_order_id` for cursor pagination | 04-database.md Section 4.1 | High | Low | Eliminates sort step on task queries |
| T1-6 | Add composite index `idx_tasks_assignee_updated_id` for My Tasks cursor | 04-database.md Section 4.2 | High | Low | Eliminates sort step on user tasks |
| T1-7 | Add composite index `idx_projects_org_updated_id` for project cursor | 04-database.md Section 4.3 | High | Low | Eliminates sort step on project queries |
| T1-8 | Add KV cache for inbox first page (`getInboxItems`) | 04-database.md Section 5.1 | High | Low | ~93% faster inbox loads (KV warm) |
| T1-9 | Add KV cache for `getClientsWithProjectCounts` first page | 04-database.md Section 5.2 | Medium | Low | ~95% faster client loads (KV warm) |
| T1-10 | Enable AVIF image format (1-line config change) | 08-cdn.md Section 2a | High | Low | 20-50% smaller images |
| T1-11 | Implement stale-while-revalidate in `cacheGet()` to eliminate cache stampede | 06-distributed.md Section 3.3 | High | Medium | Prevents thundering herd at TTL expiry |
| T1-12 | Create web app manifest for PWA installability | 09-mobile.md Section 2a | High | Low | Enables mobile install |
| T1-13 | Add offline fallback page (`offline.html`) | 09-mobile.md Section 4a | High | Low | Better offline experience |
| T1-14 | Enable Vercel Skew Protection | 08-cdn.md Section 7d | Medium | Low | Eliminates ChunkLoadError on deploy |

### 3.3 Tier 2: Medium Impact, Medium Effort

| # | Item | Source | Impact | Effort | Estimated Improvement |
|---|---|---|---|---|---|
| T2-1 | Consolidate `getProjectWithDetails()` into single RPC (8 round trips to 1-2) | 06-distributed.md Section 8.1 | High | High | ~140ms reduction on project detail |
| T2-2 | Create slim `getProjectsMinimal(orgId)` for tasks page (only `id, name, workstreams`) | 05-backend.md Finding #4 | High | Medium | ~95% smaller RSC payload for tasks |
| T2-3 | Reduce tasks page RSC payload by stripping full project relations | 05-backend.md Finding #10 | Medium | Low | ~56% smaller projects page RSC |
| T2-4 | Add filter to `task_comment_reactions` realtime subscription (currently global) | 06-distributed.md Section 8.2 | Medium | Medium | Eliminates global event noise |
| T2-5 | Batch layout KV reads with `kv.mget()` | 06-distributed.md Section 8.9 | Medium | Low | ~4-20ms reduction per page load |
| T2-6 | Use `TaskQuickCreateModalLazy` in MyTasksPage.tsx and ProjectDetailsPage.tsx | 07-frontend.md R3.1, R3.3 | Medium | Low | ~15-20KB deferred per page |
| T2-7 | Split color theme CSS (extract 11 non-default themes from globals.css) | 08-cdn.md Section 4 | Medium | Medium | ~86% smaller initial CSS |
| T2-8 | Add `sizes` attribute to all `<Image>` components | 08-cdn.md Section 2b | Medium | Medium | Prevents oversized images |
| T2-9 | Defer realtime connections on mobile by 3 seconds | 09-mobile.md Section 3d | Medium | Medium | ~20% faster mobile FCP |
| T2-10 | Add `content-visibility: auto` on inbox/task/client list items | 09-mobile.md Section 3b | Medium | Low | ~30-50ms faster initial render |
| T2-11 | Add virtual keyboard handling (`interactive-widget=resizes-visual`) | 09-mobile.md Section 6a | Medium | Low | Prevents mobile layout shifts |
| T2-12 | Parallelize `verifyAIConfig()` internal calls | 06-distributed.md Section 8.4 | Low | Low | ~15-30ms per AI message |
| T2-13 | Add public asset cache headers for images not under `_next` | 08-cdn.md Section 3c | Low | Low | ~90%+ cache hit rate for public assets |
| T2-14 | Add crossorigin to Supabase preconnect + avatar DNS-prefetch | 08-cdn.md Sections 9b, 9c | Low | Low | ~100ms faster first Supabase connection |
| T2-15 | SW versioned cache name + explicit `_next/static` caching | 08-cdn.md Sections 6a, 6c | Medium | Low | Better repeat-visit performance |
| T2-16 | Slice to `limit` items before KV write (eliminate sentinel row in cache) | 04-database.md Section 5.3 | Low | Low | ~2-5% reduction in KV serialization |
| T2-17 | Drop duplicate indexes (`idx_inbox_items_created_at`, `idx_inbox_items_is_read`) | 04-database.md Section 6 | Low | Low | Reclaim disk, reduce write amplification |

### 3.4 Tier 3: Low Impact or High Effort (Future)

| # | Item | Source | Impact | Effort |
|---|---|---|---|---|
| T3-1 | Virtual scrolling for board view with 200+ tasks | 01-profiling.md Section 12.9 | Medium | High |
| T3-2 | Refactor view components to accept `ProjectWithRelations` directly (remove `toMockProject`) | 01-profiling.md Section 12.10 | Low | High |
| T3-3 | Add "catch-up" query after realtime re-subscribe on tab visible | 06-distributed.md Section 8.6 | Medium | Medium |
| T3-4 | Audit for duplicate pooled/non-pooled subscriptions | 06-distributed.md Section 8.7 | Medium | Medium |
| T3-5 | Implement streaming for AI responses (SSE/ReadableStream) | 06-distributed.md Section 8.8 | Medium | Medium |
| T3-6 | Adaptive page size for mobile (25 vs 50 items) | 09-mobile.md Section 3b | Medium | Medium |
| T3-7 | Network-aware loading hook (`useNetworkQuality`) | 09-mobile.md Section 5a | Medium | Medium |
| T3-8 | IndexedDB offline data caching for PWA | 09-mobile.md Section 4b | High | High |
| T3-9 | Background sync for offline mutations | 09-mobile.md Section 4c | Medium | High |
| T3-10 | Edge Runtime for AI chat route | 08-cdn.md Section 7b | Low | Medium |
| T3-11 | Consider lazy-loading `dompurify` (~8KB) | 07-frontend.md R2.2 | Low | Low |
| T3-12 | Lazy-load `react-markdown` + `remark-gfm` (~30KB) if pulled into shared bundle | 07-frontend.md R2.1 | Low | Low |
| T3-13 | Add `overscroll-behavior: contain` on scrollable lists | 09-mobile.md Section 6c | Low | Low |

### 3.5 Observability Prerequisites (From 02-observability.md)

These items are not performance optimizations themselves but are required to sustain continuous optimization. Without observability, optimizations cannot be validated in production.

| # | Item | Impact on Optimization Process | Effort |
|---|---|---|---|
| O-1 | Implement structured logging (replace `console.error` with structured logger) | Required for debugging production performance issues | Medium |
| O-2 | Add error tracking service (Sentry or equivalent) | Required for detecting runtime errors that affect performance | Medium |
| O-3 | Add custom KV metrics (hit/miss rate, latency percentiles) | Required for validating cache optimization effectiveness | Medium |
| O-4 | Add Supabase query timing instrumentation | Required for database optimization validation | Medium |
| O-5 | Define SLIs/SLOs for key user journeys | Required for operational budget enforcement | Low |
| O-6 | Add health check endpoint | Required for synthetic monitoring | Low |

### 3.6 Implementation Roadmap

```
Week 1-2:    T0-1, T1-5 through T1-7 (indexes), T1-10 (AVIF), T1-12 (manifest),
             T1-13 (offline page), T1-14 (Skew Protection), T2-13 (public cache),
             T2-14 (preconnect), T2-17 (drop indexes)

Week 3-4:    T1-1 through T1-4 (RPC functions + code changes),
             T1-8, T1-9 (KV caching for inbox/clients)

Week 5-6:    T1-11 (stale-while-revalidate), T2-5 (mget), T2-6 (lazy modals),
             T2-15 (SW improvements), T2-16 (sentinel row fix)

Month 2:     T2-1 (consolidate project detail), T2-2, T2-3 (RSC payload reduction),
             T2-4 (reaction filter), T2-7 (CSS theme split)

Month 3:     T2-8 through T2-11 (mobile optimizations),
             O-1 through O-6 (observability foundation)

Quarter 2:   T3-* items based on capacity planning triggers (Section 4)
```

---

## 4. Capacity Planning Model

### 4.1 Current Infrastructure Capacity

| Resource | Current Plan Capacity | Current Usage (est.) | Headroom |
|---|---|---|---|
| Supabase PgBouncer connections | 60-200 (plan dependent) | ~10-25 at 50 VUs | 4-8x |
| Vercel KV commands/second | ~1,000 (Pro plan) | ~35-150 at 50 VUs | 7-28x |
| Supabase Realtime WebSocket connections | 200-500 (plan dependent) | ~50-100 at 50 VUs | 2-5x |
| Vercel serverless concurrency | 1,000 (Pro plan) | ~20-50 at 50 VUs | 20-50x |
| Supabase database size | Plan dependent | Current dataset | N/A |

### 4.2 Scaling Triggers

Each trigger defines a metric threshold, the action to take when crossed, and the lead time required to implement the action.

#### Trigger 1: PgBouncer Utilization > 70% Sustained

**How to measure:** Supabase Dashboard > Database > Connection Pooler metrics. Or query `pg_stat_activity` during load tests.

**Threshold:** Average utilization > 70% during peak hours for 3+ consecutive business days.

**Actions (in order):**
1. **Immediate (0 cost):** Implement T1-1 through T1-4 (RPC functions) to reduce connection hold time.
2. **Short-term (0 cost):** Implement T1-11 (stale-while-revalidate) to reduce cache stampede.
3. **Medium-term (cost increase):** Upgrade Supabase plan for larger connection pool.
4. **Long-term (engineering effort):** Implement T2-1 (consolidate project detail to 1-2 round trips).

**Lead time:** Items 1-2 require 1-2 weeks of engineering. Item 3 is a plan change (immediate). Item 4 requires 2-4 weeks.

#### Trigger 2: KV Command Rate > 60% of Plan Limit

**How to measure:** Vercel Dashboard > KV > Usage metrics. Or Upstash dashboard.

**Threshold:** Peak KV commands/second exceeds 60% of plan limit for 5+ minutes.

**Actions:**
1. **Immediate:** Implement T2-5 (batch layout KV reads with `mget`). Reduces 5-6 reads to 1 per page.
2. **Short-term:** Extend TTLs where safe (e.g., clients from 2min to 5min, sidebar from 5min to 10min).
3. **Medium-term:** Upgrade Vercel KV plan.
4. **Long-term:** Evaluate moving hot-path caching to edge config or in-memory (warm function instances).

**Lead time:** Item 1 is 1 day. Item 2 is trivial. Item 3 is a plan change. Item 4 requires evaluation.

#### Trigger 3: Realtime WebSocket Connections > 80% of Plan Limit

**How to measure:** Supabase Dashboard > Realtime > Connections.

**Threshold:** Sustained connections > 80% of plan limit.

**Actions:**
1. **Immediate:** Audit for duplicate pooled/non-pooled subscriptions (T3-4).
2. **Short-term:** Implement T2-4 (filter reaction subscription) to reduce per-connection bandwidth.
3. **Medium-term:** Implement T2-9 (defer realtime on mobile) to reduce idle connections.
4. **Long-term:** Upgrade Supabase plan for higher connection limit.

**Lead time:** Items 1-3 are 1-2 weeks each. Item 4 is a plan change.

#### Trigger 4: p95 Response Time > 3 Seconds at Normal Load

**How to measure:** Vercel Analytics > Web Vitals. Or k6 load test results.

**Threshold:** p95 response time for any page > 3,000ms under normal load (50 VUs) for 3+ days.

**Actions:**
1. **Diagnose:** Run load test scripts from `10-load-testing.md` to identify bottleneck.
2. **If database:** Check for missing indexes, unbounded queries, connection pool exhaustion.
3. **If caching:** Check KV hit rates, TTL appropriateness, stampede patterns.
4. **If compute:** Check cold start frequency, function execution time distribution.
5. **If network:** Check Supabase region alignment, KV region, CDN configuration.

#### Trigger 5: Data Volume Growth

**How to measure:** Query `pg_stat_user_tables` for row counts on key tables.

**Thresholds:**

| Table | Warning | Critical | Action |
|---|---|---|---|
| tasks (per project) | 500 rows | 2,000 rows | Implement virtual scrolling for board view (T3-1) |
| tasks (total) | 50,000 rows | 200,000 rows | Verify index coverage, partition if needed |
| projects (per org) | 200 | 1,000 | Add pagination to sidebar projects query |
| clients (per org) | 200 | 1,000 | Already paginated; verify index alignment |
| inbox_items (per user) | 1,000 | 10,000 | Add archival/cleanup strategy |

### 4.3 Capacity Planning Formula

**Concurrent database connections at N concurrent users:**

```
connections_peak = N * (requests_per_page / avg_think_time_seconds) * avg_query_duration_seconds

Example at 200 users:
= 200 * (4 / 15) * 0.05
= 200 * 0.267 * 0.05
= 2.67 connections per user
= ~53 concurrent connections (within 60-200 pool)

With project detail page (14 queries):
= 200 * 0.15 (15% viewing detail) * (14 / 15) * 0.05
= 30 * 0.933 * 0.05
= ~1.4 additional connections from detail viewers
```

**KV commands per second at N concurrent users:**

```
kv_commands_per_second = N * (kv_reads_per_page / avg_think_time_seconds)

Example at 200 users:
= 200 * (7 / 15)
= 200 * 0.467
= ~93 KV commands/second (well within 1,000 limit)
```

**Realtime connections at N concurrent users (with auto-pause):**

```
realtime_connections = N * avg_channels_per_user * active_tab_ratio

Example at 200 users:
= 200 * 2 * 0.5
= ~200 connections (at plan boundary for Pro)
```

### 4.4 Growth Projections and Scaling Plan

| Concurrent Users | Expected Timeline | Bottleneck | Required Actions |
|---|---|---|---|
| 50 (current) | Now | None | Implement Tier 1 optimizations |
| 100 | +3 months | Cache stampede at TTL boundaries | T1-11 (stale-while-revalidate) |
| 200 | +6 months | Realtime connections, PgBouncer queuing | T2-1, T2-4, T2-9; evaluate Supabase plan upgrade |
| 300 | +9 months | PgBouncer saturation, KV rate limits | Supabase plan upgrade, T2-5 (mget) |
| 500 | +12 months | Multiple resource saturation | Enterprise plans, architectural review |

---

## 5. Review Cycle Schedule and Process

### 5.1 Weekly Performance Check (15 minutes)

**When:** Every Monday morning, part of the team standup or async.

**Who:** Any developer deploying code that week. Can be rotated.

**What to check:**

1. **Vercel Analytics Dashboard** (2 minutes)
   - Review CWV trends for the past week (LCP, CLS, FID/INP).
   - Flag any downward trend or individual metric crossing "Needs Improvement" threshold.

2. **CI Performance Results** (3 minutes)
   - Review the most recent PR performance regression reports.
   - Note any soft budget warnings that appeared but did not block.
   - If the same warning appears on 3+ PRs, escalate to investigation.

3. **Supabase Dashboard** (3 minutes)
   - Check database connection pool utilization graph.
   - Check Realtime connection count graph.
   - Check query performance tab for slow queries.

4. **Error Rate** (2 minutes)
   - Review Vercel function logs for elevated error rates.
   - Check for any new `500` errors in the past week.

5. **Action Items** (5 minutes)
   - Create tickets for any issues found.
   - Update the backlog if a new optimization opportunity is identified.

**Output:** Brief Slack message or standup note summarizing: "Performance nominal" or "Issue: [description], tracking in [ticket]."

### 5.2 Monthly Performance Review (60 minutes)

**When:** First Thursday of every month.

**Who:** Engineering team lead + 1-2 developers.

**Agenda:**

| Time | Item | Detail |
|---|---|---|
| 0-10 min | **CWV Trend Review** | Review 30-day trend of LCP, CLS, FID/INP from Vercel Analytics. Compare to previous month. Note improvements or regressions. |
| 10-20 min | **Load Test Results** | Run the composite k6 load test (Script 06 from `10-load-testing.md`) at current normal load. Compare results to previous month's run. |
| 20-30 min | **Capacity Check** | Review all scaling trigger metrics (Section 4.2). Note any approaching thresholds. |
| 30-40 min | **Backlog Triage** | Review Tier 1 and Tier 2 items. Update status. Promote or demote items based on new data. |
| 40-50 min | **Budget Review** | Check if any budgets are consistently 80%+ of limit. Consider tightening. Check if any budgets caused false positives. Consider adjusting. |
| 50-60 min | **Action Items** | Assign ownership for identified work. Schedule implementation in upcoming sprints. |

**Output:** Monthly performance report (Markdown in the repo or team wiki) with:
- Summary of CWV trends (improved / stable / degraded)
- Load test comparison table (current vs. previous month)
- Capacity utilization summary
- Backlog updates
- Action items with owners and deadlines

### 5.3 Quarterly Performance Review (2 hours)

**When:** First week of every quarter (January, April, July, October).

**Who:** Full engineering team.

**Agenda:**

| Time | Item |
|---|---|
| 0-20 min | **Quarter in Review:** Summarize all performance changes made this quarter. What was the cumulative impact? |
| 20-40 min | **Budget Calibration:** Review all Tier 1 and Tier 2 budgets. Tighten budgets where actual values have improved by 20%+. Loosen budgets where features legitimately increased payload. Document every change with rationale. |
| 40-60 min | **Capacity Planning Update:** Update the growth projections (Section 4.4) based on actual user growth data. Re-evaluate scaling trigger thresholds. |
| 60-80 min | **Architecture Review:** Assess whether the current architecture can support the next quarter's projected load. Identify any architectural changes needed (e.g., read replicas, edge caching, connection pool upgrades). |
| 80-100 min | **Tooling and Process Review:** Evaluate the effectiveness of the CI performance gates. Are they catching real regressions? Are they causing false positives? Adjust thresholds and tools as needed. |
| 100-120 min | **Next Quarter Plan:** Prioritize the optimization backlog for the next quarter. Set specific goals (e.g., "Reduce project detail page to 2 Supabase calls" or "Achieve <1.5s LCP on all pages"). |

**Output:** Quarterly performance report with:
- Quarter-over-quarter comparison of all key metrics
- Updated budget table with change justifications
- Updated capacity projections
- Next quarter's optimization goals and assigned work

### 5.4 Ad-Hoc Performance Investigation

**Trigger:** Any of the following:
- A user reports slow page loads
- A scaling trigger threshold is crossed (Section 4.2)
- A CI performance test starts failing consistently
- A Vercel/Supabase outage affects performance

**Process:**

1. **Reproduce:** Confirm the issue using the relevant k6 script or Playwright test.
2. **Diagnose:** Use the diagnostic tree in the runbooks (Section 7).
3. **Root cause:** Identify the specific bottleneck (database, cache, compute, network).
4. **Fix or mitigate:** Implement the fix. If the fix is in the backlog, fast-track it.
5. **Validate:** Re-run the reproduction test. Confirm the budget is met.
6. **Post-mortem:** Document what happened, why, and what prevents recurrence. Add to the monthly review.

---

## 6. A/B Testing Framework for Performance Changes

### 6.1 When to A/B Test Performance Changes

Not every optimization needs an A/B test. Use this decision tree:

```
Is the change purely backend/infrastructure (no UX change)?
  YES --> Deploy directly. Validate with load tests and monitoring.
          Examples: New database index, RPC function, cache TTL change.
  NO  --> Does the change alter user-visible behavior?
    YES --> Full A/B test required.
            Examples: Reducing page size from 50 to 25 on mobile,
                      deferring realtime connections, lazy-loading a modal.
    NO  --> Deploy with feature flag. Monitor before/after.
            Examples: AVIF image format, Skew Protection, SW caching.
```

### 6.2 A/B Testing Architecture

The PMS application does not have a built-in A/B testing framework. The recommended approach uses Vercel Edge Config (referenced in `08-cdn.md` Section 7c) for feature flags, combined with Vercel Analytics for measurement.

#### Feature Flag Setup

```typescript
// lib/feature-flags.ts
import { get } from '@vercel/edge-config'

export type PerformanceFlags = {
  mobilePageSize: 25 | 50
  deferRealtimeOnMobile: boolean
  avifEnabled: boolean
  swr_cache: boolean
}

export async function getPerformanceFlags(): Promise<PerformanceFlags> {
  // Edge Config reads are ~0ms (in-memory at edge PoP)
  return {
    mobilePageSize: await get('perf_mobile_page_size') || 50,
    deferRealtimeOnMobile: await get('perf_defer_realtime_mobile') || false,
    avifEnabled: await get('perf_avif_enabled') || true,
    swr_cache: await get('perf_swr_cache') || false,
  }
}
```

#### Variant Assignment

For user-facing A/B tests, assign users to variants based on their user ID:

```typescript
// lib/ab-testing.ts
export function getVariant(userId: string, experimentName: string): 'control' | 'treatment' {
  // Deterministic hash: same user always gets same variant
  const hash = simpleHash(`${userId}:${experimentName}`)
  return hash % 2 === 0 ? 'control' : 'treatment'
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
```

#### Measurement via Vercel Analytics

```typescript
// Track performance metrics per variant
import { track } from '@vercel/analytics'

// After page load
track('page_load', {
  page: '/tasks',
  variant: variant, // 'control' or 'treatment'
  lcp: lcpValue,
  ttfb: ttfbValue,
  itemCount: items.length,
})
```

### 6.3 A/B Test Execution Checklist

For each performance A/B test:

1. **Define hypothesis:** "Reducing mobile page size from 50 to 25 will reduce mobile LCP by 30%."
2. **Define success metric:** Primary (LCP), secondary (user engagement, load-more click rate).
3. **Define sample size:** Calculate required sample size for statistical significance. For performance metrics with high variance, target at least 1,000 page loads per variant.
4. **Set duration:** Run for at least 2 weeks to capture weekday/weekend patterns.
5. **Implement with feature flag:** Use Edge Config to control the variant.
6. **Monitor during test:** Check for errors, extreme latency, or UX issues in either variant.
7. **Analyze results:** Compare primary metric distributions between variants. Use Mann-Whitney U test (non-parametric) for latency distributions.
8. **Make decision:** If treatment is statistically better, roll out to 100%. If no difference, keep the simpler implementation.
9. **Document:** Record the experiment, hypothesis, results, and decision.

### 6.4 Planned A/B Tests

| Experiment | Hypothesis | Variants | Primary Metric | Priority |
|---|---|---|---|---|
| Mobile page size | 25-item pages load 30% faster than 50-item on mobile | Control: 50, Treatment: 25 | Mobile LCP | Medium (after T3-6) |
| Deferred realtime on mobile | 3s realtime delay improves mobile FCP by 20% | Control: 0s delay, Treatment: 3s delay | Mobile FCP | Medium (after T2-9) |
| Stale-while-revalidate cache | SWR eliminates p95 spikes at TTL boundaries | Control: current cache-aside, Treatment: SWR | p95 page response time | High (after T1-11) |
| CSS theme splitting | Splitting themes reduces FCP by 100ms+ | Control: all themes in globals.css, Treatment: dynamic theme loading | FCP | Low (after T2-7) |

### 6.5 Validating Backend-Only Changes

For changes that do not require an A/B test (database indexes, RPC functions, cache improvements), validation uses before/after comparison:

1. **Before:** Run relevant k6 load test script. Record p50, p95, p99, error rate.
2. **Deploy the change.**
3. **After:** Run the same k6 script with identical configuration. Record same metrics.
4. **Compare:** Calculate improvement percentage. Document in monthly review.

For database changes specifically:

```sql
-- Run BEFORE and AFTER adding index/RPC:
EXPLAIN ANALYZE SELECT * FROM tasks
WHERE project_id = 'some-id'
ORDER BY sort_order ASC, id ASC
LIMIT 51;

-- Record execution time, scan type (Seq Scan vs. Index Scan), rows examined.
```

---

## 7. Operational Runbooks

### 7.1 Runbook: Performance Degradation Detected

**Trigger:** p95 response time > 2x normal for any page for 5+ minutes.

```
Step 1: Check Vercel Status (https://www.vercelstatus.com/)
        Is there a platform issue?
          YES --> Wait for resolution. No action needed.
          NO  --> Continue to Step 2.

Step 2: Check Supabase Status (https://status.supabase.com/)
        Is there a database/auth/realtime issue?
          YES --> Wait for resolution. Enable graceful degradation if available.
          NO  --> Continue to Step 3.

Step 3: Check Vercel Function Logs
        Are there elevated error rates (500s, timeouts)?
          YES --> Identify the failing function. Check for:
                  - Database connection errors (PgBouncer exhaustion)
                  - KV errors (rate limit, timeout)
                  - Auth errors (token refresh failures)
                  - OOM errors (memory exceeded)
          NO  --> Continue to Step 4.

Step 4: Check Supabase Dashboard > Database > Query Performance
        Are there slow queries (> 500ms)?
          YES --> Check EXPLAIN ANALYZE on the slow query.
                  Is it missing an index? --> Create index (Tier 1 items).
                  Is it an unbounded scan? --> Implement RPC (Tier 1 items).
                  Is it connection pool queuing? --> Check pool utilization.
          NO  --> Continue to Step 5.

Step 5: Check Vercel KV Dashboard
        Is the command rate near the plan limit?
          YES --> Implement T2-5 (mget batching). Extend safe TTLs.
          NO  --> Is the latency elevated (> 10ms)?
            YES --> Check Upstash status. Consider region alignment.
            NO  --> Continue to Step 6.

Step 6: Check for recent deployments
        Was a deployment made in the last 30 minutes?
          YES --> Review the deployment diff for performance-affecting changes:
                  - New dependencies added statically
                  - Removed dynamic() imports
                  - Changed cache TTLs
                  - Modified query patterns
                  Roll back if confirmed as the cause.
          NO  --> Continue to Step 7.

Step 7: Run diagnostic load test
        Execute k6 script 01 (dashboard navigation) at current VU count.
        Compare results to last known good baseline.
        Identify which specific page/action is degraded.
        Investigate that page's specific data-fetching path.
```

### 7.2 Runbook: CI Performance Test Failure

**Trigger:** PR blocked by a performance budget violation.

```
Step 1: Identify the failing budget
        Read the CI output. Which metric failed?
          - RSC payload size --> The PR likely added new data fields to the RSC serialization.
                                Review server component data passing. Are Pick<> types maintained?
          - Bundle size     --> The PR likely added a new dependency or removed a dynamic import.
                                Run `pnpm build:analyze` locally and inspect the route chunk.
          - Lighthouse score --> Check which specific audit failed (LCP, TBT, CLS, etc.).
                                Run Lighthouse locally to reproduce.
          - Route transition --> The PR likely added a slow server action or removed a cache.
                                Profile the navigation with browser DevTools.

Step 2: Is this a legitimate regression?
          YES --> Fix it. Do not raise the budget.
          NO (flaky test) --> Re-run CI. If it passes on retry, investigate test stability.
          INTENTIONAL (feature requires it) --> Update the budget with justification in the PR.

Step 3: After fixing, verify locally before re-pushing
          - RSC: Run the relevant page, inspect network tab for response size.
          - Bundle: Run `pnpm build` and check route sizes.
          - Lighthouse: Run `npx lhci autorun` locally.
          - Navigation: Run `pnpm test:e2e navigation-performance.spec.ts --headed`.
```

### 7.3 Runbook: Cache Stampede Detected

**Trigger:** Supabase query volume spikes periodically (every 30s or 2min, matching cache TTLs).

```
Step 1: Confirm stampede pattern
        In Supabase Dashboard > Database > Query Performance, check for periodic
        bursts of identical queries. If the burst frequency matches a KV TTL
        (30s for tasks, 120s for projects), this is a cache stampede.

Step 2: Short-term mitigation
        Extend the TTL of the affected cache tier by 2x.
        This reduces stampede frequency but increases data staleness.

Step 3: Long-term fix
        Implement T1-11 (stale-while-revalidate in cacheGet()).
        This serves stale data immediately while one request refreshes the cache,
        eliminating the thundering herd pattern entirely.
```

### 7.4 Runbook: New Feature Performance Review

**Trigger:** A PR introduces a new page, new API endpoint, or significant feature.

```
Step 1: Before merging, verify the following:
        [ ] New page has a loading.tsx with appropriate skeleton
        [ ] Data fetching uses Promise.all for parallel queries
        [ ] Large data sets use cursor-based pagination (limit 50)
        [ ] RSC serialization uses Pick<> types for minimal payload
        [ ] Heavy components use dynamic() imports
        [ ] Mutations use invalidateCache.* for dual-layer invalidation
        [ ] New Supabase queries have supporting indexes

Step 2: After merging, add budgets:
        [ ] Add RSC payload budget to performance-budgets.spec.ts
        [ ] Add bundle size baseline to .performance-baselines/bundle-size.json
        [ ] Add Lighthouse URL to lighthouserc.cjs (if a new page)
        [ ] Add the page to the monthly load test if it is a primary user flow
```

---

## Appendix: Cross-Reference to Previous Reports

| Report | File | Key Deliverables |
|---|---|---|
| Profiling & Baselines | `01-profiling.md` | 16 findings, P0 unbounded scans, P1 missing indexes, P1 useMemo bug |
| Observability Assessment | `02-observability.md` | No production observability; structured logging, Sentry, OTel recommendations |
| UX Performance Analysis | `03-ux-analysis.md` | Pagination UX, RSC payload analysis, skeleton matching |
| Database Optimization | `04-database.md` | 4 RPC functions, 3 composite indexes, 2 duplicate indexes to drop, KV cache gaps |
| Backend Optimization | `05-backend.md` | 11 findings: KV cache gaps, SELECT *, RSC payload reduction |
| Service Communication | `06-distributed.md` | Round-trip analysis, KV stampede risk, realtime subscription audit, project detail consolidation |
| Frontend Optimization | `07-frontend.md` | Mature architecture; AVIF, lazy TaskQuickCreateModal, lazy dompurify, CSS theme split |
| CDN & Edge Optimization | `08-cdn.md` | SW hostname bug, AVIF, CSS delivery, Skew Protection, cache headers |
| Mobile & PWA | `09-mobile.md` | No manifest, no offline fallback, realtime battery drain, adaptive loading |
| Load Testing | `10-load-testing.md` | 6 k6 scripts, bottleneck analysis at 50/200/500 VUs, breaking point predictions |
| Regression Testing | `11-regression-testing.md` | 6-dimension regression suite, CI workflows, budget definitions, Lighthouse CI setup |

### File Inventory: Budgets and Enforcement

| Budget Definition Location | What It Enforces |
|---|---|
| `lighthouserc.cjs` | Lighthouse scores, CWV thresholds, resource budgets |
| `e2e/performance-budgets.spec.ts` (to create) | RSC payload sizes, TTFB, Load More timing, CWV collection |
| `e2e/navigation-performance.spec.ts` (existing) | Route transition timing, API request counts |
| `scripts/check-bundle-size.mjs` (to create) | Per-route bundle sizes, total bundle increase |
| `.performance-baselines/bundle-size.json` (to create) | Committed bundle size baselines |
| `.github/workflows/performance-regression.yml` (to create) | Unified CI workflow for all performance checks |
| `.github/workflows/lighthouse.yml` (existing) | Lighthouse CI for public and authenticated pages |
| `.github/workflows/navigation-perf.yml` (existing) | Navigation performance CI |

### File Inventory: Load Test Scripts

| Script | File (to create) | What It Tests |
|---|---|---|
| Dashboard Navigation | `load-tests/01-dashboard-navigation.js` | Cold/warm page loads across all pages |
| Project Pagination | `load-tests/02-project-pagination.js` | Cursor-based pagination under load |
| Task Management | `load-tests/03-task-management.js` | Write operations (CRUD, reorder) |
| Inbox Polling | `load-tests/04-inbox-polling.js` | Read/write inbox pattern |
| AI Chat | `load-tests/05-ai-chat.js` | AI endpoint with rate limits |
| Composite Journey | `load-tests/06-composite-journey.js` | Realistic mixed workload |

### Key Configuration Files

| File | Performance Role |
|---|---|
| `C:\Users\Fares\Downloads\PMS\next.config.mjs` | Image formats, optimizePackageImports, cache profiles, staleTimes, headers |
| `C:\Users\Fares\Downloads\PMS\lib\cache\keys.ts` | KV cache keys and TTL values |
| `C:\Users\Fares\Downloads\PMS\lib\cache\utils.ts` | `cacheGet()` implementation (cache-aside pattern) |
| `C:\Users\Fares\Downloads\PMS\lib\cache\invalidation.ts` | Dual-layer invalidation helpers |
| `C:\Users\Fares\Downloads\PMS\lib\constants.ts` | Page sizes, limits, configuration constants |
| `C:\Users\Fares\Downloads\PMS\middleware.ts` | Edge middleware (auth, CSP, session cache) |
| `C:\Users\Fares\Downloads\PMS\public\sw.js` | Service worker (caching strategy) |
| `C:\Users\Fares\Downloads\PMS\app\layout.tsx` | Root layout (fonts, preconnect, meta) |
| `C:\Users\Fares\Downloads\PMS\app\(dashboard)\layout.tsx` | Dashboard layout (providers, parallel data fetching) |
| `C:\Users\Fares\Downloads\PMS\hooks\realtime-context.tsx` | Pooled realtime subscriptions |
| `C:\Users\Fares\Downloads\PMS\playwright.config.ts` | E2E test configuration |
| `C:\Users\Fares\Downloads\PMS\lighthouserc.cjs` | Lighthouse CI configuration |
