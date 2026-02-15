# Observability Assessment: PMS Application

**Date:** 2026-02-14
**Scope:** Cursor-based pagination, KV caching, error handling, distributed tracing, and overall monitoring posture
**Application:** Next.js 16 + Supabase SaaS project management platform
**Deployment:** Vercel (production), Supabase Cloud (database)

---

## Executive Summary

The PMS application has **no production observability stack**. There is no error tracking service (Sentry, Bugsnag), no distributed tracing (OpenTelemetry), no structured logging pipeline, no custom metrics collection, and no dashboards for system health. The only monitoring comes from two lightweight Vercel integrations (`@vercel/analytics` and `@vercel/speed-insights`) and a Lighthouse CI configuration that tests only unauthenticated public pages.

Cursor-based pagination has been implemented across four server action modules (tasks, inbox, clients, projects) but operates entirely unobserved. There is zero instrumentation measuring query latency, cache hit rates, pagination depth, error rates on paginated endpoints, or client-side load-more timing. The KV caching layer logs errors to `console.error` but has no metrics, no hit/miss counters, and no alerting.

**Risk Level: High.** The application has no way to detect degraded pagination performance, stale cache serving, or elevated error rates before users report them.

---

## 1. Current Monitoring Inventory

### 1.1 What Exists

| Component | Implementation | Location | Coverage |
|-----------|---------------|----------|----------|
| Vercel Analytics | Page views, Web Vitals | `components/analytics-wrapper.tsx` | Client-side only, deferred loading |
| Vercel Speed Insights | Core Web Vitals (CWV) | `components/analytics-wrapper.tsx` | Client-side only |
| Lighthouse CI | Synthetic audits | `lighthouserc.cjs` | 3 public pages only (login, signup, forgot-password) |
| Console logging | `console.error` / `console.warn` | Scattered across `lib/cache/`, `lib/actions/`, `lib/rate-limit/` | Unstructured, goes to Vercel function logs |

### 1.2 What Does Not Exist

- **Error tracking service** (Sentry, Bugsnag, Datadog RUM): Not installed. No dependency in `package.json`.
- **Distributed tracing** (OpenTelemetry, Jaeger, X-Ray): No `instrumentation.ts` file, no OTel SDK, no trace context propagation.
- **Structured logging** (Pino, Winston, Axiom, LogFlare, Better Stack): No logging library. All logging is raw `console.error`/`console.warn`.
- **Custom metrics** (StatsD, Prometheus, Datadog custom metrics): None.
- **Application Performance Monitoring (APM)**: None.
- **Alerting** (PagerDuty, OpsGenie, Slack webhooks): None.
- **SLI/SLO tracking**: None defined.
- **Health check endpoint**: None.
- **Real User Monitoring beyond Vercel**: None.
- **Database query monitoring**: Relies entirely on Supabase dashboard (no application-side query timing).
- **CI/CD monitoring workflows**: No `.github/workflows/` directory found. No performance regression gates.

---

## 2. Cursor-Based Pagination: Implementation Without Observability

### 2.1 Implementation Summary

Cursor-based pagination is implemented in four server action modules:

| Module | File | Cursor Column(s) | Page Size |
|--------|------|-------------------|-----------|
| Tasks (project) | `lib/actions/tasks/queries.ts` (`getTasks`) | `sort_order` + `id` (ASC) | 50 (DEFAULT_PAGE_SIZE) |
| Tasks (my tasks) | `lib/actions/tasks/queries.ts` (`getMyTasks`) | `updated_at` + `id` (DESC) | 50 |
| Inbox | `lib/actions/inbox.ts` (`getInboxItems`) | `created_at` + `id` (DESC) | 50 (INBOX_PAGE_SIZE) |
| Clients | `lib/actions/clients.ts` (`getClients`) | `name` + `id` (ASC) | 50 |
| Projects | `lib/actions/projects/crud.ts` (`getProjects`) | Cursor support imported | 50 |

The cursor encoding uses compound cursors (`[orderingValue, rowId]` base64url-encoded) defined in `lib/actions/cursor.ts`. The `limit + 1` pattern is used to determine `hasMore` without a separate count query.

The client-side hook `hooks/use-load-more.ts` provides a generic `useLoadMore<T>` hook, and `components/ui/load-more-button.tsx` renders the UI trigger.

### 2.2 Observability Gaps in Pagination

**Gap 1: No query latency measurement.**
There is no timing wrapper around any Supabase query in the pagination path. When `getTasks(projectId, filters, cursor, limit)` is called, the query executes, and the result is returned. There is no record of how long the query took. This means:
- Slow queries on large datasets go undetected.
- Degradation over time (as data grows) is invisible.
- There is no way to compare first-page vs. deep-page latency.

**Gap 2: No pagination depth tracking.**
The application does not record how many pages users load, whether they reach the end, or at what cursor depth performance degrades. There is no telemetry for:
- Average pages loaded per session.
- Cursor values at the point of abandonment.
- Whether `hasMore: true` results in a follow-up request.

**Gap 3: No error rate tracking on paginated endpoints.**
Errors in paginated queries return `{ error: string }` to the client. The `useLoadMore` hook logs to `console.error("Load more failed:", result.error)` on the client side. There is no server-side error counter, no error categorization (invalid cursor vs. auth failure vs. DB error), and no alerting threshold.

Example from `lib/actions/tasks/queries.ts` lines 62-74:
```typescript
if (cursor) {
    try {
      const { value, id } = decodeCursor(cursor)
      const cursorSort = Number(value)
      if (Number.isNaN(cursorSort)) {
        return { error: "Invalid cursor value" }
      }
      // ...
    } catch {
      return { error: "Invalid cursor" }
    }
```
An invalid cursor error returns silently. There is no logging, no counter increment, and no context about which user or project triggered it.

**Gap 4: No client-side load-more timing.**
The `useLoadMore` hook sets `isLoading = true` and `isLoading = false` but does not measure the elapsed time between those state transitions. There is no `performance.mark()` or `performance.measure()` call. Frontend pagination latency (including network round-trip + server action execution + React rendering) is completely unmeasured.

**Gap 5: No caching interaction visibility for paginated queries.**
For `getMyTasks` and `getClients`, the first page (unfiltered, no cursor) uses KV cache. Subsequent pages bypass the cache entirely. There is no metric distinguishing:
- Cache-served first-page responses vs. DB-served subsequent pages.
- Whether the cache-served first page was actually a hit or a miss.
- The latency delta between cached and uncached pages.

---

## 3. KV Cache Layer: Invisible Hit/Miss Rates

### 3.1 Current State

The KV caching layer (`lib/cache/`) uses a cache-aside pattern implemented in `lib/cache/utils.ts`:

```typescript
// lib/cache/utils.ts - cacheGet function
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  try {
    const cached = await cache.get<T>(key)
    if (cached !== null) {
      return cached  // HIT - no logging, no counter
    }
  } catch (error) {
    console.error(`[cache] GET error for ${key}:`, error)  // Error only
  }

  // MISS - no logging, no counter
  const fresh = await fetcher()

  // Write-behind (non-blocking)
  cache.set(key, fresh, { ex: ttlSeconds }).catch((error) => {
    console.error(`[cache] SET error for ${key}:`, error)
  })

  return fresh
}
```

### 3.2 Observability Gaps in Caching

**Gap 1: No hit/miss rate metrics.**
The `cacheGet` function returns data without recording whether it came from cache or the database. There are no counters, no histograms, and no ratios. This means:
- The overall cache effectiveness is unknown.
- TTL tuning is guesswork (current TTLs range from 30s for tasks to 10min for user data).
- There is no way to detect a cold-cache storm (e.g., after deployment when all KV entries are stale).

**Gap 2: No cache latency measurement.**
The KV `get` and `set` calls are not timed. The in-memory fallback (`memCache`) and the KV path (`@vercel/kv`) have very different latency profiles (microseconds vs. 5-50ms), but this is never measured.

**Gap 3: No eviction or expiration visibility.**
The in-memory cache has LRU eviction logic in `lib/cache/client.ts` with `console.warn` for threshold and eviction events. But these warnings:
- Go to unstructured Vercel function logs.
- Are not aggregated or alerted on.
- Only apply to the in-memory fallback (local dev), not production KV.

**Gap 4: No invalidation audit trail.**
The `invalidateCache.*` helpers in `lib/cache/invalidation.ts` delete KV keys and call `revalidateTag`. There is no record of:
- How many invalidations occur per minute.
- Which entities trigger the most invalidations.
- Whether invalidation cascades cause cache stampedes.

**Gap 5: Cache warming is fire-and-forget.**
`lib/cache/warm.ts` (`warmUserCache`) runs after login and uses `Promise.allSettled`. Failures are logged with `console.error("[cache] warmUserCache error:", error)` but there is no success/failure counter and no timing measurement.

---

## 4. Error Handling and Error Reporting

### 4.1 Error Handling Pattern

All server actions use the `ActionResult<T>` pattern (`{ data?, error? }`). Errors are string messages, not structured error objects. The codebase has two error handling patterns:

**Pattern A: Try-catch with console.error (used in task-comments, task-activities)**
```typescript
} catch (error) {
    console.error("Error creating task comment:", error)
    return { error: "An unexpected error occurred" }
}
```

**Pattern B: Supabase error forwarding (used in tasks, projects, clients)**
```typescript
if (error) {
    return { error: error.message }
}
```

### 4.2 Error Reporting Gaps

**Gap 1: Error context is lost.**
When Pattern A catches an error, the original error is logged to console but the client receives a generic "An unexpected error occurred" message. The console log includes the error object but lacks:
- User ID
- Organization ID
- Request ID / trace ID
- The specific input parameters that caused the error

**Gap 2: No error categorization.**
All errors are string messages. There is no distinction between:
- Client errors (invalid input, expired cursor, authorization failure)
- Server errors (database timeout, KV unavailable, network failure)
- Transient errors (rate limited, concurrent conflict)

**Gap 3: No error aggregation.**
Without an error tracking service, there is no way to see:
- Error count by endpoint over time.
- Most frequent error messages.
- Error rate spikes correlated with deployments.
- Stack traces grouped by root cause.

**Gap 4: Rate limiting errors are invisible.**
The rate limiter in `lib/rate-limit/limiter.ts` returns `{ error: "Rate limit exceeded..." }` but does not log when limits are hit. There are no counters for rate-limited requests by limiter type (auth, AI, file upload, invite).

---

## 5. Distributed Tracing Assessment

### 5.1 Current State: None

There is no distributed tracing implementation. Specifically:

- No `instrumentation.ts` or `instrumentation.node.ts` file (Next.js's built-in OpenTelemetry support hook).
- No OpenTelemetry SDK (`@opentelemetry/*`) in `package.json`.
- No trace context propagation between middleware, server actions, and Supabase queries.
- No span creation for cache operations, database queries, or external API calls (AI providers).
- No Vercel Observability or Function Insights configuration beyond the default.

### 5.2 Impact

Without distributed tracing, the following diagnostic scenarios are blind:

- **Request waterfall analysis:** A page load may trigger `getPageOrganization()` -> `cachedGetUser()` -> `getSession()` -> `getCachedProjects()` -> KV lookup -> Supabase query. Each step's contribution to total latency is unknown.
- **Supabase query performance:** Individual query execution times are not captured at the application level. Supabase's dashboard shows aggregate stats but not per-request traces.
- **Cache-vs-DB decision latency:** Whether a request hit KV cache or fell through to the database is not recorded in any trace.
- **Cross-action correlation:** When a "Load More" click triggers a server action, there is no way to correlate the client-side event with the server-side execution and the resulting Supabase query.

---

## 6. Log Aggregation Assessment

### 6.1 Current State: Console Only

All logging uses raw `console.error` and `console.warn`. There is no structured logging library. Log output goes to:
- **Local development:** Terminal stdout.
- **Production (Vercel):** Vercel Function Logs, which have a 1-hour retention on the Hobby plan and 3 days on Pro.

### 6.2 Observed Log Patterns

Across the codebase, I found the following `console.error`/`console.warn` calls in `lib/`:

| Module | Count | Typical Message |
|--------|-------|-----------------|
| `lib/cache/utils.ts` | 4 | `[cache] GET/SET/DEL error for {key}` |
| `lib/cache/invalidate.ts` | 3 | `[cache] invalidate.key/keys/search error` |
| `lib/cache/client.ts` | 2 | `[mem-cache] Size warning / LRU eviction` |
| `lib/cache/warm.ts` | 1 | `[cache] warmUserCache error` |
| `lib/rate-limit/limiter.ts` | 2 | `[rate-limit] KV unavailable / KV error` |
| `lib/actions/task-comments.ts` | 8 | Various `Error creating/updating/deleting` |
| `lib/actions/task-activities.ts` | 3 | Various activity fetch/create errors |
| `lib/actions/projects/crud.ts` | 1 | `Failed to validate organization members` |
| `lib/server-cache.ts` | 1 | `[cache] get_dashboard_stats RPC failed` |

### 6.3 Gaps

**Gap 1: No structured format.**
Logs are free-form strings. No JSON structure, no log levels beyond error/warn, no request correlation IDs.

**Gap 2: No log aggregation service.**
No Axiom, LogFlare, Better Stack, Datadog Logs, or similar service. Vercel's built-in function logs have severe retention limits and no search/alerting capability.

**Gap 3: No request context in logs.**
When `console.error("[cache] GET error for pms:tasks:project:abc123:", error)` fires, there is no user ID, no request path, no timestamp precision, and no way to correlate this with other events in the same request.

**Gap 4: Pagination queries produce zero log output.**
A successful paginated query leaves no trace in logs. A slow query (e.g., 5 seconds) leaves no trace in logs. Only complete failures (thrown exceptions) are logged in certain modules.

---

## 7. Supabase Query Performance Monitoring

### 7.1 Current State

Supabase query performance monitoring relies entirely on:
- **Supabase Dashboard:** Query performance tab shows slow queries, but only at the database level. No application-side correlation.
- **Supabase Advisors:** The `mcp__supabase__get_advisors` tool can check for security and performance issues, but this is manual and ad-hoc.
- **No query timing at the application level.** No Supabase client middleware or interceptor measures query execution time.

### 7.2 Pagination-Specific Database Concerns

The cursor-based pagination queries use compound cursor conditions:
```sql
-- getTasks cursor condition
(sort_order > :cursorSort) OR (sort_order = :cursorSort AND id > :cursorId)
```

These `OR` conditions with inequality operators may not efficiently use B-tree indexes, especially on larger datasets. Without application-side query timing, the only way to detect this degradation is through Supabase's dashboard, which:
- Requires manual inspection.
- Does not alert on threshold violations.
- Does not correlate with user-facing latency.

---

## 8. Lighthouse CI and Performance Testing

### 8.1 Current Coverage

The Lighthouse CI configuration (`lighthouserc.cjs`) tests only three unauthenticated pages:
- `/login`
- `/signup`
- `/forgot-password`

It runs 3 iterations, uses desktop preset, and asserts:
- Performance score >= 0.75
- Best Practices >= 0.95
- Accessibility >= 0.9
- TBT <= 500ms, CLS <= 0.1

### 8.2 Gaps

**Gap 1: No authenticated page testing.**
All dashboard pages (projects, tasks, inbox, clients, settings, chat) that use pagination are not covered by Lighthouse CI.

**Gap 2: No navigation performance testing in CI.**
The CLAUDE.md mentions `navigation-performance.spec.ts` and a `.github/workflows/navigation-perf.yml`, but no `.github/workflows/` directory exists and no `navigation-performance.spec.ts` file was found in `e2e/`. These appear to be documented but not yet implemented.

**Gap 3: No pagination-specific performance testing.**
There are no tests that measure:
- Time to load the first page of tasks/projects/clients.
- Time to load subsequent pages via cursor.
- Performance degradation with large datasets.
- Cache warm vs. cold performance difference.

---

## 9. Summary of Findings by Category

### 9.1 Critical Gaps (No visibility at all)

| Area | Status |
|------|--------|
| Pagination query latency | Not measured |
| KV cache hit/miss rates | Not measured |
| Error rates by endpoint | Not tracked |
| Distributed tracing | Not implemented |
| Structured logging | Not implemented |
| Production alerting | Not configured |
| Health check endpoint | Does not exist |
| SLI/SLO definitions | None |

### 9.2 Partial Coverage (Exists but insufficient)

| Area | Status |
|------|--------|
| Client-side Web Vitals | Vercel Speed Insights (aggregate only, no pagination-specific breakdowns) |
| Client-side analytics | Vercel Analytics (page views only, no custom events) |
| Synthetic testing | Lighthouse CI on 3 public pages (no authenticated coverage) |
| Error logging | `console.error` to Vercel function logs (short retention, no alerting) |
| Rate limit monitoring | In-memory fallback logs, but no production metrics |

### 9.3 Well-Implemented (But unobserved)

| Area | Status |
|------|--------|
| Cursor encoding/decoding | Correct compound cursor implementation in `lib/actions/cursor.ts` |
| Cache-aside pattern | Properly implemented with non-blocking writes in `lib/cache/utils.ts` |
| Dual-layer invalidation | Next.js tags + KV invalidation unified in `lib/cache/invalidation.ts` |
| Rate limiting | Robust with KV primary + in-memory fallback in `lib/rate-limit/limiter.ts` |
| Security headers | CSP with per-request nonce, HSTS, X-Frame-Options in `middleware.ts` and `next.config.mjs` |

---

## 10. Recommendations Priority Matrix

### P0 -- Implement Immediately

1. **Add an error tracking service.** Sentry or Datadog RUM with source maps. Captures unhandled exceptions, server action errors, and provides user session context. Estimated integration time: 2-4 hours.

2. **Add instrumentation.ts for OpenTelemetry.** Next.js 16 natively supports `instrumentation.ts`. This provides server-side traces for every request, including Supabase queries, cache operations, and server action execution. Vercel automatically exports traces when OTel is configured.

3. **Add cache hit/miss counters to `cacheGet`.** At minimum, log structured JSON with `{ event: "cache_hit"|"cache_miss", key, latencyMs }`. Better: emit as OpenTelemetry span attributes.

### P1 -- Implement This Sprint

4. **Add query timing to paginated server actions.** Wrap the Supabase query in each paginated function with `performance.now()` start/end and emit as a span or structured log.

5. **Add pagination depth and load-more timing metrics.** Instrument `useLoadMore` hook with `performance.mark`/`performance.measure` and report via Vercel Analytics custom events or a RUM provider.

6. **Set up structured logging.** Replace `console.error`/`console.warn` with a logger (Pino for Next.js) that outputs JSON with request ID, user ID, and timestamp. Route to a log aggregation service (Axiom, Better Stack, or Vercel Log Drain).

### P2 -- Implement This Quarter

7. **Define SLIs and SLOs for paginated endpoints.** Example SLIs: p50/p95/p99 latency for `getTasks`, `getMyTasks`, `getClients`, `getInboxItems`. Example SLO: p95 < 500ms for first page, p95 < 1s for subsequent pages.

8. **Expand Lighthouse CI to authenticated pages.** Use Playwright-based Lighthouse runs with stored auth state to test dashboard pages.

9. **Implement the navigation performance tests.** The documentation references `navigation-performance.spec.ts` but it does not exist. Create E2E tests that measure client-side route transition times for paginated views.

10. **Add a health check endpoint.** Create `/api/health` that verifies Supabase connectivity, KV availability, and returns a structured status response. Use for uptime monitoring.

### P3 -- Implement When Scaling

11. **Add Supabase query EXPLAIN analysis.** For cursor-based pagination queries, periodically run `EXPLAIN ANALYZE` to verify index usage as data grows.

12. **Implement cache stampede protection.** Add a distributed lock or stale-while-revalidate pattern to prevent thundering herd on cache misses after invalidation.

13. **Set up alerting.** PagerDuty or Slack webhook alerts for: error rate > 5% on any endpoint, p95 latency > 2s on paginated queries, KV cache miss rate > 80%, rate limit exhaustion events.

---

## 11. Files Examined

The following files were read and analyzed as part of this assessment:

- `C:\Users\Fares\Downloads\PMS\package.json` -- Dependencies (no monitoring libraries)
- `C:\Users\Fares\Downloads\PMS\next.config.mjs` -- Next.js config (no OTel, no instrumentation)
- `C:\Users\Fares\Downloads\PMS\middleware.ts` -- Auth middleware with KV session caching
- `C:\Users\Fares\Downloads\PMS\lib\cache\index.ts` -- Cache module barrel export
- `C:\Users\Fares\Downloads\PMS\lib\cache\client.ts` -- KV client + in-memory fallback
- `C:\Users\Fares\Downloads\PMS\lib\cache\keys.ts` -- Cache key definitions and TTLs
- `C:\Users\Fares\Downloads\PMS\lib\cache\utils.ts` -- `cacheGet` / `cacheInvalidateAndFetch` (no metrics)
- `C:\Users\Fares\Downloads\PMS\lib\cache\invalidate.ts` -- KV invalidation helpers
- `C:\Users\Fares\Downloads\PMS\lib\cache\invalidation.ts` -- Unified cache invalidation (Next.js tags + KV)
- `C:\Users\Fares\Downloads\PMS\lib\cache\warm.ts` -- Post-login cache warming
- `C:\Users\Fares\Downloads\PMS\lib\server-cache.ts` -- Request-level caching with React `cache()`
- `C:\Users\Fares\Downloads\PMS\lib\request-cache.ts` -- Auth + Supabase client caching
- `C:\Users\Fares\Downloads\PMS\lib\cache-tags.ts` -- Cache tag constants
- `C:\Users\Fares\Downloads\PMS\lib\constants.ts` -- Pagination limits, cache sizes
- `C:\Users\Fares\Downloads\PMS\lib\actions\types.ts` -- `ActionResult<T>` and `PaginatedResult<T>` types
- `C:\Users\Fares\Downloads\PMS\lib\actions\cursor.ts` -- Cursor encode/decode
- `C:\Users\Fares\Downloads\PMS\lib\actions\tasks\index.ts` -- Task action barrel exports
- `C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts` -- `getTasks` and `getMyTasks` with cursor pagination
- `C:\Users\Fares\Downloads\PMS\lib\actions\inbox.ts` -- `getInboxItems` with cursor pagination
- `C:\Users\Fares\Downloads\PMS\lib\actions\clients.ts` -- `getClients` with cursor pagination
- `C:\Users\Fares\Downloads\PMS\lib\actions\projects\crud.ts` -- `getProjects` (imports cursor utilities)
- `C:\Users\Fares\Downloads\PMS\lib\actions\projects\queries.ts` -- Project queries (no pagination)
- `C:\Users\Fares\Downloads\PMS\lib\actions\search.ts` -- Global search with KV caching
- `C:\Users\Fares\Downloads\PMS\lib\actions\task-comments.ts` -- Task comments (no pagination, console.error logging)
- `C:\Users\Fares\Downloads\PMS\lib\actions\auth-helpers.ts` -- `requireAuth`, `requireOrgMember`, etc.
- `C:\Users\Fares\Downloads\PMS\lib\actions\analytics.ts` -- Performance metrics (business analytics, not observability)
- `C:\Users\Fares\Downloads\PMS\lib\actions\conversations.ts` -- Conversation queries (KV cached)
- `C:\Users\Fares\Downloads\PMS\lib\rate-limit\limiter.ts` -- Rate limiting with KV + in-memory fallback
- `C:\Users\Fares\Downloads\PMS\hooks\use-load-more.ts` -- Client-side cursor pagination hook
- `C:\Users\Fares\Downloads\PMS\components\ui\load-more-button.tsx` -- Load more UI component
- `C:\Users\Fares\Downloads\PMS\components\analytics-wrapper.tsx` -- Vercel Analytics/Speed Insights wrapper
- `C:\Users\Fares\Downloads\PMS\components\projects-content.tsx` -- Projects page with `useLoadMore`
- `C:\Users\Fares\Downloads\PMS\components\inbox\InboxContent.tsx` -- Inbox page with `useLoadMore`
- `C:\Users\Fares\Downloads\PMS\components\tasks\MyTasksPage.tsx` -- My Tasks page with `useLoadMore`
- `C:\Users\Fares\Downloads\PMS\app\layout.tsx` -- Root layout with Analytics wrapper
- `C:\Users\Fares\Downloads\PMS\lighthouserc.cjs` -- Lighthouse CI config (public pages only)
- `C:\Users\Fares\Downloads\PMS\.env.example` -- Environment variables (no monitoring service keys)
