# Load Testing Analysis: PMS (Project Management SaaS)

**Date:** 2026-02-14
**Application:** PMS -- Next.js 16.1 App Router + Supabase + Vercel
**Production URL:** https://pms-nine-gold.vercel.app
**Supabase Project:** lazhmdyajdqbnxxwyxun

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Under Test: Architecture Model](#2-system-under-test-architecture-model)
3. [Baseline Performance Profile](#3-baseline-performance-profile)
4. [Load Test Strategy and Methodology](#4-load-test-strategy-and-methodology)
5. [k6 Load Test Scripts](#5-k6-load-test-scripts)
   - 5.1 [Dashboard Navigation (Cold + Warm Cache)](#51-dashboard-navigation-cold--warm-cache)
   - 5.2 [Project List with Pagination](#52-project-list-with-pagination)
   - 5.3 [Task Management (CRUD + Reorder)](#53-task-management-crud--reorder)
   - 5.4 [Inbox Polling and Mark-as-Read](#54-inbox-polling-and-mark-as-read)
   - 5.5 [AI Chat Streaming](#55-ai-chat-streaming)
   - 5.6 [Composite User Journey](#56-composite-user-journey)
6. [Test Scenarios and Configuration](#6-test-scenarios-and-configuration)
   - 6.1 [Normal Load (50 Concurrent Users)](#61-normal-load-50-concurrent-users)
   - 6.2 [Peak Load (200 Concurrent Users)](#62-peak-load-200-concurrent-users)
   - 6.3 [Stress Test (500 Concurrent Users)](#63-stress-test-500-concurrent-users)
   - 6.4 [Spike Test (0 to 300 in 30 Seconds)](#64-spike-test-0-to-300-in-30-seconds)
7. [Expected Results Analysis](#7-expected-results-analysis)
   - 7.1 [Response Time Predictions](#71-response-time-predictions)
   - 7.2 [Throughput Estimates](#72-throughput-estimates)
   - 7.3 [Breaking Point Analysis](#73-breaking-point-analysis)
   - 7.4 [Bottleneck Identification at Scale](#74-bottleneck-identification-at-scale)
8. [Comparison Against Profiling Baselines](#8-comparison-against-profiling-baselines)
9. [Scalability Analysis](#9-scalability-analysis)
   - 9.1 [Users per Organization](#91-users-per-organization)
   - 9.2 [Projects and Tasks per Organization](#92-projects-and-tasks-per-organization)
   - 9.3 [Concurrent WebSocket Connections](#93-concurrent-websocket-connections)
10. [Resource Saturation Model](#10-resource-saturation-model)
11. [Recommendations](#11-recommendations)
12. [Appendix: Infrastructure Constraints Reference](#appendix-infrastructure-constraints-reference)

---

## 1. Executive Summary

This report provides a comprehensive load testing analysis for the PMS application based on deep architectural analysis, profiling data, and infrastructure constraints. Since PMS runs on Vercel serverless (auto-scaling compute) with Supabase cloud PostgreSQL (shared pooler), the system's bottlenecks are fundamentally different from traditional monolith deployments. The breaking points are:

1. **Supabase connection pool** (PgBouncer, shared/managed, typically 60-200 connections depending on plan) -- the single most constrained resource
2. **Vercel KV (Upstash Redis)** -- rate limits depend on plan (typically 100-1000 commands/second on free/pro tiers)
3. **Supabase Realtime** -- WebSocket connection limits (200-500 concurrent per project, plan-dependent)
4. **Vercel serverless concurrency** -- effectively unlimited on Pro plan but cold starts degrade p95/p99

**Key findings from the analysis:**

| Load Level | Predicted p50 | Predicted p95 | Expected Errors | Primary Bottleneck |
|------------|--------------|--------------|-----------------|-------------------|
| 50 users | 120ms | 450ms | < 0.1% | None (headroom exists) |
| 200 users | 250ms | 1,200ms | 1-3% | KV command rate, PgBouncer queue |
| 500 users | 800ms | 5,000ms+ | 10-20% | PgBouncer exhaustion, KV rate limit |
| 300 spike | 500ms | 3,000ms | 5-15% | Cold starts + PgBouncer burst |

The application is well-optimized for 50-100 concurrent users. Beyond 200, the managed infrastructure limits become the dominant constraint, not the application code. The unbounded queries identified in profiling (getTaskStats, getClientStats, getClientsWithProjectCounts) become critical bottlenecks at scale because they hold database connections longer and consume more PgBouncer slots.

---

## 2. System Under Test: Architecture Model

### Request Flow Model

```
Client Browser
  |
  |-- [HTTPS] --> Vercel Edge Network (CDN + Edge Middleware)
  |                    |
  |                    |-- middleware.ts (auth cookie check, CSP, KV session cache)
  |                    |     |
  |                    |     |-- [REST ~1-5ms] --> Vercel KV (Upstash Redis)
  |                    |     |-- [REST ~300-500ms] --> Supabase Auth (getUser, only on KV miss)
  |                    |
  |                    |-- Vercel Serverless Function (RSC render, Server Actions)
  |                          |
  |                          |-- [REST ~1-5ms] --> Vercel KV (cacheGet/cacheSet)
  |                          |-- [REST ~15-200ms] --> Supabase PostgREST (data queries)
  |                          |-- [REST ~500ms-30s] --> AI Providers (OpenAI/Anthropic/Google)
  |
  |-- [WebSocket] --> Supabase Realtime (postgres_changes)
```

### Resource Inventory

| Resource | Type | Capacity | Shared? |
|----------|------|----------|---------|
| Vercel Serverless | Compute | Auto-scaling (Pro: 1000 concurrent) | Per-project |
| Vercel Edge | Middleware | Auto-scaling | Per-project |
| Vercel KV (Upstash) | Cache + Rate Limit | Plan-dependent (Pro: ~1000 cmd/s) | Per-project |
| Supabase PostgreSQL | Database | Shared PgBouncer (~60-200 connections) | Per-project |
| Supabase PostgREST | API Gateway | Behind PgBouncer | Per-project |
| Supabase Auth | Auth Service | Separate service, own rate limits | Per-project |
| Supabase Realtime | WebSocket | 200-500 concurrent connections (plan) | Per-project |
| Supabase Storage | File Storage | Bandwidth/storage limits per plan | Per-project |

### Supabase Round Trips Per Page (from profiling)

| Page | Supabase Calls (KV cold) | KV Reads | WebSocket Channels |
|------|-------------------------|----------|-------------------|
| Layout (shared, every page) | 0-4 | 5-6 | 0 |
| /projects | 2 | 0 | 1-2 |
| /projects/[id] | **14** | 0-2 | 3-7 |
| /tasks | 4 | 0 | 1-2 |
| /clients | 1 | 0 | 1-2 |
| /inbox | 2 | 0 | 1 |
| /chat | 2 | 0 | 0 |

---

## 3. Baseline Performance Profile

### Measured Baselines (from profiling audit and Lighthouse)

| Page | TTFB (ms) | FCP (ms) | LCP (ms) | TBT (ms) | Lighthouse Score |
|------|-----------|----------|----------|----------|-----------------|
| Login | 142 | 424 | 2,554 | 472 | 85 |
| Inbox | 102 | 720 | 2,030 | 728 | 78 |
| Projects | 179 | 1,748 | 3,013 | 1,168 | 69 |
| Tasks | 96 | 1,020 | 5,302 | 1,544 | 47 |
| Clients | 126 | 924 | 3,443 | 1,493 | 61 |
| Settings | 94 | 712 | 5,249 | 1,069 | 56 |
| Chat | 92 | 964 | -- | -- | -- |

### Server-Side Latency Model (single user, from distributed systems analysis)

| Scenario | Latency |
|----------|---------|
| Warm function + KV cache hit | ~55ms |
| Warm function + KV miss (Supabase query) | ~90-280ms |
| Cold start + KV cold | ~600-900ms |

### Client-Side Navigation (measured)

| Navigation | Duration |
|------------|----------|
| Inbox to Projects | 420ms |
| Projects to Tasks | 382ms |
| Command Palette open | 803ms |

### Database Query Latency (estimated from architecture)

| Query Type | Latency |
|------------|---------|
| Simple PostgREST (single table, indexed) | 15-30ms |
| Complex PostgREST (joins, nested relations) | 50-200ms |
| Cursor-paginated (with aligned index) | 5-15ms |
| Cursor-paginated (without aligned index, sort step) | 20-100ms |
| Unbounded full scan (getTaskStats, getClientStats) | 50-200ms+ (linear with rows) |
| KV GET | 1-5ms |
| KV SET (fire-and-forget) | 0ms (async) |

---

## 4. Load Test Strategy and Methodology

### Test Approach

Since PMS is a Next.js Server Component application using Server Actions (not a traditional REST API), load testing requires simulating the actual HTTP request patterns that browsers send:

1. **Page loads** -- GET requests to route URLs returning RSC payloads (HTML with embedded RSC stream)
2. **Server Actions** -- POST requests to the same URL with `Next-Action` header and form-encoded or JSON body
3. **Prefetch requests** -- GET requests with `Next-Router-Prefetch: 1` header (lighter RSC payload)
4. **WebSocket connections** -- Supabase Realtime subscriptions (tested separately)

### Authentication Strategy for Load Tests

The middleware requires a valid Supabase auth cookie. Load tests must:
1. Authenticate once per virtual user (VU) via Supabase Auth API to obtain a session token
2. Include the session cookie on all subsequent requests
3. Account for the 5-request-per-15-minute auth rate limit (pre-authenticate users in setup phase)

### Data Seeding

Tests assume a representative dataset per organization:
- 10-50 projects per org
- 50-500 tasks per project
- 5-20 members per org
- 5-50 clients per org
- 100-500 inbox items per user

### User Behavior Model

Based on typical SaaS usage patterns for project management tools:

| Action | Weight | Think Time |
|--------|--------|------------|
| View dashboard/projects list | 25% | 5-15s |
| Navigate to specific project | 15% | 10-30s |
| View task list (My Tasks) | 20% | 5-20s |
| Create/update task | 10% | 15-45s |
| Check inbox | 15% | 3-10s |
| Mark inbox items as read | 5% | 1-3s |
| Use pagination (Load More) | 5% | 5-10s |
| AI chat interaction | 3% | 30-120s |
| Settings/other | 2% | 10-30s |

---

## 5. k6 Load Test Scripts

### 5.1 Dashboard Navigation (Cold + Warm Cache)

This scenario tests the core navigation path: login, view projects, navigate to tasks, check inbox. It exercises both cold-cache (first request after KV TTL expiry) and warm-cache (subsequent requests within TTL) paths.

```javascript
// load-tests/01-dashboard-navigation.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const projectsPageTime = new Trend('projects_page_time', true);
const tasksPageTime = new Trend('tasks_page_time', true);
const inboxPageTime = new Trend('inbox_page_time', true);
const clientsPageTime = new Trend('clients_page_time', true);

const BASE_URL = __ENV.BASE_URL || 'https://pms-nine-gold.vercel.app';

// Pre-authenticated session cookies (generated in setup)
// In production: use Supabase Auth REST API to obtain tokens
const AUTH_COOKIES = __ENV.AUTH_COOKIE || '';

export const options = {
  scenarios: {
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Sustain 50 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.05'],
    projects_page_time: ['p(95)<2000'],
    tasks_page_time: ['p(95)<2500'],
    inbox_page_time: ['p(95)<1500'],
  },
};

// Setup: authenticate test users via Supabase Auth API
export function setup() {
  const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://lazhmdyajdqbnxxwyxun.supabase.co';
  const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

  // Authenticate and get session token
  // NOTE: Auth rate limit is 5 req/15min per IP. Pre-generate tokens for
  // large test runs using a setup script, not k6's setup().
  const authRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
    }
  );

  check(authRes, { 'auth successful': (r) => r.status === 200 });

  if (authRes.status !== 200) {
    console.error('Authentication failed:', authRes.body);
    return { accessToken: null };
  }

  const authData = JSON.parse(authRes.body);
  return {
    accessToken: authData.access_token,
    refreshToken: authData.refresh_token,
  };
}

function getHeaders(data) {
  // Simulate the Supabase auth cookie that middleware expects
  // In real tests, construct the sb-*-auth-token cookie from the JWT
  return {
    'Cookie': `sb-lazhmdyajdqbnxxwyxun-auth-token=${data.accessToken}`,
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'k6-load-test/1.0',
  };
}

export default function(data) {
  if (!data.accessToken) {
    console.error('No auth token available, skipping iteration');
    return;
  }

  const headers = getHeaders(data);

  // --- Cold Load: Projects Page ---
  group('Cold Load: Projects', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/projects`, { headers });

    const duration = Date.now() - start;
    projectsPageTime.add(duration);

    check(res, {
      'projects page status 200': (r) => r.status === 200,
      'projects page has content': (r) => r.body.length > 1000,
      'projects page under 3s': (r) => r.timings.duration < 3000,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(randomBetween(5, 15)); // Think time: reading project list

  // --- Warm Load: Tasks Page (KV should be warm from layout data) ---
  group('Warm Load: Tasks', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/tasks`, { headers });

    const duration = Date.now() - start;
    tasksPageTime.add(duration);

    check(res, {
      'tasks page status 200': (r) => r.status === 200,
      'tasks page has content': (r) => r.body.length > 1000,
      'tasks page under 3s': (r) => r.timings.duration < 3000,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(randomBetween(5, 20)); // Think time: reviewing tasks

  // --- Inbox Page ---
  group('Inbox Page', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/inbox`, { headers });

    const duration = Date.now() - start;
    inboxPageTime.add(duration);

    check(res, {
      'inbox page status 200': (r) => r.status === 200,
      'inbox page under 2s': (r) => r.timings.duration < 2000,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(randomBetween(3, 10)); // Think time: checking notifications

  // --- Clients Page ---
  group('Clients Page', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/clients`, { headers });

    const duration = Date.now() - start;
    clientsPageTime.add(duration);

    check(res, {
      'clients page status 200': (r) => r.status === 200,
      'clients page under 3s': (r) => r.timings.duration < 3000,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(randomBetween(5, 15));

  // --- Prefetch simulation (sidebar hover) ---
  group('Prefetch: Projects', () => {
    const prefetchHeaders = {
      ...headers,
      'Next-Router-Prefetch': '1',
      'Purpose': 'prefetch',
      'RSC': '1',
    };

    const res = http.get(`${BASE_URL}/projects`, { headers: prefetchHeaders });

    check(res, {
      'prefetch status 200': (r) => r.status === 200,
      'prefetch under 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(randomBetween(2, 5));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

---

### 5.2 Project List with Pagination

Tests cursor-based pagination: initial page load (KV-cached), then sequential "Load More" clicks sending Server Action POST requests with cursor tokens.

```javascript
// load-tests/02-project-pagination.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const firstPageTime = new Trend('first_page_load', true);
const loadMoreTime = new Trend('load_more_time', true);

const BASE_URL = __ENV.BASE_URL || 'https://pms-nine-gold.vercel.app';
const MAX_PAGES = 5; // Maximum "Load More" clicks per iteration

export const options = {
  scenarios: {
    pagination_test: {
      executor: 'constant-vus',
      vus: 30,
      duration: '5m',
    },
  },
  thresholds: {
    first_page_load: ['p(95)<2000'],
    load_more_time: ['p(95)<1000'],
    errors: ['rate<0.05'],
  },
};

export function setup() {
  // Same auth setup as 01-dashboard-navigation.js
  // Returns { accessToken, refreshToken }
  return authenticateTestUser();
}

export default function(data) {
  const headers = getHeaders(data);

  // Step 1: Load initial projects page (SSR with first 50 items)
  group('Initial Page Load', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/projects`, { headers });

    firstPageTime.add(Date.now() - start);

    check(res, {
      'page loads successfully': (r) => r.status === 200,
      'page contains project data': (r) => r.body.includes('project'),
    });

    errorRate.add(res.status !== 200);
  });

  sleep(randomBetween(3, 8)); // User reads the project list

  // Step 2: Simulate "Load More" clicks (Server Action calls)
  // Server Actions are POST requests with Next-Action header
  // The cursor comes from the initial page RSC payload
  group('Load More Pagination', () => {
    // Simulate sequential "Load More" clicks
    // In reality, the cursor comes from the previous response's nextCursor field.
    // For load testing, we send the Server Action request pattern.
    for (let page = 1; page <= MAX_PAGES; page++) {
      const start = Date.now();

      // Server Action: getProjects(orgId, undefined, cursor)
      // Next.js Server Actions are POST requests to the page URL
      // with a special Next-Action header containing the action ID.
      //
      // NOTE: In actual k6 tests, you need to extract the action ID from
      // the initial page load response (it's embedded in the RSC payload).
      // This is a simplified representation.
      const actionRes = http.post(
        `${BASE_URL}/projects`,
        JSON.stringify({
          // Server Action arguments are serialized as array
          // [orgId, undefined, cursorToken, pageSize]
          args: ['org-id-placeholder', null, `cursor-page-${page}`, 50],
        }),
        {
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Next-Action': 'getProjects', // Action ID extracted from page
            'Next-Router-State-Tree': '%5B%22%22%5D',
          },
        }
      );

      loadMoreTime.add(Date.now() - start);

      check(actionRes, {
        [`page ${page + 1} loads`]: (r) => r.status === 200 || r.status === 303,
        [`page ${page + 1} under 1s`]: (r) => r.timings.duration < 1000,
      });

      errorRate.add(actionRes.status >= 400);

      // Think time between Load More clicks
      sleep(randomBetween(2, 5));
    }
  });

  sleep(randomBetween(5, 15));
}

// --- Helper functions (shared) ---
function authenticateTestUser() {
  const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://lazhmdyajdqbnxxwyxun.supabase.co';
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': __ENV.SUPABASE_ANON_KEY,
      },
    }
  );
  return res.status === 200 ? JSON.parse(res.body) : { accessToken: null };
}

function getHeaders(data) {
  return {
    'Cookie': `sb-lazhmdyajdqbnxxwyxun-auth-token=${data.accessToken || data.access_token}`,
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'k6-load-test/1.0',
  };
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

---

### 5.3 Task Management (CRUD + Reorder)

Tests write-heavy operations: creating tasks, updating task status, and reordering tasks. These operations involve Server Actions with cache invalidation.

```javascript
// load-tests/03-task-management.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const createTaskTime = new Trend('create_task_time', true);
const updateStatusTime = new Trend('update_status_time', true);
const reorderTime = new Trend('reorder_time', true);
const cacheInvalidations = new Counter('cache_invalidations');

const BASE_URL = __ENV.BASE_URL || 'https://pms-nine-gold.vercel.app';

export const options = {
  scenarios: {
    task_crud: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp to 20 users doing task ops
        { duration: '5m', target: 20 },   // Sustain
        { duration: '1m', target: 50 },   // Push to 50 concurrent writers
        { duration: '3m', target: 50 },   // Sustain high write load
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    create_task_time: ['p(95)<2000'],
    update_status_time: ['p(95)<1500'],
    reorder_time: ['p(95)<2000'],
    errors: ['rate<0.10'], // Mutations may have higher error rate under load
  },
};

export function setup() {
  return authenticateTestUser();
}

export default function(data) {
  const headers = getHeaders(data);
  const projectId = __ENV.TEST_PROJECT_ID || 'test-project-id';

  // --- Create Task ---
  group('Create Task', () => {
    const start = Date.now();

    // Server Action: createTask(projectId, taskData)
    // The actual Server Action POST structure for Next.js App Router.
    // Server Actions use multipart/form-data or the RSC protocol.
    const res = http.post(
      `${BASE_URL}/projects/${projectId}`,
      JSON.stringify({
        name: `Load Test Task ${Date.now()}-${__VU}`,
        description: 'Created by k6 load test',
        status: 'todo',
        priority: 'medium',
        project_id: projectId,
      }),
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Next-Action': 'createTask',
        },
      }
    );

    createTaskTime.add(Date.now() - start);
    cacheInvalidations.add(1); // Each create triggers invalidateCache.task()

    check(res, {
      'task created': (r) => r.status === 200 || r.status === 303,
      'create under 2s': (r) => r.timings.duration < 2000,
    });

    errorRate.add(res.status >= 400);
  });

  sleep(randomBetween(5, 15)); // User fills in task details

  // --- Update Task Status ---
  group('Update Task Status', () => {
    const start = Date.now();

    // Server Action: updateTaskStatus(taskId, newStatus)
    // This is a common high-frequency operation (drag-drop between columns)
    const res = http.post(
      `${BASE_URL}/projects/${projectId}`,
      JSON.stringify({
        taskId: 'task-id-placeholder',
        status: ['todo', 'in-progress', 'done'][Math.floor(Math.random() * 3)],
      }),
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Next-Action': 'updateTaskStatus',
        },
      }
    );

    updateStatusTime.add(Date.now() - start);
    cacheInvalidations.add(1);

    check(res, {
      'status updated': (r) => r.status === 200 || r.status === 303,
      'update under 1.5s': (r) => r.timings.duration < 1500,
    });

    errorRate.add(res.status >= 400);
  });

  sleep(randomBetween(3, 10));

  // --- Reorder Tasks (Drag-Drop) ---
  group('Reorder Tasks', () => {
    const start = Date.now();

    // Server Action: reorderTasks(projectId, reorderPayload)
    // This calls a single RPC (since the N+1 fix: PR #63)
    const res = http.post(
      `${BASE_URL}/projects/${projectId}`,
      JSON.stringify({
        projectId: projectId,
        updates: [
          { id: 'task-1', sort_order: 1 },
          { id: 'task-2', sort_order: 2 },
          { id: 'task-3', sort_order: 3 },
        ],
      }),
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Next-Action': 'reorderTasks',
        },
      }
    );

    reorderTime.add(Date.now() - start);
    cacheInvalidations.add(1);

    check(res, {
      'reorder successful': (r) => r.status === 200 || r.status === 303,
      'reorder under 2s': (r) => r.timings.duration < 2000,
    });

    errorRate.add(res.status >= 400);
  });

  sleep(randomBetween(5, 20));
}

function authenticateTestUser() {
  const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://lazhmdyajdqbnxxwyxun.supabase.co';
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': __ENV.SUPABASE_ANON_KEY,
      },
    }
  );
  return res.status === 200 ? JSON.parse(res.body) : { accessToken: null };
}

function getHeaders(data) {
  return {
    'Cookie': `sb-lazhmdyajdqbnxxwyxun-auth-token=${data.accessToken || data.access_token}`,
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'k6-load-test/1.0',
  };
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

---

### 5.4 Inbox Polling and Mark-as-Read

Simulates the inbox pattern: periodic page refreshes (users checking notifications) and mark-as-read mutations.

```javascript
// load-tests/04-inbox-polling.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const inboxLoadTime = new Trend('inbox_load_time', true);
const markReadTime = new Trend('mark_read_time', true);
const markAllReadTime = new Trend('mark_all_read_time', true);
const unreadCountTime = new Trend('unread_count_time', true);

const BASE_URL = __ENV.BASE_URL || 'https://pms-nine-gold.vercel.app';

export const options = {
  scenarios: {
    inbox_polling: {
      executor: 'constant-vus',
      vus: 40,
      duration: '10m',
    },
  },
  thresholds: {
    inbox_load_time: ['p(95)<1500'],
    mark_read_time: ['p(95)<1000'],
    unread_count_time: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

export function setup() {
  return authenticateTestUser();
}

export default function(data) {
  const headers = getHeaders(data);

  // --- Load Inbox Page ---
  group('Load Inbox', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/inbox`, { headers });

    inboxLoadTime.add(Date.now() - start);

    check(res, {
      'inbox loads': (r) => r.status === 200,
      'inbox has content': (r) => r.body.length > 500,
    });

    errorRate.add(res.status !== 200);
  });

  // Short think time -- users check inbox quickly
  sleep(randomBetween(3, 8));

  // --- Mark Single Item as Read (70% of users do this) ---
  if (Math.random() < 0.7) {
    group('Mark as Read', () => {
      const start = Date.now();

      const res = http.post(
        `${BASE_URL}/inbox`,
        JSON.stringify({ inboxItemId: 'item-id-placeholder' }),
        {
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Next-Action': 'markAsRead',
          },
        }
      );

      markReadTime.add(Date.now() - start);

      check(res, {
        'marked as read': (r) => r.status === 200 || r.status === 303,
      });

      errorRate.add(res.status >= 400);
    });

    sleep(randomBetween(1, 3));
  }

  // --- Mark All as Read (5% of users do this) ---
  if (Math.random() < 0.05) {
    group('Mark All as Read', () => {
      const start = Date.now();

      const res = http.post(
        `${BASE_URL}/inbox`,
        JSON.stringify({}),
        {
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Next-Action': 'markAllAsRead',
          },
        }
      );

      markAllReadTime.add(Date.now() - start);

      check(res, {
        'all marked read': (r) => r.status === 200 || r.status === 303,
      });

      errorRate.add(res.status >= 400);
    });
  }

  // --- Simulated Polling Interval ---
  // Users typically re-check inbox every 30-60 seconds
  sleep(randomBetween(15, 45));

  // --- Quick Unread Count Check (simulates badge update) ---
  group('Unread Count Check', () => {
    const start = Date.now();

    // This would be a Server Action call to getCachedUnreadCount()
    const res = http.post(
      `${BASE_URL}/inbox`,
      JSON.stringify({}),
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Next-Action': 'getUnreadCount',
        },
      }
    );

    unreadCountTime.add(Date.now() - start);

    check(res, {
      'count retrieved': (r) => r.status === 200 || r.status === 303,
      'count under 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(randomBetween(10, 30));
}

function authenticateTestUser() {
  const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://lazhmdyajdqbnxxwyxun.supabase.co';
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': __ENV.SUPABASE_ANON_KEY,
      },
    }
  );
  return res.status === 200 ? JSON.parse(res.body) : { accessToken: null };
}

function getHeaders(data) {
  return {
    'Cookie': `sb-lazhmdyajdqbnxxwyxun-auth-token=${data.accessToken || data.access_token}`,
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'k6-load-test/1.0',
  };
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

---

### 5.5 AI Chat Streaming

Tests the AI chat endpoint, which has strict rate limits (50/day, 3 concurrent/minute) and high-latency external API calls.

```javascript
// load-tests/05-ai-chat.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const chatResponseTime = new Trend('chat_response_time', true);
const rateLimitHits = new Counter('rate_limit_hits');

const BASE_URL = __ENV.BASE_URL || 'https://pms-nine-gold.vercel.app';

export const options = {
  scenarios: {
    ai_chat: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },    // Start slow (rate limits)
        { duration: '3m', target: 10 },   // Peak AI usage
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    // AI responses are inherently slow (500ms - 30s)
    chat_response_time: ['p(50)<10000', 'p(95)<30000'],
    errors: ['rate<0.30'], // Higher error tolerance due to rate limits
  },
};

export function setup() {
  return authenticateTestUser();
}

export default function(data) {
  const headers = getHeaders(data);

  // --- Load Chat Page ---
  group('Load Chat Page', () => {
    const res = http.get(`${BASE_URL}/chat`, { headers });

    check(res, {
      'chat page loads': (r) => r.status === 200,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(randomBetween(5, 15)); // User thinks about what to ask

  // --- Send AI Message ---
  group('Send AI Message', () => {
    const start = Date.now();

    const messages = [
      'What are the overdue tasks across all my projects?',
      'Create a summary of project progress for this week',
      'Help me prioritize my current tasks',
      'What tasks are assigned to me that are high priority?',
      'Suggest a plan for the next sprint based on backlog',
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    // Server Action: sendAIMessage(conversationId, message)
    // This calls the AI provider (OpenAI/Anthropic/Google) -- high latency
    const res = http.post(
      `${BASE_URL}/chat`,
      JSON.stringify({
        message: message,
        conversationId: 'conversation-id-placeholder',
      }),
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Next-Action': 'sendMessage',
        },
        timeout: '60s', // AI responses can take up to 30s
      }
    );

    chatResponseTime.add(Date.now() - start);

    if (res.status === 429) {
      rateLimitHits.add(1);
      check(res, {
        'rate limited (expected)': (r) => r.status === 429,
      });
    } else {
      check(res, {
        'ai response received': (r) => r.status === 200 || r.status === 303,
      });
      errorRate.add(res.status >= 400 && res.status !== 429);
    }
  });

  // Long think time -- AI responses are read carefully
  sleep(randomBetween(30, 120));
}

function authenticateTestUser() {
  const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://lazhmdyajdqbnxxwyxun.supabase.co';
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': __ENV.SUPABASE_ANON_KEY,
      },
    }
  );
  return res.status === 200 ? JSON.parse(res.body) : { accessToken: null };
}

function getHeaders(data) {
  return {
    'Cookie': `sb-lazhmdyajdqbnxxwyxun-auth-token=${data.accessToken || data.access_token}`,
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'k6-load-test/1.0',
  };
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

---

### 5.6 Composite User Journey

Combines all user actions into a realistic mixed workload that reflects actual usage patterns.

```javascript
// load-tests/06-composite-journey.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time', true);
const actionTime = new Trend('action_time', true);

const BASE_URL = __ENV.BASE_URL || 'https://pms-nine-gold.vercel.app';

export const options = {
  scenarios: {
    // Normal business hours load
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '10m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'compositeJourney',
    },
    // Peak load overlay
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 0 },    // Wait for normal load to stabilize
        { duration: '1m', target: 200 },   // Spike to 200
        { duration: '5m', target: 200 },   // Sustain peak
        { duration: '2m', target: 0 },     // Ramp down
      ],
      exec: 'compositeJourney',
      startTime: '5m', // Start after normal load stabilizes
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<3000', 'p(99)<8000'],
    page_load_time: ['p(95)<3000'],
    action_time: ['p(95)<2000'],
    errors: ['rate<0.05'],
  },
};

export function setup() {
  return authenticateTestUser();
}

// Weighted action selection based on user behavior model
function selectAction() {
  const rand = Math.random() * 100;
  if (rand < 25) return 'view_projects';       // 25%
  if (rand < 40) return 'view_project_detail';  // 15%
  if (rand < 60) return 'view_tasks';           // 20%
  if (rand < 70) return 'create_task';          // 10%
  if (rand < 85) return 'check_inbox';          // 15%
  if (rand < 90) return 'mark_read';            // 5%
  if (rand < 95) return 'load_more';            // 5%
  if (rand < 98) return 'ai_chat';              // 3%
  return 'settings';                             // 2%
}

export function compositeJourney(data) {
  const headers = getHeaders(data);
  const action = selectAction();

  switch (action) {
    case 'view_projects':
      group('View Projects', () => {
        const start = Date.now();
        const res = http.get(`${BASE_URL}/projects`, { headers });
        pageLoadTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 });
        errorRate.add(res.status !== 200);
      });
      sleep(randomBetween(5, 15));
      break;

    case 'view_project_detail':
      group('View Project Detail', () => {
        const projectId = __ENV.TEST_PROJECT_ID || 'test-project';
        const start = Date.now();
        const res = http.get(`${BASE_URL}/projects/${projectId}`, { headers });
        pageLoadTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 });
        errorRate.add(res.status !== 200);
      });
      sleep(randomBetween(10, 30));
      break;

    case 'view_tasks':
      group('View Tasks', () => {
        const start = Date.now();
        const res = http.get(`${BASE_URL}/tasks`, { headers });
        pageLoadTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 });
        errorRate.add(res.status !== 200);
      });
      sleep(randomBetween(5, 20));
      break;

    case 'create_task':
      group('Create Task', () => {
        const start = Date.now();
        const res = http.post(
          `${BASE_URL}/projects/${__ENV.TEST_PROJECT_ID || 'test'}`,
          JSON.stringify({
            name: `Task ${Date.now()}`,
            status: 'todo',
            priority: 'medium',
          }),
          {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'Next-Action': 'createTask',
            },
          }
        );
        actionTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 || r.status === 303 });
        errorRate.add(res.status >= 400);
      });
      sleep(randomBetween(15, 45));
      break;

    case 'check_inbox':
      group('Check Inbox', () => {
        const start = Date.now();
        const res = http.get(`${BASE_URL}/inbox`, { headers });
        pageLoadTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 });
        errorRate.add(res.status !== 200);
      });
      sleep(randomBetween(3, 10));
      break;

    case 'mark_read':
      group('Mark Read', () => {
        const start = Date.now();
        const res = http.post(
          `${BASE_URL}/inbox`,
          JSON.stringify({ inboxItemId: 'placeholder' }),
          {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'Next-Action': 'markAsRead',
            },
          }
        );
        actionTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 || r.status === 303 });
        errorRate.add(res.status >= 400);
      });
      sleep(randomBetween(1, 3));
      break;

    case 'load_more':
      group('Load More', () => {
        const pages = ['/projects', '/tasks', '/inbox', '/clients'];
        const page = pages[Math.floor(Math.random() * pages.length)];
        const start = Date.now();
        const res = http.post(
          `${BASE_URL}${page}`,
          JSON.stringify({ cursor: 'cursor-placeholder' }),
          {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'Next-Action': 'loadMore',
            },
          }
        );
        actionTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 || r.status === 303 });
        errorRate.add(res.status >= 400);
      });
      sleep(randomBetween(5, 10));
      break;

    case 'ai_chat':
      group('AI Chat', () => {
        const start = Date.now();
        const res = http.post(
          `${BASE_URL}/chat`,
          JSON.stringify({ message: 'What are my priorities today?' }),
          {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'Next-Action': 'sendMessage',
            },
            timeout: '60s',
          }
        );
        actionTime.add(Date.now() - start);
        // 429 is expected due to rate limits
        check(res, { 'ok': (r) => r.status === 200 || r.status === 303 || r.status === 429 });
        errorRate.add(res.status >= 400 && res.status !== 429);
      });
      sleep(randomBetween(30, 120));
      break;

    case 'settings':
      group('Settings', () => {
        const start = Date.now();
        const res = http.get(`${BASE_URL}/settings`, { headers });
        pageLoadTime.add(Date.now() - start);
        check(res, { 'ok': (r) => r.status === 200 });
        errorRate.add(res.status !== 200);
      });
      sleep(randomBetween(10, 30));
      break;
  }
}

function authenticateTestUser() {
  const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://lazhmdyajdqbnxxwyxun.supabase.co';
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': __ENV.SUPABASE_ANON_KEY,
      },
    }
  );
  return res.status === 200 ? JSON.parse(res.body) : { accessToken: null };
}

function getHeaders(data) {
  return {
    'Cookie': `sb-lazhmdyajdqbnxxwyxun-auth-token=${data.accessToken || data.access_token}`,
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'k6-load-test/1.0',
  };
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

---

## 6. Test Scenarios and Configuration

### 6.1 Normal Load (50 Concurrent Users)

**Scenario:** Regular business hours with a team of ~50 active users.

```javascript
// Configuration for normal load
export const options = {
  scenarios: {
    normal: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 50 },    // Gradual ramp-up
        { duration: '10m', target: 50 },   // Sustained load
        { duration: '2m', target: 0 },     // Graceful ramp-down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<300', 'p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],         // <1% error rate
    http_reqs: ['rate>10'],                  // >10 req/s throughput
  },
};
```

**Expected resource consumption at 50 VUs:**

| Resource | Estimated Usage | Capacity | Utilization |
|----------|----------------|----------|-------------|
| Supabase connections (concurrent) | 10-25 | 60-200 | 12-42% |
| KV commands/second | 50-150 | 1000 | 5-15% |
| Vercel serverless functions | 20-50 | 1000 | 2-5% |
| Supabase Realtime connections | 50-100 | 200-500 | 25-50% |

---

### 6.2 Peak Load (200 Concurrent Users)

**Scenario:** All hands on deck -- entire organization plus clients accessing shared projects.

```javascript
export const options = {
  scenarios: {
    peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 50 },    // Warm up
        { duration: '3m', target: 200 },   // Ramp to peak
        { duration: '10m', target: 200 },  // Sustained peak
        { duration: '3m', target: 50 },    // Ramp down
        { duration: '2m', target: 0 },     // Cool down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<3000', 'p(99)<8000'],
    http_req_failed: ['rate<0.05'],         // <5% error rate
    http_reqs: ['rate>30'],                  // >30 req/s throughput
  },
};
```

**Expected resource consumption at 200 VUs:**

| Resource | Estimated Usage | Capacity | Utilization |
|----------|----------------|----------|-------------|
| Supabase connections (concurrent) | 40-100 | 60-200 | 50-100% |
| KV commands/second | 200-600 | 1000 | 20-60% |
| Vercel serverless functions | 80-200 | 1000 | 8-20% |
| Supabase Realtime connections | 200-400 | 200-500 | **80-100%** |

---

### 6.3 Stress Test (500 Concurrent Users)

**Scenario:** Deliberately exceed expected capacity to find breaking points.

```javascript
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 200 },
        { duration: '3m', target: 500 },   // Push to breaking point
        { duration: '5m', target: 500 },   // Sustain stress
        { duration: '3m', target: 200 },   // Step down
        { duration: '2m', target: 0 },     // Recovery
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<1000', 'p(95)<10000'],
    http_req_failed: ['rate<0.25'],         // <25% error rate (stress test)
  },
};
```

**Expected resource consumption at 500 VUs:**

| Resource | Estimated Usage | Capacity | Utilization |
|----------|----------------|----------|-------------|
| Supabase connections (concurrent) | 100-250 | 60-200 | **>100% -- SATURATED** |
| KV commands/second | 500-1500 | 1000 | **50-150% -- THROTTLED** |
| Vercel serverless functions | 200-500 | 1000 | 20-50% |
| Supabase Realtime connections | 500-1000 | 200-500 | **>100% -- REJECTED** |

---

### 6.4 Spike Test (0 to 300 in 30 Seconds)

**Scenario:** Sudden traffic burst -- team opening PMS at 9am Monday.

```javascript
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 300 },  // Instant spike
        { duration: '5m', target: 300 },   // Sustain spike
        { duration: '2m', target: 50 },    // Drop to normal
        { duration: '3m', target: 50 },    // Sustained normal (recovery check)
        { duration: '1m', target: 0 },     // Shutdown
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<800', 'p(95)<5000'],
    http_req_failed: ['rate<0.15'],
  },
};
```

**Spike-specific concerns:**

1. **Cold start storm:** Vercel must spin up ~300 serverless functions simultaneously. At ~100ms per cold start, the p95 will spike dramatically during the first 30 seconds.
2. **KV cache stampede:** All 300 users' layout KV reads happen at once. For users whose KV entries have expired, all will simultaneously query Supabase for orgs, profiles, and sidebar data.
3. **PgBouncer queue:** 300 users x ~3-6 Supabase calls per page = 900-1800 concurrent PostgREST requests, all queuing through PgBouncer.
4. **Middleware auth validation:** The KV session cache (5-minute TTL) may be cold for many users. ~300 concurrent `getUser()` calls to Supabase Auth at ~400ms each will saturate auth service capacity.

---

## 7. Expected Results Analysis

### 7.1 Response Time Predictions

Based on the architecture model, profiling data, and infrastructure constraints, the following predictions account for queuing, cold starts, and cache behavior.

#### Page Load Response Times (GET requests)

| Page | 50 VUs p50 | 50 VUs p95 | 200 VUs p50 | 200 VUs p95 | 500 VUs p50 | 500 VUs p95 |
|------|-----------|-----------|-------------|-------------|-------------|-------------|
| /projects | 150ms | 500ms | 300ms | 1,500ms | 1,000ms | 8,000ms |
| /tasks | 180ms | 600ms | 400ms | 2,000ms | 1,200ms | 10,000ms |
| /clients | 160ms | 550ms | 350ms | 1,800ms | 1,100ms | 9,000ms |
| /inbox | 120ms | 400ms | 250ms | 1,200ms | 800ms | 6,000ms |
| /projects/[id] | 300ms | 1,200ms | 600ms | 3,000ms | 2,000ms | 15,000ms+ |
| /chat | 130ms | 450ms | 270ms | 1,300ms | 900ms | 7,000ms |
| /settings | 110ms | 350ms | 220ms | 1,000ms | 700ms | 5,000ms |

**Key observations:**

- **/projects/[id]** is the outlier due to 14 Supabase calls (8 for getProjectWithDetails). Under load, these 14 calls compete for PgBouncer slots, causing queuing delays that compound multiplicatively.
- **/inbox** is fastest because it has only 2 Supabase calls with no nested joins. However, it lacks KV caching for its first page, so every request hits the database directly.
- At **500 VUs**, PgBouncer exhaustion causes most requests to queue. The p95 times grow exponentially as connection pool contention increases.

#### Server Action Response Times (POST requests)

| Action | 50 VUs p50 | 50 VUs p95 | 200 VUs p50 | 200 VUs p95 |
|--------|-----------|-----------|-------------|-------------|
| Create Task | 120ms | 400ms | 300ms | 1,500ms |
| Update Status | 80ms | 300ms | 200ms | 1,000ms |
| Reorder Tasks (RPC) | 100ms | 350ms | 250ms | 1,200ms |
| Mark as Read | 60ms | 250ms | 150ms | 800ms |
| Load More (cursor) | 50ms | 200ms | 150ms | 800ms |
| AI Chat | 3,000ms | 15,000ms | 5,000ms | 30,000ms |

**Mutation overhead:** Each write operation triggers `invalidateCache.*`, which performs 1 KV DEL call (~1-5ms) and multiple `revalidateTag()` calls (~0ms). Under load, the KV DEL calls add to the KV command rate but do not significantly increase per-request latency.

#### Cold Start Impact Distribution

| Load Level | % Requests Hitting Cold Start | Cold Start Overhead |
|------------|------------------------------|-------------------|
| 50 VUs (steady) | 5-10% | +100-200ms |
| 200 VUs (steady) | 15-25% | +100-300ms |
| 300 VUs (spike) | 60-80% (first 30s) | +100-500ms |
| 500 VUs (stress) | 20-30% | +100-400ms |

---

### 7.2 Throughput Estimates

#### Requests Per Second

| Load Level | Page Loads/s | Server Actions/s | Total req/s |
|------------|-------------|-----------------|-------------|
| 50 VUs | 3-5 | 2-4 | 5-9 |
| 200 VUs | 10-18 | 8-15 | 18-33 |
| 500 VUs | 15-25 | 12-20 | 27-45 |

**Why throughput does not scale linearly:** Think times (5-45 seconds between actions) dominate. With an average think time of 15 seconds, 50 VUs generate ~50/15 = 3.3 requests/second. At 500 VUs, some requests queue behind PgBouncer, reducing effective throughput.

#### Database Operations Per Second

| Load Level | PostgREST queries/s | KV commands/s | Realtime events/s |
|------------|-------------------|--------------|-------------------|
| 50 VUs | 20-50 | 50-150 | 5-20 |
| 200 VUs | 80-200 | 200-600 | 20-80 |
| 500 VUs | 150-350 | 500-1,500 | 50-200 |

---

### 7.3 Breaking Point Analysis

#### Bottleneck #1: Supabase PgBouncer Connection Pool

**When it breaks:** ~150-300 concurrent database requests (depends on Supabase plan)

**How it manifests:**
- PostgREST returns `500 Internal Server Error` or `504 Gateway Timeout` when all PgBouncer slots are occupied
- The Server Actions return `{ error: "..." }` instead of data
- Response times spike as requests queue in PgBouncer's wait queue (if configured) or get rejected immediately

**Estimated concurrent DB connections by load level:**

```
50 VUs:  Each VU makes ~3-6 DB calls per page, with ~50ms average query time
         Concurrent connections: 50 * (3/15s avg think time) * 0.05s = ~0.5 per VU
         Total: ~25 concurrent connections

200 VUs: Same model but with queuing effects
         Total: ~100 concurrent connections (hitting pool limit)

500 VUs: Pool saturated at ~150-200 connections
         Excess requests queue or fail
         Total attempted: ~250 concurrent, ~100 rejected
```

**Critical amplifier -- /projects/[id] page:**
This page makes 14 Supabase calls. A single user viewing a project detail page holds ~14 PgBouncer slots for ~200ms. At 200 VUs with 15% viewing project details (30 users), that is 30 * 14 = 420 connection-slots in a burst.

#### Bottleneck #2: Vercel KV (Upstash Redis) Command Rate

**When it breaks:** ~1,000 commands/second (Pro plan typical)

**How it manifests:**
- KV operations start returning errors or timeouts
- `cacheGet()` in `lib/cache/utils.ts` catches the error and falls through to the Supabase fetcher
- Every KV failure triggers a Supabase query, creating a cascading failure that amplifies PgBouncer load

**KV command volume model:**
```
Per page load: 5-6 KV reads (layout) + 0-2 KV reads (page data)
Per mutation:  1-2 KV DELs (invalidation)

50 VUs:  ~5 req/s * 7 KV ops = ~35 KV ops/s (well within limits)
200 VUs: ~20 req/s * 7 KV ops = ~140 KV ops/s (comfortable)
500 VUs: ~35 req/s * 7 KV ops = ~245 KV ops/s (approaching limits on lower plans)
```

**Cascading failure scenario:** If KV becomes unavailable, ALL cache hits become misses. Each page load now makes 5-6 additional Supabase calls (previously served from KV). This multiplies PgBouncer pressure by ~2-3x.

#### Bottleneck #3: Supabase Realtime WebSocket Connections

**When it breaks:** ~200-500 concurrent connections (plan-dependent)

**How it manifests:**
- New WebSocket connections are rejected
- Existing connections may be dropped during load shedding
- Users see stale data (no real-time updates) but the application still functions

**Connection model:**
```
Per user session: 1-7 WebSocket channels (depends on active page)
Average: ~2 channels per active user

50 VUs:  ~100 channels (within limits)
200 VUs: ~400 channels (near limit)
500 VUs: ~1,000 channels (2-5x over limit)
```

**Mitigating factor:** The pooled subscription system (`RealtimeProvider`) deduplicates channels for the same table:filter pair within a single client. However, each browser tab is a separate client. The auto-pause on tab hidden reduces steady-state connections but not peak.

#### Bottleneck #4: Cache Stampede on TTL Expiry

**When it breaks:** Every 30-120 seconds (depending on cache tier), under concurrent load

**How it manifests:**
- Tasks KV cache expires every 30 seconds
- All concurrent requests for the same org/user simultaneously miss the cache
- All simultaneously query Supabase for the same data
- "Thundering herd" pattern multiplies PgBouncer pressure by the number of concurrent users in the same org

**Worst case:** 50 users in the same org, tasks cache expires. All 50 simultaneously call `getMyTasks()`, which each make 1 Supabase query. That is 50 identical queries competing for PgBouncer slots instead of 1.

#### Bottleneck #5: Unbounded Queries Under Load

**When it breaks:** Proportional to data size, amplified by concurrency

**How it manifests:**
- `getTaskStats()` fetches ALL rows for a project. With 500 tasks per project and 50 concurrent requests, that is 50 * 500 = 25,000 rows transferred per 30-second window (before task cache expires again)
- `getClientsWithProjectCounts()` fetches ALL projects for displayed clients. With 20 projects per client and 50 clients per page, that is 1,000 project rows transferred per request
- These queries hold PgBouncer connections longer due to large result sets, reducing effective pool capacity

---

### 7.4 Bottleneck Identification at Scale

#### Priority-Ordered Bottleneck Map

```
Load Level:  50 VUs    100 VUs    200 VUs    300 VUs    500 VUs
             |          |          |          |          |
             |          |          |  [3] Realtime WS   |
             |          |          |  connections hit    |
             |          |          |  plan limits        |
             |          |          |          |          |
             |          |  [4] Cache stampede            |
             |          |  becomes visible               |
             |          |  (p95 spikes every             |
             |          |   30s/2m cycles)               |
             |          |          |          |          |
             |          |          |  [1] PgBouncer      |
             |          |          |  saturation begins  |
             |          |          |          |          |
             |          |          |          |  [2] KV  |
             |          |          |          |  throttle|
             |          |          |          |  cascade |
             |          |          |          |          |
[5] Unbounded queries degrade linearly with data size   |
    at ALL load levels -- data-proportional, not user-   |
    proportional                                         |
```

---

## 8. Comparison Against Profiling Baselines

### Single-User Baseline vs. Load Test Predictions

| Metric | Single User (Profiled) | 50 VUs (Predicted) | Degradation Factor |
|--------|----------------------|--------------------|--------------------|
| Projects page TTFB | 179ms | 150ms p50, 500ms p95 | 1.0x p50, 2.8x p95 |
| Tasks page TTFB | 96ms | 180ms p50, 600ms p95 | 1.9x p50, 6.3x p95 |
| Inbox page TTFB | 102ms | 120ms p50, 400ms p95 | 1.2x p50, 3.9x p95 |
| Clients page TTFB | 126ms | 160ms p50, 550ms p95 | 1.3x p50, 4.4x p95 |
| Sidebar navigation | 382-420ms | ~500ms | 1.2-1.3x |

**Why p95 degrades more than p50:** The p50 represents warm-cache, warm-function requests. The p95 captures cold starts, KV misses, and PgBouncer queuing. Under load, these tail events become more frequent because:
1. More Vercel serverless functions are spun up (more cold starts)
2. KV cache entries expire and N users stampede simultaneously
3. PgBouncer queue wait times increase nonlinearly with utilization

### Lighthouse Scores Under Load

Lighthouse scores are measured with a single synthetic user, so they do not degrade under load directly. However, the backend response times that contribute to TTFB and LCP do degrade:

| Page | Lighthouse Perf (Single User) | Estimated Lighthouse Under 200 VUs |
|------|------------------------------|-----------------------------------|
| Inbox | 78 | 55-65 (LCP increases by ~1s) |
| Projects | 69 | 45-55 (LCP increases by ~1.5s) |
| Tasks | 47 | 30-40 (LCP increases by ~2s) |
| Clients | 61 | 40-50 (LCP increases by ~1.5s) |

The Tasks page is already the worst performer at 47 (single user). Under load, the 4 parallel Supabase fetches contend for PgBouncer connections, and the tasks KV cache (30s TTL) expires frequently, causing cache stampedes.

### Cache Hit Rate Predictions Under Load

| Cache Tier | TTL | Hit Rate (1 user) | Hit Rate (50 VUs) | Hit Rate (200 VUs) |
|------------|-----|-------------------|--------------------|--------------------|
| USER/ORGS | 10min | ~95% | ~98% | ~99% |
| SIDEBAR | 5min | ~90% | ~95% | ~98% |
| PROJECTS | 2min | ~80% | ~90% | ~95% |
| CLIENTS | 2min | ~80% | ~90% | ~95% |
| TASKS | 30s | ~50% | ~70% | ~80% |
| DASHBOARD_STATS | 30s | ~50% | ~70% | ~80% |

Higher concurrency increases hit rate because more requests are served within the same TTL window. However, the stampede on TTL expiry is also more severe.

### Known Bottleneck Impact Under Load

| Bottleneck (from profiling) | Impact at 1 User | Impact at 50 VUs | Impact at 200 VUs |
|-----------------------------|------------------|-------------------|--------------------|
| getTaskStats() full scan | 50-200ms | 50-200ms each (50x DB load) | Contributes to PgBouncer saturation |
| getClientStats() full scan | 30-100ms | 30-100ms each | Same |
| getClientsWithProjectCounts() unbounded | 30-200ms | 30-200ms each (holds connections longer) | Same |
| Missing cursor pagination indexes | +10-50ms per paginated query | +10-50ms * concurrent queries | Compounds PgBouncer queuing |
| No KV cache for inbox first page | +30-80ms | 50 concurrent DB hits per 30s | 200 concurrent DB hits |
| No KV cache for clients-with-counts | +50-100ms | Same pattern | Same pattern |
| Tasks page full ProjectWithRelations | +20-40ms serialization | Larger RSC payloads * 50 | Bandwidth and CPU overhead |

---

## 9. Scalability Analysis

### 9.1 Users per Organization

The PMS architecture is multi-tenant with organization-based isolation (RLS). Scaling users within an organization has these effects:

#### Database Impact

| Users per Org | KV Cache Effectiveness | PgBouncer Pressure | Realtime Channels |
|--------------|----------------------|-------------------|-------------------|
| 5 | Low hit rate (few requests within TTL) | Negligible | 5-35 |
| 20 | Good hit rate | Moderate | 20-140 |
| 50 | High hit rate (same data served from cache) | High if simultaneous | 50-350 |
| 200 | Very high hit rate | **Critical** during stampedes | **200-1400 (exceeds limits)** |

**Shared cache benefit:** Projects, clients, tags, and members data is org-scoped. When 50 users in the same org view the projects list, only the first request (after TTL expiry) hits Supabase. The remaining 49 are served from KV cache. This means adding more users to the same org has sublinear database cost.

**Individual cache cost:** Each user has their own tasks (user-scoped), inbox (user-scoped), profile (user-scoped), and session (user-scoped) cache entries. These do NOT benefit from shared caching. Adding 100 users to an org adds 100 * 4 = 400 KV cache entries and 100 independent Supabase query streams for per-user data.

#### Realtime Scaling Concern

Each user subscribing to the `projects` table for their org creates either a pooled or non-pooled WebSocket channel. With pooled subscriptions, N users in the same org share 1 subscription per table-filter pair within each browser tab. But across N browser tabs (one per user), that is still N separate WebSocket connections.

**Recommendation:** For organizations with 50+ concurrent users, consider:
- Reducing realtime subscription granularity (only subscribe to actively viewed entities)
- Implementing a shared realtime relay (server-side) instead of per-client subscriptions
- Increasing the Supabase plan for higher WebSocket connection limits

---

### 9.2 Projects and Tasks per Organization

Data volume scaling affects query performance linearly for unbounded queries and logarithmically for indexed queries.

#### Query Performance by Data Volume

| Entity Count | Indexed Query (cursor) | Unbounded Query (full scan) | Memory Impact |
|-------------|----------------------|---------------------------|---------------|
| 100 tasks/project | 5-10ms | 20-50ms | ~5KB per scan |
| 500 tasks/project | 5-10ms | 100-250ms | ~25KB per scan |
| 2,000 tasks/project | 5-10ms | 400-1,000ms | ~100KB per scan |
| 10,000 tasks/project | 5-15ms (index may not fit in buffer) | 2,000-5,000ms | ~500KB per scan |

**Key insight:** Cursor-paginated queries with aligned indexes are **constant time** regardless of table size (O(log n + page_size)). The unbounded queries (getTaskStats, getClientStats, getTasks without cursor for board view) degrade linearly. This means the profiling P0 fixes (SQL aggregation RPCs, new indexes) become exponentially more important as data grows.

#### Board View Scaling Risk

The tasks board/drag-drop view calls `getTasks(projectId)` without a cursor, fetching ALL tasks for the project. At 500 tasks, this is ~500 rows with joins to profiles and workstreams. At 2,000 tasks, this is ~2,000 rows (~200KB+ network payload) plus React rendering all 2,000 task cards.

**Breaking points:**
- 500 tasks: Noticeable load time (~1-2s), acceptable UX
- 1,000 tasks: Slow load (~3-5s), poor UX, high memory
- 2,000+ tasks: Unusable (~5-10s+ load, browser may become unresponsive)

#### KV Cache Payload Growth

Larger datasets mean larger KV cache entries. A projects list with 50 projects, each having 5 members with profiles, produces a JSON payload of ~60-100KB. This increases KV read latency and deserialization time:

| Cache Entry Size | KV Read Latency | Deserialization Time |
|-----------------|-----------------|---------------------|
| 10KB | 2-3ms | ~1ms |
| 50KB | 3-5ms | ~3ms |
| 100KB | 5-10ms | ~5ms |
| 500KB | 20-50ms | ~15ms |

---

### 9.3 Concurrent WebSocket Connections

Supabase Realtime uses Phoenix Channels over WebSocket. Each browser tab maintains a WebSocket connection to Supabase, then subscribes to specific tables/filters as channels on that connection.

#### Connection Budget Model

```
Per user (single tab, on project detail page):
  1 WebSocket connection to Supabase
  4-7 channel subscriptions:
    - projects (org filter)
    - tasks (project filter)
    - workstreams (project filter)
    - project single (id filter)
    - task timeline (task filter, if panel open)
    - inbox items (user filter, via InboxContent)
    - files (project filter)

Supabase counts: 1 WebSocket connection + N channels
Connection limit applies to WebSocket connections, not channels.
```

#### Scaling Model

| Concurrent Users | WebSocket Connections | Channels (estimated) | Within Limits? |
|-----------------|----------------------|---------------------|----------------|
| 10 | 10 | 30-70 | Yes (all plans) |
| 50 | 50 | 150-350 | Yes (Pro plan) |
| 100 | 100 | 300-700 | Marginal (Pro plan) |
| 200 | 200 | 600-1,400 | **Exceeds free/Pro limits** |
| 500 | 500 | 1,500-3,500 | **Requires Team/Enterprise plan** |

#### Auto-Pause Effectiveness

The `useDocumentVisibility()` hook pauses realtime subscriptions when the browser tab is hidden. This reduces steady-state connections but not peak:

| User Behavior | Active Tabs (estimated) | Effective Connections |
|---------------|------------------------|---------------------|
| Single tab, focused | 100% | 1.0x |
| Multi-tab, 1 focused | 30% active | 0.3x (70% paused) |
| Tab hidden (meeting, etc.) | 0% active | 0x |
| Average across users | ~40-60% active | 0.4-0.6x |

**Effective concurrent connections = Total users * 0.4-0.6**

This means 200 total users likely produce 80-120 active WebSocket connections, which is within Pro plan limits. However, after a meeting ends and 200 tabs become visible simultaneously, there is a reconnection storm.

---

## 10. Resource Saturation Model

### Queuing Theory Model (M/M/c Queue)

Modeling the PgBouncer connection pool as an M/M/c queue where:
- **c** = pool size (e.g., 100 connections)
- **lambda** = arrival rate (requests/second)
- **mu** = service rate (1/average query time)

| Load Level | Arrival Rate | Service Rate | Utilization (rho) | Avg Queue Wait |
|------------|-------------|-------------|-------------------|----------------|
| 50 VUs | ~40 req/s | ~20 req/s/conn | 0.4 | ~0ms (no queuing) |
| 200 VUs | ~160 req/s | ~20 req/s/conn | 0.8 | ~25ms |
| 300 VUs | ~240 req/s | ~20 req/s/conn | **1.2 (oversaturated)** | **500ms+ (growing)** |
| 500 VUs | ~400 req/s | ~20 req/s/conn | **2.0 (severe)** | **2,000ms+ (queue overflow)** |

**Utilization > 0.8 is the danger zone.** Beyond 80% utilization, queue wait times grow exponentially (not linearly). This is why the jump from 200 to 300 VUs produces a disproportionate latency increase.

### Heat Map: Resource Pressure by Scenario

```
Resource         | 50 VUs  | 200 VUs | 300 Spike | 500 VUs
-----------------+---------+---------+-----------+---------
PgBouncer        | GREEN   | YELLOW  | RED       | CRITICAL
Vercel KV        | GREEN   | GREEN   | YELLOW    | YELLOW
Vercel Functions | GREEN   | GREEN   | YELLOW    | GREEN
Realtime WS      | GREEN   | YELLOW  | RED       | CRITICAL
Auth Service      | GREEN   | GREEN   | RED*      | YELLOW
Bandwidth (RSC)  | GREEN   | GREEN   | GREEN     | YELLOW

GREEN    = <50% utilization
YELLOW   = 50-80% utilization
RED      = 80-100% utilization
CRITICAL = >100% (failures occurring)

* Auth Service: RED during spike because 300 KV session cache misses
  all call getUser() simultaneously (~400ms each)
```

---

## 11. Recommendations

### Pre-Load Test Actions (Required Before Running Tests)

1. **Create dedicated test users.** Create 5-10 test users in Supabase Auth with known credentials. Pre-generate their auth tokens in the k6 setup phase. This avoids the 5 req/15min auth rate limit during the test itself.

2. **Seed representative data.** Ensure the test organization has:
   - 20-50 projects with realistic names and relations
   - 100-500 tasks distributed across projects
   - 10-30 clients with varying project counts
   - 200-500 inbox items per test user

3. **Configure Supabase monitoring.** Enable the Supabase dashboard's performance monitoring and review `pg_stat_activity` during tests to observe connection pool utilization in real time.

4. **Set up Vercel analytics.** Enable Vercel's function execution metrics to track cold start frequency, execution time distribution, and error rates during load tests.

### Optimization Priorities for Load Resilience

#### Critical (Must fix before 100+ concurrent users)

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| P0-1 | Replace getTaskStats/getClientStats with SQL aggregation RPCs | Reduces per-request DB connection hold time from ~200ms to ~5ms; frees PgBouncer slots | Medium |
| P0-2 | Add 3 composite indexes for cursor pagination | Eliminates sort steps; reduces connection hold time by ~50ms per paginated query | Low |
| P0-3 | Add KV cache for inbox first page | Eliminates ~50 concurrent DB hits per 30s TTL window at 50 VUs | Low |
| P0-4 | Add KV cache for getClientsWithProjectCounts | Same pattern as P0-3 | Low |
| P0-5 | Implement stale-while-revalidate in cacheGet() | Eliminates cache stampede; serves stale data during refresh; single fetcher per expired key | Medium |

#### High (Should fix before 200+ concurrent users)

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| P1-1 | Consolidate getProjectWithDetails() into single RPC | Reduces 14 Supabase calls to 1-2 on project detail page; frees ~12 PgBouncer slots per request | High |
| P1-2 | Reduce tasks page RSC payload (slim project projection) | Reduces bandwidth by ~95KB per request; reduces serialization CPU | Medium |
| P1-3 | Add filter to task_comment_reactions realtime subscription | Eliminates global event broadcast; reduces per-connection bandwidth | Low |
| P1-4 | Batch layout KV reads with kv.mget() | Reduces 5-6 sequential KV calls to 1; saves ~4-20ms per page load | Low |

#### Medium (Should fix before 500+ concurrent users or high data volumes)

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| P2-1 | Add connection queuing/retry logic for PgBouncer exhaustion | Graceful degradation instead of hard errors at pool saturation | Medium |
| P2-2 | Implement virtual scrolling for board view (>200 tasks) | Prevents browser crashes; allows board view at scale | High |
| P2-3 | Add reconnection catch-up query after realtime re-subscribe | Prevents stale data after tab becomes visible | Medium |
| P2-4 | Evaluate Supabase plan upgrade for connection pool and Realtime limits | Infrastructure-level scaling | N/A |

### Load Test Execution Plan

| Phase | Test | Duration | VUs | Goal |
|-------|------|----------|-----|------|
| 1 | Dashboard Navigation (01) | 10min | 10-50 | Establish baseline, validate test setup |
| 2 | Pagination (02) + Inbox (04) | 10min each | 30-50 | Test read-heavy patterns |
| 3 | Task CRUD (03) | 10min | 20-50 | Test write patterns, cache invalidation |
| 4 | Composite Journey (06) Normal | 15min | 50 | Validate realistic mixed workload |
| 5 | Composite Journey (06) Peak | 20min | 50 to 200 | Identify degradation onset |
| 6 | Spike Test (06 config) | 12min | 0 to 300 | Test cold start and stampede |
| 7 | Stress Test (06 config) | 18min | 0 to 500 | Find breaking points |
| 8 | AI Chat (05) | 5min | 5-10 | Validate rate limiting works |

### Pass/Fail Criteria

| Metric | Normal (50 VUs) | Peak (200 VUs) | Stress (500 VUs) |
|--------|-----------------|----------------|-------------------|
| p50 response time | < 300ms | < 800ms | < 2,000ms |
| p95 response time | < 1,500ms | < 5,000ms | < 15,000ms |
| p99 response time | < 3,000ms | < 10,000ms | N/A |
| Error rate | < 1% | < 5% | < 25% |
| Throughput | > 5 req/s | > 15 req/s | > 10 req/s |

---

## Appendix: Infrastructure Constraints Reference

### Supabase Plan Limits (Typical Pro Plan)

| Resource | Free Tier | Pro Tier | Team/Enterprise |
|----------|-----------|----------|-----------------|
| Database connections (direct) | 60 | 100-200 | 200-500 |
| PgBouncer pool mode | Transaction | Transaction | Transaction |
| Realtime connections | 200 | 500 | Custom |
| Realtime messages/s | 100 | 500 | Custom |
| Auth requests/hour | 3,600 | 36,000 | Custom |
| Storage bandwidth/month | 2GB | 250GB | Custom |
| Edge function invocations/month | 500,000 | 2,000,000 | Custom |

### Vercel Plan Limits (Typical Pro Plan)

| Resource | Hobby | Pro | Enterprise |
|----------|-------|-----|-----------|
| Serverless function concurrency | 10 | 1,000 | Custom |
| Function execution time | 10s | 60s | 900s |
| Bandwidth/month | 100GB | 1TB | Custom |
| KV (Upstash) commands/day | 3,000 | 150,000 | Custom |
| KV max request size | 1MB | 1MB | 1MB |

### Rate Limits (Application-Level)

| Limiter | Limit | Window | Notes |
|---------|-------|--------|-------|
| Auth (per IP) | 5 requests | 15 minutes | Brute force protection |
| Auth (per email) | 10 requests | 15 minutes | Credential stuffing protection |
| AI (per user) | 50 requests | 24 hours | Cost control |
| AI concurrent | 3 requests | 1 minute | Abuse prevention |
| File upload (per user) | 50 requests | 1 hour | Storage cost control |
| Invite (per user) | 20 requests | 1 hour | Email spam prevention |

### Cache TTL Reference

| Entity | KV TTL | React cache() | Notes |
|--------|--------|---------------|-------|
| User profile | 10 min | Per request | Stable data |
| Organizations | 10 min | Per request | Stable data |
| Memberships | 5 min | Per request | Semi-stable |
| Sidebar projects | 5 min | Per request | Semi-stable |
| Projects list | 2 min | Per request | Moderate change frequency |
| Clients list | 2 min | Per request | Moderate change frequency |
| Tasks (user) | 30 sec | Per request | Volatile |
| Tasks (project) | 30 sec | Per request | Volatile |
| Dashboard stats | 30 sec | Per request | Volatile aggregate |
| Inbox items | None | Per request only | **Gap -- no KV cache** |
| Clients with counts | None | Per request only | **Gap -- no KV cache** |
| Session validation | 5 min | N/A | Middleware KV check |

---

## File References

| File | Purpose |
|------|---------|
| `C:\Users\Fares\Downloads\PMS\.performance-optimization\01-profiling.md` | Cursor pagination profiling audit |
| `C:\Users\Fares\Downloads\PMS\.performance-optimization\04-database.md` | Database optimization plan |
| `C:\Users\Fares\Downloads\PMS\.performance-optimization\05-backend.md` | Backend caching optimization plan |
| `C:\Users\Fares\Downloads\PMS\.performance-optimization\06-distributed.md` | Service communication analysis |
| `C:\Users\Fares\Downloads\PMS\.performance-optimization\08-cdn.md` | CDN and edge optimization plan |
| `C:\Users\Fares\Downloads\PMS\lib\cache\keys.ts` | Cache key definitions and TTL values |
| `C:\Users\Fares\Downloads\PMS\lib\cache\utils.ts` | cacheGet() implementation (cache-aside pattern) |
| `C:\Users\Fares\Downloads\PMS\lib\rate-limit\limiter.ts` | Rate limiting implementation |
| `C:\Users\Fares\Downloads\PMS\lib\constants.ts` | Page sizes, limits, and configuration constants |
| `C:\Users\Fares\Downloads\PMS\lib\actions\tasks\queries.ts` | Task query patterns (cursor pagination) |
| `C:\Users\Fares\Downloads\PMS\lib\actions\inbox.ts` | Inbox query patterns |
| `C:\Users\Fares\Downloads\PMS\lib\actions\projects\crud.ts` | Project query patterns |
| `C:\Users\Fares\Downloads\PMS\lib\actions\clients.ts` | Client query patterns |
| `C:\Users\Fares\Downloads\PMS\middleware.ts` | Edge middleware (auth, CSP, session cache) |
| `C:\Users\Fares\Downloads\PMS\hooks\realtime-context.tsx` | Pooled realtime subscriptions |
| `C:\Users\Fares\Downloads\PMS\hooks\use-task-timeline-realtime.ts` | Task timeline realtime (global reaction listener) |
| `C:\Users\Fares\Downloads\PMS\perf-audit-results.json` | Lighthouse and page metric baselines |
| `C:\Users\Fares\Downloads\PMS\perf-interaction-results.json` | Client-side interaction timing baselines |
| `C:\Users\Fares\Downloads\PMS\perf-bundle-results.json` | Bundle size analysis |
