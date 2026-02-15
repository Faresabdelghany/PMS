# Production Performance Monitoring Plan

## PMS (Project Management SaaS) -- Comprehensive Observability Strategy

**Application:** Next.js 16.1 App Router, React 19, Supabase (PostgreSQL + Realtime + Auth + Storage), Vercel, Vercel KV/Redis
**Production URL:** https://pms-nine-gold.vercel.app
**Database:** 30 tables, 218 tasks, 21 projects, 12 users, full RLS
**Last updated:** 2026-02-14

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Recommended Tooling Stack](#2-recommended-tooling-stack)
3. [SLI/SLO Definitions](#3-slislo-definitions)
4. [Error Budget Tracking](#4-error-budget-tracking)
5. [Instrumentation Plan](#5-instrumentation-plan)
6. [Alert Rules and Thresholds](#6-alert-rules-and-thresholds)
7. [Dashboard Configurations](#7-dashboard-configurations)
8. [Runbooks](#8-runbooks)
9. [Cost Analysis](#9-cost-analysis)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Current State Assessment

### What Exists Today

| Layer | Tool | Coverage | Gap |
|-------|------|----------|-----|
| Client Performance | Vercel Speed Insights | Core Web Vitals (LCP, CLS, INP, FCP, TTFB) | No custom metric tagging by route |
| Client Analytics | Vercel Analytics | Page views, unique visitors, top pages | No funnel analysis, no custom events |
| CI Performance | Lighthouse CI (GitHub Actions) | 9 pages audited on push/PR, desktop preset | No mobile preset, no authenticated page deep audit |
| CI Navigation | Playwright navigation-performance.spec.ts | Client-side route transition times | No server-side timing correlation |
| Server Logs | Vercel Functions logs (stdout) | 26 console.log/warn/error calls across `lib/` | Unstructured, no log levels, no request correlation |
| Database | Supabase Dashboard (Logflare) | Basic query metrics, auth events | No query-level latency tracking, no connection pool metrics |
| Error Tracking | None | Zero coverage | No Sentry, no error aggregation, no source maps |
| APM/Tracing | None | Zero coverage | No distributed traces, no request waterfall visibility |
| Uptime Monitoring | None | Zero coverage | No synthetic checks, no multi-region probing |
| Alerting | None | Zero coverage | No PagerDuty, no Slack notifications on incidents |

### Critical Blind Spots

1. **Server Action latency is invisible.** The 5 CRUD action groups (`projects`, `tasks`, `clients`, `inbox`, `ai`) have zero timing instrumentation. A slow Supabase query in `getTasks()` would go undetected until users report it.

2. **KV cache effectiveness is unknown.** The cache layer (`lib/cache/`) has `cacheGet()` with hit/miss logic but emits no metrics. We cannot answer: "What is the KV hit rate for `pms:projects:{orgId}`?" or "Is the 30-second TASKS TTL too aggressive?"

3. **Rate limiter rejections are silent.** `checkRateLimit()` in `lib/rate-limit/limiter.ts` returns `{ success: false }` but logs nothing. We have no visibility into how often auth brute-force or AI cost-control limits trigger.

4. **WebSocket health is opaque.** The `RealtimeProvider` in `hooks/realtime-context.tsx` manages pooled subscriptions but has no metrics for: connection count, reconnection events, subscription errors, or message latency.

5. **Middleware performance is unmeasured.** The auth middleware (`middleware.ts`) handles KV session caching, CSP nonce generation, and Supabase token refresh. Its p95 latency directly gates every authenticated request.

6. **Cache invalidation cascades are invisible.** `invalidateCache.*` in `lib/cache/invalidation.ts` orchestrates dual-layer invalidation (Next.js tags + KV). Failed invalidations cause stale data but produce only `console.error` output.

---

## 2. Recommended Tooling Stack

### Selection Criteria

- Startup-friendly pricing (free tier or <$50/month at current scale)
- Vercel/Next.js native integration where possible
- Minimal runtime overhead (<5ms per request added latency)
- No self-hosted infrastructure (the team is small)

### Chosen Stack

| Layer | Tool | Free Tier | Monthly Cost at Scale | Why |
|-------|------|-----------|----------------------|-----|
| Error Tracking | **Sentry** | 5K errors/month, 1 user | $26/month (Team plan) | Best-in-class Next.js SDK, source map upload, release tracking, session replay |
| Web Vitals | **Vercel Speed Insights** (existing) | Included with Pro | $0 | Already deployed, automatic CWV collection |
| Analytics | **Vercel Analytics** (existing) | Included with Pro | $0 | Already deployed via `AnalyticsWrapper` |
| Uptime Monitoring | **Better Stack (Uptime)** | 10 monitors, 3-min intervals | $0 (free tier) | Multi-region checks, Slack/email alerting, status page |
| Log Aggregation | **Vercel Log Drains -> Better Stack (Logs)** | 1GB/day retention 3 days | $0 (free tier) | Structured log search, Vercel native log drain integration |
| Custom Metrics | **Vercel KV counters** (existing infra) | Use existing KV | $0 (reuse KV) | Lightweight counters for cache hit/miss, rate limit rejections |
| Database Monitoring | **Supabase Dashboard + Advisors** (existing) | Included | $0 | Built-in pg_stat_statements, query plan analysis, advisory notices |
| Lighthouse CI | **GitHub Actions** (existing) | Included | $0 | Already configured in `.github/workflows/lighthouse.yml` |
| Alerting | **Better Stack + Sentry** | Included in free tiers | $0 | Sentry for error alerts, Better Stack for uptime alerts |

### What We Explicitly Do NOT Need Yet

| Tool | Why Not Now | Revisit When |
|------|-----------|-------------|
| DataDog / New Relic APM | $15-23/host/month, overkill for <500 concurrent users | >1000 DAU or first P1 latency incident with no trace data |
| Grafana Cloud (self-managed) | Operational overhead of maintaining collectors/agents | Need for custom PromQL queries or Kubernetes migration |
| OpenTelemetry Collector | No distributed microservices -- single Next.js monolith | Backend split into separate services |
| PagerDuty | $21/user/month, team is too small for on-call rotations | >3 engineers on production rotation |

---

## 3. SLI/SLO Definitions

### Service Definitions

The PMS application is decomposed into 6 logical services for SLO purposes:

| Service | Scope | Primary User Impact |
|---------|-------|-------------------|
| **Web App** | All Next.js pages (SSR + client navigation) | Users can load and navigate the dashboard |
| **Server Actions** | All `lib/actions/*.ts` mutations and queries | Users can create/edit/delete data |
| **Auth Flow** | Login, signup, OAuth, middleware session refresh | Users can authenticate and maintain sessions |
| **Realtime** | Supabase WebSocket subscriptions via `RealtimeProvider` | Live updates appear without page refresh |
| **AI Features** | AI chat, text generation, task generation | AI assistant responds to prompts |
| **File Storage** | Upload/download via Supabase Storage | Users can attach and retrieve files |

### SLI Definitions

Each SLI is defined with a measurement method, a "good" threshold, and where the data comes from.

#### 3.1 Availability SLI

```
SLI: Proportion of HTTP requests that return a non-5xx status code.

Good event:   HTTP response status < 500
Valid event:  All HTTP requests to production (excluding health checks and static assets)
Measurement:  Vercel Analytics (request logs) + Better Stack synthetic checks
```

#### 3.2 Latency SLI -- Page Load

```
SLI: Proportion of page loads where LCP (Largest Contentful Paint) is under threshold.

Good event:   LCP < 2500ms
Valid event:  All page navigation events (initial load + client-side transitions)
Measurement:  Vercel Speed Insights (real user data)
```

#### 3.3 Latency SLI -- Server Actions

```
SLI: Proportion of Server Action invocations that complete within threshold.

Good event:   Server Action duration < 1000ms (reads) or < 2000ms (writes)
Valid event:  All Server Action calls (measured via Sentry transaction tracing)
Measurement:  Sentry Performance (transaction duration)
```

#### 3.4 Error Rate SLI

```
SLI: Proportion of Server Action invocations that do NOT return { error: ... }.

Good event:   ActionResult has no error field, or error is a known user-input validation error
Valid event:  All Server Action calls
Measurement:  Sentry error tracking (unhandled exceptions + ActionResult.error logging)
```

#### 3.5 Freshness SLI -- Cache

```
SLI: Proportion of cache reads that return data younger than 2x the configured TTL.

Good event:   Cache hit returns data within acceptable staleness window
Valid event:  All cacheGet() calls to KV
Measurement:  Custom KV counter metrics (cache hit/miss counters per key prefix)
```

### SLO Targets

| SLO | Target | Window | Error Budget (30-day) |
|-----|--------|--------|----------------------|
| **Availability** | 99.5% | 30-day rolling | 3.6 hours of downtime |
| **Page Load Latency (LCP)** | 90% of loads < 2.5s | 30-day rolling | 10% of loads can exceed 2.5s |
| **Server Action Latency** | 95% of actions < 1s (reads), 95% < 2s (writes) | 30-day rolling | 5% of actions can exceed threshold |
| **Server Action Error Rate** | 99% success rate | 30-day rolling | 1% of actions can fail |
| **AI Response Time** | 90% < 10s | 30-day rolling | 10% can exceed 10s (LLM variability) |
| **Uptime (synthetic)** | 99.9% | 30-day rolling | 43 minutes of downtime |

#### Why These Targets

- **99.5% availability** (not 99.9%): This is a startup SaaS with a small team. 99.9% requires automated failover infrastructure that does not yet exist. 99.5% provides 3.6 hours of monthly budget, enough to handle a Vercel or Supabase incident without breaching SLO.

- **90% LCP < 2.5s** (not 95%): The app serves authenticated pages with server-side data fetching. Cold starts on Vercel serverless functions add 200-500ms. The 10% budget absorbs cold starts and slow network connections.

- **95% Server Actions < 1s**: Server Actions chain auth check (cachedGetUser ~0ms cached, ~300ms uncached) + KV lookup (~5ms) + Supabase query (50-200ms) + cache invalidation (~10ms). The 1s budget provides 2x headroom over the expected p50 of ~120ms.

---

## 4. Error Budget Tracking

### Error Budget Calculation

For each SLO, the error budget is calculated as:

```
Error Budget = (1 - SLO Target) * Total Valid Events in Window
```

### Monthly Error Budget Table

| SLO | Target | Budget (30 days) | Alert at | Page at |
|-----|--------|-----------------|----------|---------|
| Availability | 99.5% | 3.6 hours total downtime | 50% consumed (1.8h) | 80% consumed (2.88h) |
| Page Load | 90% < 2.5s | 10% of page loads can be slow | 50% consumed | 80% consumed |
| Server Action Latency | 95% < 1s | 5% of actions can be slow | 50% consumed | 80% consumed |
| Error Rate | 99% success | 1% of actions can error | 50% consumed | 80% consumed |

### Burn Rate Alerting

Use burn rate multipliers to detect budget consumption speed:

| Burn Rate | Time to Exhaust Budget | Meaning | Action |
|-----------|----------------------|---------|--------|
| 1x | 30 days | Normal consumption | No action |
| 2x | 15 days | Slightly elevated | Monitor |
| 6x | 5 days | Significant issue | Slack notification |
| 14.4x | 2 days | Urgent issue | Slack + email alert |
| 36x | 20 hours | Critical incident | Page on-call |

### Implementation

Since we are not running Prometheus or a dedicated SLO platform, error budget tracking is implemented as follows:

1. **Sentry** tracks Server Action error counts and latency distributions automatically via its Performance product. Weekly review of the "Apdex" score and error rate trends in the Sentry dashboard.

2. **Better Stack** tracks uptime and generates monthly availability reports. The free tier provides up to 90 days of incident history.

3. **Manual weekly review**: Every Monday, review the previous week's data in Sentry Performance + Vercel Analytics and record the numbers in a shared spreadsheet or Notion table. This is appropriate for a small team. Automate only when the team grows past 5 engineers.

4. **Vercel Speed Insights** already provides LCP percentile breakdowns by route. Export weekly for the spreadsheet.

---

## 5. Instrumentation Plan

### Phase 1: Sentry Integration (Week 1)

Sentry provides error tracking, performance monitoring (transactions), and session replay with a single SDK installation.

#### 5.1.1 Installation

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

This creates:
- `sentry.client.config.ts` -- Client-side SDK initialization
- `sentry.server.config.ts` -- Server-side SDK initialization
- `sentry.edge.config.ts` -- Edge runtime (middleware) initialization
- `next.config.mjs` wrapping with `withSentryConfig()`
- `app/global-error.tsx` -- Global error boundary

#### 5.1.2 Sentry Client Configuration

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance: Sample 20% of transactions in production
  // This keeps us well within the free tier (5K errors + 100K transactions)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Session Replay: Capture 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media by default for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      // Track client-side route transitions (Next.js App Router)
      enableInp: true,
    }),
  ],

  // Filter out known non-actionable errors
  beforeSend(event) {
    // Ignore ResizeObserver errors (benign, caused by browser extensions)
    if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) {
      return null
    }
    // Ignore network errors from prefetch requests
    if (event.exception?.values?.[0]?.value?.includes("Failed to fetch") &&
        event.request?.headers?.["Purpose"] === "prefetch") {
      return null
    }
    return event
  },

  // Tag with deployment info
  release: process.env.VERCEL_GIT_COMMIT_SHA,
})
```

#### 5.1.3 Sentry Server Configuration

```typescript
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Capture all unhandled promise rejections
  integrations: [
    Sentry.supabaseIntegration(), // Auto-instruments Supabase queries
  ],

  // Tag server-side transactions with useful metadata
  beforeSendTransaction(event) {
    // Add custom tags for filtering in Sentry UI
    if (event.transaction?.startsWith("POST /")) {
      event.tags = { ...event.tags, type: "server-action" }
    }
    return event
  },

  release: process.env.VERCEL_GIT_COMMIT_SHA,
})
```

#### 5.1.4 Sentry Edge Configuration (Middleware)

```typescript
// sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
})
```

#### 5.1.5 Server Action Instrumentation Pattern

Wrap critical Server Actions with Sentry spans for latency visibility:

```typescript
// Example: Instrumenting a Server Action
import * as Sentry from "@sentry/nextjs"

export async function getTasks(projectId: string) {
  return Sentry.withServerActionInstrumentation(
    "getTasks",
    { recordResponse: true },
    async () => {
      const { supabase } = await requireProjectMember(projectId)

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order")

      if (error) {
        Sentry.captureException(error, {
          tags: { action: "getTasks", projectId },
        })
        return { error: error.message }
      }

      return { data }
    }
  )
}
```

Priority actions to instrument (ordered by user impact):

| Action Group | File | Key Functions | Reason |
|-------------|------|---------------|--------|
| Tasks | `lib/actions/tasks/` | `getTasks`, `createTask`, `updateTask`, `reorderTasks` | Highest-frequency operations (218 tasks) |
| Projects | `lib/actions/projects/` | `getProjects`, `createProject`, `getProjectWithDetails` | Page-load critical path |
| Auth | `lib/actions/auth.ts` | `signIn`, `signUp`, `signOut` | User-facing authentication flow |
| AI | `lib/actions/ai/` | `sendChatMessage`, `generateText` | Highest latency operations (LLM calls) |
| Inbox | `lib/actions/inbox.ts` | `getInboxItems`, `getUnreadCount` | Default landing page data |

#### 5.1.6 Global Error Boundary

```typescript
// app/global-error.tsx
"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p>Our team has been notified. Please try again.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
```

### Phase 2: Uptime Monitoring (Week 1)

#### 5.2.1 Better Stack Monitor Configuration

Create the following monitors in Better Stack (free tier supports 10 monitors):

| Monitor | URL | Check Interval | Assertion |
|---------|-----|---------------|-----------|
| Login Page | `https://pms-nine-gold.vercel.app/login` | 3 min | Status 200, body contains "Sign in" |
| API Health | `https://pms-nine-gold.vercel.app/api/health` | 3 min | Status 200, JSON `{ status: "ok" }` |
| Supabase API | `https://lazhmdyajdqbnxxwyxun.supabase.co/rest/v1/` | 5 min | Status 200 (with anon key header) |
| OAuth Callback | `https://pms-nine-gold.vercel.app/auth/callback` | 5 min | Status 200 or 302 (redirect is expected) |
| Vercel Edge | `https://pms-nine-gold.vercel.app/` | 3 min | Status 200 or 302 |

#### 5.2.2 Health Check Endpoint

Create a lightweight health check that verifies critical dependencies:

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server"

export const runtime = "edge" // Minimal cold start
export const dynamic = "force-dynamic"

export async function GET() {
  const checks: Record<string, "ok" | "degraded" | "down"> = {
    app: "ok",
    supabase: "ok",
    kv: "ok",
  }

  // Check Supabase connectivity (lightweight query)
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) checks.supabase = "degraded"
  } catch {
    checks.supabase = "down"
  }

  // Check KV connectivity
  if (process.env.KV_REST_API_URL) {
    try {
      const res = await fetch(
        `${process.env.KV_REST_API_URL}/ping`,
        {
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          },
          signal: AbortSignal.timeout(2000),
        }
      )
      if (!res.ok) checks.kv = "degraded"
    } catch {
      checks.kv = "down"
    }
  }

  const overallStatus = Object.values(checks).every(v => v === "ok")
    ? "ok"
    : Object.values(checks).some(v => v === "down")
      ? "down"
      : "degraded"

  return NextResponse.json(
    { status: overallStatus, checks, timestamp: new Date().toISOString() },
    { status: overallStatus === "down" ? 503 : 200 }
  )
}
```

### Phase 3: Structured Logging via Vercel Log Drains (Week 2)

#### 5.3.1 Log Drain Setup

1. In Vercel Dashboard: **Settings > Log Drains > Add Log Drain**
2. Select **Better Stack** as the destination (or generic HTTP endpoint)
3. Configure to drain: **Build Logs**, **Static Logs**, **Lambda Logs**, **Edge Logs**

#### 5.3.2 Structured Logger Utility

Replace `console.log/warn/error` with a structured logger that adds context:

```typescript
// lib/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error"

type LogContext = {
  action?: string
  userId?: string
  orgId?: string
  projectId?: string
  duration_ms?: number
  cache_hit?: boolean
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...context,
  }

  // Vercel log drains parse JSON lines from stdout/stderr
  if (level === "error") {
    console.error(JSON.stringify(entry))
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => {
    if (process.env.NODE_ENV !== "production") log("debug", msg, ctx)
  },
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
}
```

#### 5.3.3 Instrumented Cache Layer

Add hit/miss logging to `lib/cache/utils.ts`:

```typescript
// Enhanced cacheGet with structured logging
export async function cacheGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cache = isKVAvailable() ? kv : memCache
  const start = Date.now()

  try {
    const cached = await cache.get<T>(key)
    if (cached !== null) {
      logger.debug("cache.hit", {
        cache_key: key.split(":").slice(0, 3).join(":"), // Truncate for cardinality
        cache_hit: true,
        duration_ms: Date.now() - start,
      })
      return cached
    }
  } catch (error) {
    logger.error("cache.get_error", { cache_key: key, error: String(error) })
  }

  const fresh = await fetcher()
  const fetchDuration = Date.now() - start

  logger.debug("cache.miss", {
    cache_key: key.split(":").slice(0, 3).join(":"),
    cache_hit: false,
    duration_ms: fetchDuration,
  })

  if (fresh !== null && fresh !== undefined) {
    cache.set(key, fresh, { ex: ttlSeconds }).catch((error) => {
      logger.error("cache.set_error", { cache_key: key, error: String(error) })
    })
  }

  return fresh
}
```

#### 5.3.4 Rate Limiter Observability

Add logging to `checkRateLimit()` for rejected requests:

```typescript
// In lib/rate-limit/limiter.ts, after the limit check:
if (!result.success) {
  logger.warn("rate_limit.rejected", {
    action: prefix, // e.g., "rl:auth", "rl:ai"
    identifier: identifier.substring(0, 8) + "...", // Truncate for privacy
    remaining: result.remaining,
    reset_at: new Date(result.reset).toISOString(),
  })
}
```

### Phase 4: Custom Application Metrics via KV Counters (Week 2)

For lightweight custom metrics without adding a metrics vendor, use the existing Vercel KV to store counters. This reuses existing infrastructure and adds zero cost.

#### 5.4.1 Metrics Counter Module

```typescript
// lib/monitoring/metrics.ts
import { kv, isKVAvailable } from "@/lib/cache/client"

const METRICS_TTL = 86400 // 24 hours -- auto-expire old counters

type MetricName =
  | "cache.hit"
  | "cache.miss"
  | "action.success"
  | "action.error"
  | "action.slow"
  | "rate_limit.rejected"
  | "auth.session_cache_hit"
  | "auth.session_cache_miss"
  | "realtime.reconnect"
  | "ai.request"
  | "ai.error"
  | "ai.timeout"

/**
 * Increment a counter metric.
 * Non-blocking, fire-and-forget. Failures are silently ignored.
 *
 * Key format: pms:metrics:{name}:{YYYY-MM-DD-HH}
 * This creates hourly buckets for natural aggregation and TTL-based cleanup.
 */
export function incrementMetric(name: MetricName, tags?: Record<string, string>) {
  if (!isKVAvailable()) return

  const hour = new Date().toISOString().slice(0, 13) // "2026-02-14T15"
  const tagSuffix = tags ? ":" + Object.values(tags).join(":") : ""
  const key = `pms:metrics:${name}:${hour}${tagSuffix}`

  // Fire-and-forget
  kv.incr(key).catch(() => {})
  kv.expire(key, METRICS_TTL).catch(() => {})
}

/**
 * Record a latency value in a sorted set for percentile calculations.
 * Only use for high-value metrics (Server Actions, AI calls).
 */
export function recordLatency(name: string, durationMs: number) {
  if (!isKVAvailable()) return

  const hour = new Date().toISOString().slice(0, 13)
  const key = `pms:latency:${name}:${hour}`
  const member = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  kv.zadd(key, { score: durationMs, member }).catch(() => {})
  kv.expire(key, METRICS_TTL).catch(() => {})
}
```

#### 5.4.2 Metrics API Endpoint (for dashboards)

```typescript
// app/api/metrics/route.ts
import { NextResponse } from "next/server"
import { kv } from "@vercel/kv"

export const dynamic = "force-dynamic"

// Protected by a simple bearer token (not user auth)
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env.METRICS_API_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const hours = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getTime() - i * 3600000)
    return d.toISOString().slice(0, 13)
  })

  const metrics: Record<string, number> = {}
  const metricNames = [
    "cache.hit", "cache.miss",
    "action.success", "action.error", "action.slow",
    "rate_limit.rejected",
    "auth.session_cache_hit", "auth.session_cache_miss",
    "ai.request", "ai.error",
  ]

  for (const name of metricNames) {
    let total = 0
    for (const hour of hours) {
      const val = await kv.get<number>(`pms:metrics:${name}:${hour}`)
      total += val ?? 0
    }
    metrics[name] = total
  }

  // Calculate derived metrics
  const cacheTotal = metrics["cache.hit"] + metrics["cache.miss"]
  metrics["cache.hit_rate"] = cacheTotal > 0
    ? Math.round((metrics["cache.hit"] / cacheTotal) * 10000) / 100
    : 0

  return NextResponse.json({
    window: "24h",
    metrics,
    timestamp: now.toISOString(),
  })
}
```

### Phase 5: Supabase Database Monitoring (Week 3)

#### 5.5.1 Supabase Dashboard Checks (Manual Weekly)

| Check | Where | What to Look For |
|-------|-------|-----------------|
| Slow Queries | Supabase Dashboard > Database > Query Performance | Any query > 500ms average |
| Connection Pool | Supabase Dashboard > Database > Overview | Pool utilization > 80% |
| Active Connections | Supabase Dashboard > Database > Overview | Connection count spikes |
| Auth Requests | Supabase Dashboard > Authentication > Logs | Failed login spikes |
| Storage Usage | Supabase Dashboard > Storage | Approaching plan limits |
| RLS Advisory | `mcp__supabase__get_advisors` (security) | Missing RLS policies |
| Performance Advisory | `mcp__supabase__get_advisors` (performance) | Missing indexes, bloated tables |

#### 5.5.2 Database Performance Query (run weekly)

```sql
-- Top 10 slowest queries in the last 7 days
SELECT
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as mean_time_ms,
  round(max_exec_time::numeric, 2) as max_time_ms,
  left(query, 100) as query_preview
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

```sql
-- Table sizes and row counts for capacity planning
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## 6. Alert Rules and Thresholds

### Alert Severity Levels

| Severity | Response Time | Notification Channel | Example |
|----------|--------------|---------------------|---------|
| **P1 Critical** | Immediate (< 5 min) | Slack + SMS + Email | Site down, auth broken |
| **P2 High** | < 30 min during business hours | Slack + Email | Error rate spike, slow pages |
| **P3 Medium** | Next business day | Slack only | Cache hit rate drop, elevated latency |
| **P4 Low** | Weekly review | Dashboard only | Approaching capacity limits |

### Alert Definitions

#### Sentry Alerts

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Error Spike | > 50 errors in 10 minutes | P2 | Investigate error pattern in Sentry Issues |
| New Error | First occurrence of error fingerprint | P3 | Review stack trace, assign to owner |
| Transaction Degradation | p95 latency > 3s for any server action (sustained 15 min) | P3 | Check Supabase query performance |
| AI Failure Rate | > 20% AI action errors in 1 hour | P3 | Check LLM provider status |
| Unhandled Rejection | Any unhandled promise rejection on server | P2 | Fix error handling, add try/catch |

Configure in Sentry: **Alerts > Create Alert Rule**

```yaml
# Sentry Alert: Error Spike
conditions:
  - type: event_frequency
    value: 50
    interval: 10m
  - type: level
    match: gte
    level: error
actions:
  - type: slack
    channel: "#pms-alerts"
  - type: email
    targetType: team
```

#### Better Stack Alerts

| Monitor | Alert When | Grace Period | Escalation |
|---------|-----------|-------------|------------|
| Login Page | Down for 2 consecutive checks | 3 min | Slack immediately, email after 5 min |
| API Health | Returns 503 | 3 min | Slack immediately |
| API Health | Returns "degraded" | 10 min | Slack only |
| Supabase API | Down for 2 consecutive checks | 5 min | Slack, note: check status.supabase.com |

#### Custom Metric Alerts (checked via daily cron or manual review)

| Metric | Warning | Critical | Check Frequency |
|--------|---------|----------|----------------|
| KV cache hit rate | < 60% (24h window) | < 40% (24h window) | Daily |
| Rate limit rejections (auth) | > 50/hour | > 200/hour | Hourly |
| Rate limit rejections (AI) | > 20/day | > 100/day | Daily |
| Server Action error rate | > 2% (1h window) | > 5% (1h window) | Sentry auto |
| Middleware p95 latency | > 500ms | > 1000ms | Sentry auto |

### Alert Notification Routing

```
P1 Critical:
  Slack #pms-alerts (immediate)
  Email: team@company.com
  SMS: on-call phone (if configured)

P2 High:
  Slack #pms-alerts (immediate)
  Email: team@company.com

P3 Medium:
  Slack #pms-monitoring (business hours only, M-F 9am-6pm)

P4 Low:
  No notification -- review in weekly monitoring meeting
```

---

## 7. Dashboard Configurations

### Dashboard 1: Operations Overview (Sentry)

**Location:** Sentry > Dashboards > Create Dashboard

| Panel | Type | Data Source | Query/Config |
|-------|------|------------|-------------|
| Error Count (24h) | Big Number | Sentry Issues | `event.type:error !level:info` |
| Error Trend (7d) | Line Chart | Sentry Issues | Group by hour |
| Top 5 Errors | Table | Sentry Issues | Sort by frequency, show: title, count, last seen |
| p50/p75/p95 Latency | Line Chart | Sentry Performance | Filter: `transaction:*Action*` |
| Slowest Transactions | Table | Sentry Performance | Sort by p95, top 10 |
| Web Vitals Summary | Widget | Sentry Performance | LCP, FID, CLS by page |
| Release Health | Widget | Sentry Releases | Error-free sessions %, adoption rate |

### Dashboard 2: Infrastructure Health (Better Stack + custom)

**Location:** Better Stack Status Page (public or private)

| Component | Data Source | Display |
|-----------|-----------|---------|
| Web Application | Better Stack uptime monitor | Uptime %, response time chart |
| Supabase Database | Better Stack uptime monitor | Uptime %, response time chart |
| KV Cache | Better Stack uptime monitor | Uptime %, response time chart |
| Recent Incidents | Better Stack incidents | Timeline with duration |

### Dashboard 3: Application Metrics (Internal)

**Location:** Custom internal page at `/admin/monitoring` (protected by admin role check)

Build a simple React page that fetches from the `/api/metrics` endpoint and displays:

| Panel | Metric | Visualization |
|-------|--------|--------------|
| Cache Hit Rate | `cache.hit / (cache.hit + cache.miss)` | Gauge (target: > 70%) |
| Cache Hits/Misses (24h) | `cache.hit`, `cache.miss` | Stacked bar chart by hour |
| Server Action Errors (24h) | `action.error` | Line chart |
| Server Action Slow (24h) | `action.slow` | Line chart |
| Rate Limit Rejections | `rate_limit.rejected` | Counter with breakdown by type |
| AI Requests (24h) | `ai.request`, `ai.error` | Counter + error rate |
| Session Cache Effectiveness | `auth.session_cache_hit / total` | Gauge (target: > 80%) |

### Dashboard 4: Vercel Built-in

**Location:** Vercel Dashboard > Analytics + Speed Insights

Already configured and collecting data via `AnalyticsWrapper` component. Use for:

- Core Web Vitals trends (LCP, CLS, INP, TTFB) by route
- Page views and unique visitors
- Top pages and referrers
- Geographic distribution of users

### Dashboard 5: Supabase Database (Weekly Review)

**Location:** Supabase Dashboard

| Panel | Location | What to Check |
|-------|----------|--------------|
| Query Performance | Database > Query Performance | Sort by mean_exec_time, flag anything > 200ms |
| Active Connections | Database > Overview | Should be < 80% of PgBouncer limit |
| Database Size | Database > Overview | Track growth rate for capacity planning |
| Auth Logs | Authentication > Logs | Failed login attempts, unusual patterns |
| Storage Usage | Storage > Overview | GB used vs plan limit |

---

## 8. Runbooks

### Runbook 1: Site Down (P1)

**Trigger:** Better Stack alert -- Login Page or API Health returns non-200 for 2+ checks.

**Time to detect:** < 6 minutes (3-min check interval + 1 check grace)

```
STEP 1: Confirm the outage (2 min max)
  - Open https://pms-nine-gold.vercel.app/login in browser
  - Check Vercel Status: https://www.vercel-status.com/
  - Check Supabase Status: https://status.supabase.com/
  - Check the health endpoint: curl https://pms-nine-gold.vercel.app/api/health

STEP 2: Identify the failing component (5 min max)
  If health endpoint returns { supabase: "down" }:
    -> Supabase outage. Check status.supabase.com.
    -> If regional: no action possible, monitor and communicate to users.
    -> If project-specific: check Supabase Dashboard > Database > Overview
       for connection pool exhaustion or disk space issues.

  If health endpoint returns { kv: "down" }:
    -> Vercel KV outage. App will degrade gracefully (in-memory fallback).
    -> Impact: Rate limiting uses per-instance memory (less effective).
    -> Impact: Cache misses increase (higher Supabase load).
    -> No immediate action needed unless Supabase starts failing.

  If health endpoint does not respond at all:
    -> Vercel platform issue. Check vercel-status.com.
    -> Check Vercel Dashboard > Deployments for failed deployments.
    -> If recent deployment failed: Vercel auto-rolls back. Verify.
    -> If no deployment issue: Vercel platform outage. Monitor.

STEP 3: Mitigate (if actionable)
  - If caused by bad deployment: Vercel Dashboard > Deployments >
    select last good deployment > "Promote to Production"
  - If caused by database migration: check supabase/migrations/ for
    recent changes. Consider reverting with a counter-migration.
  - If caused by KV exhaustion: check Vercel KV Dashboard for
    memory usage. Consider flushing stale keys with:
    await kv.flushall() // CAUTION: clears all KV data

STEP 4: Communicate
  - Post in #pms-alerts Slack channel with status and ETA
  - If > 30 min outage: post on status page (Better Stack)

STEP 5: Post-incident
  - Create post-incident review document within 48 hours
  - Focus on: timeline, root cause, what monitoring caught it,
    what monitoring missed, action items to prevent recurrence
```

### Runbook 2: Error Rate Spike (P2)

**Trigger:** Sentry alert -- > 50 errors in 10 minutes.

```
STEP 1: Assess scope (3 min)
  - Open Sentry > Issues > sort by frequency, last 30 minutes
  - Identify: Is it one error repeated? Or many different errors?
  - Check: Is it affecting all users or one organization?

STEP 2: Single repeating error
  - Read the stack trace in Sentry
  - Check the "Tags" tab for: userId, orgId, browser, route
  - Common patterns:
    a) Database constraint violation -> check migration recency
    b) "Not authenticated" errors -> middleware token refresh failing
    c) "Not a member of this organization" -> KV cache serving stale
       membership data after org change. Solution: wait for TTL (5 min)
       or manually invalidate via KV dashboard.
    d) Supabase "too many connections" -> PgBouncer exhaustion.
       Check Supabase Dashboard. May need to reduce concurrent queries
       or add connection pooling configuration.

STEP 3: Multiple different errors
  - Likely a deployment issue or dependency outage
  - Check: Vercel Dashboard > Functions > recent invocations for 500s
  - Check: Was there a deployment in the last 30 minutes?
  - If yes: consider rolling back (Vercel > Deployments > Promote old build)

STEP 4: Resolve
  - If code fix needed: create PR, merge to main, Vercel auto-deploys
  - If config issue: update env vars in Vercel Dashboard > Settings
  - Mark Sentry issues as resolved with the fix commit SHA
```

### Runbook 3: Slow Page Loads (P3)

**Trigger:** Sentry Performance alert -- p95 latency > 3s sustained for 15 minutes. Or weekly review shows LCP regression.

```
STEP 1: Identify the slow route (5 min)
  - Sentry > Performance > sort by p95 latency
  - Identify the specific page/transaction
  - Check Vercel Speed Insights > filter by route for LCP trend

STEP 2: Diagnose server vs client (10 min)
  Server-side slow (TTFB > 1s):
    - Check Sentry transaction waterfall for the slow span
    - Common causes:
      a) Cold start: Vercel serverless function cold boot (200-500ms).
         Mitigation: none needed if < 5% of requests.
      b) Uncached Supabase query: check if cacheGet() is being used.
         Look for cache.miss logs in the structured logs.
      c) N+1 queries: check for sequential Supabase calls that
         should be parallelized with Promise.all().
      d) KV latency spike: check Vercel KV Dashboard for p95 > 50ms.

  Client-side slow (LCP > 2.5s with TTFB < 500ms):
    - Large RSC payload: check Network tab for RSC response size.
      Should be < 50KB for typical pages.
    - Image loading: check if images use next/image with proper sizing.
    - JavaScript bundle: run `pnpm build:analyze` and check for
      large client-side chunks.
    - Hydration cost: check React DevTools Profiler for slow components.

STEP 3: Fix and validate
  - Apply fix in code
  - Run Lighthouse CI locally: pnpm lighthouse:local
  - Run navigation perf test: pnpm test:e2e navigation-performance.spec.ts
  - Merge and monitor Sentry Performance for improvement
```

### Runbook 4: KV Cache Degradation (P3)

**Trigger:** Custom metric alert -- cache hit rate < 60% for 24h.

```
STEP 1: Verify KV health (2 min)
  - Check Vercel KV Dashboard for:
    - Memory usage (approaching plan limit?)
    - Command latency (p95 > 50ms?)
    - Connection count (approaching limit?)
  - Check health endpoint: curl https://pms-nine-gold.vercel.app/api/health

STEP 2: Diagnose (10 min)
  Low hit rate causes:
  a) TTL too short for access pattern:
     - Tasks TTL is 30s. If a project page is viewed every 45s,
       hit rate will be ~50%.
     - Solution: increase TTL if data freshness allows it.

  b) Cache stampede after deployment:
     - Vercel deployments create new function instances.
     - All KV entries remain, but React cache() is per-request.
     - This is normal behavior. Hit rate should recover within
       1-2x the TTL window.

  c) High invalidation rate:
     - Frequent mutations trigger invalidateCache.*() which
       deletes KV entries.
     - Check: are users doing rapid bulk operations?
     - Solution: batch invalidations in bulk operations
       (already implemented in reorderTasks/reorderWorkstreams).

  d) KV key space explosion:
     - Check: are search queries creating too many unique keys?
     - CacheKeys.search() creates per-query-hash keys.
     - Solution: the 30s TTL on search should auto-expire.
     - If needed: run invalidate.search(orgId) to clear.

STEP 3: Remediate
  - If TTL issue: update CacheTTL values in lib/cache/keys.ts
  - If capacity issue: upgrade Vercel KV plan or reduce key space
  - Monitor custom metrics dashboard for hit rate recovery
```

### Runbook 5: Supabase Connection Pool Exhaustion (P1)

**Trigger:** Health endpoint returns `{ supabase: "down" }` or Supabase Dashboard shows connection count at limit.

```
STEP 1: Confirm pool state (2 min)
  - Supabase Dashboard > Database > Overview
  - Check "Active connections" vs "Max connections"
  - Supabase Pro plan default: 60 direct + 200 pooler connections

STEP 2: Identify connection leak (5 min)
  - Check Vercel Functions dashboard for concurrent execution count
  - Each Vercel function instance opens a connection via @supabase/ssr
  - Expected: 1 connection per active function instance
  - If connections >> function instances: possible connection leak

  Common causes:
  a) Realtime subscriptions creating excessive connections
     -> Check RealtimeProvider for unpooled subscriptions
  b) Server Actions not using getSupabaseClient() (creating
     multiple clients per request)
     -> All actions should use cachedGetUser() or requireAuth()
  c) Long-running AI operations holding connections
     -> AI actions should complete DB queries before LLM calls

STEP 3: Immediate mitigation
  - If urgent: restart Supabase database (Supabase Dashboard >
    Database > Restart Server). This kills all connections.
    Recovery time: ~30 seconds.
  - If less urgent: wait for idle connections to be reclaimed
    by PgBouncer (default idle timeout: 30 minutes)

STEP 4: Prevent recurrence
  - Ensure all connection-heavy operations use transaction pooler
    (port 6543) instead of session pooler (port 5432)
  - Add connection timeout to Supabase client config:
    db: { connectionTimeoutMillis: 10000 }
  - Consider reducing staleTimes in next.config.mjs to reduce
    parallel SSR requests per navigation
```

### Runbook 6: AI Service Degradation (P3)

**Trigger:** Custom metric `ai.error` > 20% of `ai.request` in 1 hour.

```
STEP 1: Identify the failing provider (3 min)
  - Check Sentry errors filtered by tag: action = "sendChatMessage"
  - Identify error message:
    - "429 Too Many Requests" -> Rate limited by provider
    - "503 Service Unavailable" -> Provider outage
    - "timeout" -> Provider slow, increase timeout
    - "ENCRYPTION_KEY" errors -> env var misconfigured

STEP 2: Provider outage
  - Check provider status pages:
    - OpenAI: https://status.openai.com/
    - Anthropic: https://status.anthropic.com/
    - Google AI: https://status.cloud.google.com/
  - AI features degrade gracefully (users see error toast)
  - No action needed beyond monitoring

STEP 3: Rate limiting
  - User's own API key is rate-limited by the provider
  - This is per-user, not system-wide
  - The app's rate limiter (50 requests/24h) should prevent this
  - If hitting provider limits: reduce AI rate limit in
    lib/rate-limit/limiter.ts

STEP 4: Cost monitoring
  - AI API costs are borne by users (they provide their own keys)
  - System-level concern is only the rate limiter and error handling
```

---

## 9. Cost Analysis

### Monthly Cost Breakdown (Current Scale: < 50 users)

| Tool | Tier | Cost/Month | What You Get |
|------|------|-----------|-------------|
| Sentry | Free (Developer) | $0 | 5K errors, 10K transactions, 50 replays, 1 user |
| Vercel Analytics | Included (Pro) | $0 | Unlimited page views |
| Vercel Speed Insights | Included (Pro) | $0 | Unlimited CWV data points |
| Better Stack Uptime | Free | $0 | 10 monitors, 3-min checks, email alerts |
| Better Stack Logs | Free | $0 | 1 GB/day, 3-day retention |
| Vercel KV (metrics) | Existing plan | $0 | Reusing existing KV for metric counters |
| Supabase Dashboard | Included (Pro) | $0 | Query performance, auth logs, storage metrics |
| **Total** | | **$0/month** | |

### Cost at Growth Milestones

| Scale | Sentry | Better Stack | Other | Total |
|-------|--------|-------------|-------|-------|
| 50 users, 10K requests/day | Free | Free | $0 | **$0/month** |
| 200 users, 50K requests/day | Team ($26/mo) | Free | $0 | **$26/month** |
| 500 users, 200K requests/day | Team ($26/mo) | Starter ($24/mo) | $0 | **$50/month** |
| 1000 users, 500K requests/day | Business ($80/mo) | Team ($58/mo) | Grafana Cloud Free | **$138/month** |

### When to Upgrade

| Trigger | Current Limit | Upgrade To | Cost Delta |
|---------|-------------|-----------|-----------|
| > 5K errors/month | Sentry Free | Sentry Team | +$26/month |
| Need 24/7 on-call | Better Stack Free | Better Stack Starter | +$24/month |
| > 10 monitors needed | Better Stack Free | Better Stack Starter | +$24/month |
| Need trace-level APM | No APM | Sentry Performance (in Team plan) | included |
| Need custom dashboards | Sentry built-in | Grafana Cloud Free | $0 |
| Need log search > 3 days | Better Stack Free | Better Stack Team | +$34/month |

### Cost Optimization Strategies

1. **Sentry sampling**: At 20% `tracesSampleRate`, a 50K requests/day workload generates ~10K sampled transactions/day (within free tier). Increase to 50% only when debugging specific latency issues.

2. **KV metric counters**: Using hourly key buckets with 24h TTL means a maximum of ~240 keys for 10 metric types. This is negligible overhead on the existing KV plan.

3. **Log volume management**: Structured JSON logging with log-level gating (`logger.debug` only in non-production) keeps log volume under the 1 GB/day free tier.

4. **Lighthouse CI on PR only**: The current GitHub Actions config runs Lighthouse on both push-to-main and PRs. Consider running full authenticated audits only on PRs to reduce CI minutes.

---

## 10. Implementation Roadmap

### Week 1: Foundation

| Day | Task | Effort | Impact |
|-----|------|--------|--------|
| Mon | Install `@sentry/nextjs`, run wizard, configure client/server/edge configs | 2h | Error tracking goes from 0% to 100% coverage |
| Mon | Set up Sentry project, configure source map uploads in Vercel build | 1h | Readable stack traces in production |
| Tue | Create `app/api/health/route.ts` health check endpoint | 1h | Dependency health visibility |
| Tue | Set up Better Stack account, create 5 uptime monitors | 30m | Uptime alerting (detect outages in < 6 min) |
| Wed | Configure Sentry alert rules (error spike, new error, latency) | 1h | Proactive error notification |
| Wed | Create `app/global-error.tsx` error boundary | 30m | Graceful error UI + Sentry capture |
| Thu | Instrument top 5 Server Actions with `Sentry.withServerActionInstrumentation` | 2h | Server Action latency visibility |
| Fri | Set up Slack integration for Sentry + Better Stack alerts | 1h | Alert notifications in team channel |

**Week 1 deliverable:** Error tracking, uptime monitoring, and alerting are live. Blind spots 1 (error tracking) and 5 (uptime) are eliminated.

### Week 2: Observability Depth

| Day | Task | Effort | Impact |
|-----|------|--------|--------|
| Mon | Create `lib/logger.ts` structured logger utility | 1h | Foundation for searchable logs |
| Mon | Replace 26 `console.log/warn/error` calls in `lib/` with `logger.*` | 2h | Structured, searchable log output |
| Tue | Set up Vercel Log Drain to Better Stack | 30m | Centralized log aggregation |
| Tue | Instrument `cacheGet()` with hit/miss logging | 1h | Cache effectiveness visibility (blind spot 2) |
| Wed | Instrument `checkRateLimit()` with rejection logging | 30m | Rate limiter visibility (blind spot 3) |
| Wed | Create `lib/monitoring/metrics.ts` KV counter module | 1h | Custom application metrics |
| Thu | Create `/api/metrics` endpoint | 1h | Programmatic access to custom metrics |
| Thu | Add metrics increment calls to key code paths | 2h | Server Actions, cache, rate limiter, AI |
| Fri | Instrument middleware with timing metrics | 1h | Middleware latency visibility (blind spot 5) |

**Week 2 deliverable:** Structured logging, cache metrics, rate limiter visibility, and custom application metrics are live. Blind spots 2, 3, and 5 are eliminated.

### Week 3: Dashboards and Runbooks

| Day | Task | Effort | Impact |
|-----|------|--------|--------|
| Mon | Configure Sentry Operations Overview dashboard | 1h | Single pane of glass for errors + performance |
| Mon | Set up Better Stack status page (private) | 30m | Infrastructure health visibility |
| Tue | Build internal `/admin/monitoring` dashboard page | 3h | Custom metrics visualization |
| Wed | Document all 6 runbooks in team knowledge base | 2h | Incident response playbook |
| Thu | Create SLI/SLO tracking spreadsheet with formulas | 1h | Error budget tracking |
| Thu | Schedule weekly monitoring review meeting (30 min) | 15m | Ongoing reliability governance |
| Fri | Run first weekly review: baseline all metrics | 1h | Establish performance baselines |

**Week 3 deliverable:** Dashboards are configured, runbooks are documented, SLO tracking is initialized. The team has a weekly ritual for reliability review.

### Week 4: Hardening (Optional)

| Task | Effort | Impact |
|------|--------|--------|
| Add Sentry Session Replay for error sessions | 30m | Video replay of user sessions leading to errors |
| Instrument RealtimeProvider with connection metrics | 2h | WebSocket health visibility (blind spot 4) |
| Add cache invalidation success/failure logging | 1h | Invalidation cascade visibility (blind spot 6) |
| Set up Sentry Performance Budgets for key routes | 1h | Automated regression detection |
| Create Sentry Crons for scheduled health checks | 1h | Canary monitoring beyond uptime |

---

## Appendix A: Environment Variables to Add

```bash
# Sentry (add to Vercel Dashboard > Settings > Environment Variables)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o123.ingest.sentry.io/456
SENTRY_DSN=https://xxx@o123.ingest.sentry.io/456  # Server-side (same DSN)
SENTRY_AUTH_TOKEN=sntrys_xxx                        # For source map uploads
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=pms

# Metrics API (for /api/metrics endpoint protection)
METRICS_API_TOKEN=<generate-random-64-char-token>
```

## Appendix B: Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Sentry client-side SDK initialization |
| `sentry.server.config.ts` | Sentry server-side SDK initialization |
| `sentry.edge.config.ts` | Sentry edge runtime initialization |
| `app/global-error.tsx` | Global error boundary with Sentry capture |
| `app/api/health/route.ts` | Health check endpoint for uptime monitoring |
| `app/api/metrics/route.ts` | Custom metrics API for dashboards |
| `lib/logger.ts` | Structured JSON logger utility |
| `lib/monitoring/metrics.ts` | KV-based metrics counter module |

### Modified Files

| File | Change |
|------|--------|
| `next.config.mjs` | Wrap with `withSentryConfig()` |
| `lib/cache/utils.ts` | Add cache hit/miss structured logging |
| `lib/rate-limit/limiter.ts` | Add rejection structured logging |
| `middleware.ts` | Add timing metrics via `incrementMetric()` |
| `lib/actions/tasks/*.ts` | Add `Sentry.withServerActionInstrumentation()` |
| `lib/actions/projects/*.ts` | Add `Sentry.withServerActionInstrumentation()` |
| `lib/actions/auth.ts` | Add `Sentry.withServerActionInstrumentation()` |
| `lib/actions/ai/*.ts` | Add `Sentry.withServerActionInstrumentation()` |
| `lib/actions/inbox.ts` | Add `Sentry.withServerActionInstrumentation()` |

## Appendix C: CSP Update for Sentry

The middleware CSP policy in `middleware.ts` needs to allow Sentry's telemetry endpoint:

```typescript
// In buildCspHeader(), update connect-src:
"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://vitals.vercel-analytics.com https://va.vercel-scripts.com https://*.ingest.sentry.io",
```

## Appendix D: Key Metric Baselines (Expected Values)

These baselines should be validated during the first weekly review (Week 3, Friday):

| Metric | Expected Range | Red Flag |
|--------|---------------|----------|
| KV cache hit rate | 60-85% | < 40% |
| Middleware p50 latency | 5-30ms (KV cached) / 300-500ms (full auth) | > 1000ms |
| Server Action p50 latency | 50-200ms | > 500ms |
| Server Action p95 latency | 200-800ms | > 2000ms |
| LCP p75 (dashboard pages) | 1000-2000ms | > 3000ms |
| Error rate (daily) | < 0.5% of requests | > 2% |
| Rate limit rejections (auth) | 0-5/day | > 50/day (brute force attempt) |
| Rate limit rejections (AI) | 0-10/day | > 50/day (cost control trigger) |
| Realtime WebSocket connections | 1-3 per active user | > 10 per user (subscription leak) |
| Supabase active connections | 5-20 (50 users) | > 50 (approaching PgBouncer limit) |

## Appendix E: Monitoring Gaps Intentionally Deferred

| Gap | Reason for Deferral | Revisit Trigger |
|-----|---------------------|----------------|
| Distributed tracing (OpenTelemetry) | Single monolith, no microservices to trace across | Backend service split |
| Infrastructure metrics (CPU, memory) | Vercel manages serverless infrastructure | Self-hosted migration or container orchestration |
| Database replication lag | Single Supabase region, no read replicas | Multi-region deployment |
| CDN cache hit rates | Vercel Edge handles this transparently | Performance regression from CDN misses |
| Mobile app performance | No mobile app exists | Mobile app launch |
| Synthetic transaction monitoring | Team too small for comprehensive synthetics | >1000 DAU or SLA requirements from enterprise customers |
| Cost allocation per tenant | Single-tenant monitoring sufficient | Multi-tenant billing or per-org cost tracking needs |
