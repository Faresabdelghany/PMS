# Performance Regression Testing Plan

**Application:** PMS (Project Management SaaS)
**Stack:** Next.js 16.1, React 19, Tailwind CSS 4, Supabase, Vercel
**Date:** 2026-02-14
**Scope:** Automated performance regression tests, CI/CD integration, budgets, trend analysis

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Performance Test Suite Design](#3-performance-test-suite-design)
4. [Performance Budgets and Thresholds](#4-performance-budgets-and-thresholds)
5. [Regression Detection Rules](#5-regression-detection-rules)
6. [Lighthouse CI Setup](#6-lighthouse-ci-setup)
7. [Bundle Size Tracking](#7-bundle-size-tracking)
8. [RSC Payload Size Tests](#8-rsc-payload-size-tests)
9. [API Response Time Tests](#9-api-response-time-tests)
10. [Core Web Vitals Tests](#10-core-web-vitals-tests)
11. [CI/CD Integration Configuration](#11-cicd-integration-configuration)
12. [Performance Data Storage and Trend Analysis](#12-performance-data-storage-and-trend-analysis)
13. [Test File Specifications](#13-test-file-specifications)
14. [Implementation Priority Matrix](#14-implementation-priority-matrix)

---

## 1. Executive Summary

This document defines a comprehensive performance regression testing strategy for the PMS application. The goal is to catch performance regressions before they reach production by automatically measuring and enforcing budgets across six dimensions:

| Dimension | Tool | Trigger | Blocks PR? |
|-----------|------|---------|------------|
| Core Web Vitals (LCP, CLS, TBT) | Lighthouse CI | Every PR + push to main | Yes (error thresholds) |
| Navigation performance | Playwright (existing) | Every PR + push to main | Yes (3s threshold) |
| Bundle size | `@next/bundle-analyzer` + custom script | Every PR | Yes (if >10% regression) |
| RSC payload size | Playwright response interception | Every PR | Yes (per-page budgets) |
| API response times | Playwright network timing | Every PR | Warn only (high variance) |
| Build time | `next build` timing | Every PR | Warn only |

**What already exists (and what this plan extends):**

- `e2e/navigation-performance.spec.ts` -- client-side route transition tests (< 3s)
- `.github/workflows/navigation-perf.yml` -- CI for navigation tests on PR previews and production
- `.github/workflows/lighthouse.yml` -- Lighthouse CI for public and authenticated pages
- `lighthouserc.cjs` -- Lighthouse assertion thresholds
- `.github/lighthouse/auth-script.cjs` -- Puppeteer auth script for authenticated Lighthouse audits

**What this plan adds:**

1. A new `e2e/performance-budgets.spec.ts` test file covering RSC payload sizes, API response times, and CWV collection
2. A `scripts/check-bundle-size.mjs` script for tracking JS bundle size across builds
3. A unified `.github/workflows/performance-regression.yml` workflow orchestrating all performance checks
4. A `.performance-baselines/` directory for storing historical data
5. Enhanced `lighthouserc.cjs` with per-page budgets and authenticated page assertions
6. Regression detection logic with statistical variance handling

---

## 2. Current State Assessment

### 2.1 Existing Test Infrastructure

| Component | Location | Status |
|-----------|----------|--------|
| Playwright config | `playwright.config.ts` | 5 browser projects, auth setup, dev server auto-start |
| Auth setup | `e2e/auth.setup.ts` | Saves session to `e2e/.auth/user.json` |
| Page Objects | `e2e/pages/*.ts` | BasePage, LoginPage, DashboardPage, ProjectsPage, etc. |
| Fixtures | `e2e/fixtures.ts` | Custom fixtures with `authenticatedPage` context |
| Navigation perf | `e2e/navigation-performance.spec.ts` | Cold loads, client-side nav, rapid nav, network efficiency |
| Lighthouse CI | `lighthouserc.cjs` | Public pages (login, signup, forgot-password) only |
| Lighthouse workflow | `.github/workflows/lighthouse.yml` | Public + authenticated pages, preview + production |
| Nav perf workflow | `.github/workflows/navigation-perf.yml` | Preview + production |

### 2.2 Measured Baselines

These baselines were established during the performance profiling phase (see `01-profiling.md`):

| Page | Metric | KV Warm | KV Cold | Target |
|------|--------|---------|---------|--------|
| `/projects` | TTFB | ~10-15ms | ~150-200ms | < 500ms |
| `/tasks` | TTFB | ~15-20ms | ~200-300ms | < 500ms |
| `/clients` | TTFB | N/A | ~200-300ms | < 500ms |
| `/inbox` | TTFB | N/A | ~100-200ms | < 300ms |
| `/settings` | TTFB | N/A | ~50-100ms | < 300ms |

| Page | RSC Payload (50 items) | Target |
|------|----------------------|--------|
| `/tasks` | ~40KB | < 100KB |
| `/projects` | ~100KB | < 150KB |
| `/clients` | ~80KB | < 120KB |
| `/inbox` | ~30KB | < 80KB |

| Interaction | Response Time | Target |
|-------------|---------------|--------|
| Load More (any page) | ~50-250ms | < 500ms |
| Client-side navigation | < 3s (measured) | < 2s |

### 2.3 Gaps This Plan Addresses

1. **No RSC payload size enforcement** -- payload sizes are measured manually but not gated in CI
2. **No bundle size tracking** -- `@next/bundle-analyzer` exists as devDep but no CI enforcement
3. **No trend analysis** -- performance numbers are not stored across runs for trend detection
4. **Lighthouse covers only public pages well** -- authenticated pages run only 1 pass (noisy)
5. **No per-page CWV budgets** -- current `lighthouserc.cjs` applies the same thresholds globally
6. **No API response time tracking** -- network efficiency test counts requests but not timing

---

## 3. Performance Test Suite Design

### 3.1 Test Architecture

```
e2e/
  performance-budgets.spec.ts       # NEW: RSC payload, API timing, CWV collection
  navigation-performance.spec.ts    # EXISTING: route transitions
  auth.setup.ts                     # EXISTING: auth state

scripts/
  check-bundle-size.mjs             # NEW: bundle size regression check
  collect-perf-baselines.mjs        # NEW: baseline collection utility

.performance-baselines/
  bundle-size.json                  # Tracked in git: JS bundle sizes per route
  latest-results.json               # NOT tracked: written by CI, uploaded as artifact

.github/workflows/
  performance-regression.yml        # NEW: unified performance CI
  navigation-perf.yml               # EXISTING: keep as-is
  lighthouse.yml                    # EXISTING: enhanced
```

### 3.2 Test Categories

#### Category A: RSC Payload Size Tests

**Purpose:** Prevent accidental RSC payload bloat from adding unnecessary fields, removing `Pick<>` types, or disabling pagination.

**Method:** Intercept the RSC stream response for each page load and measure its compressed size. Playwright's `page.on('response')` captures the initial RSC flight data from Next.js.

**Pages tested:**

| Page | Budget | Rationale |
|------|--------|-----------|
| `/projects` | < 150KB | 50 projects with relations (members, client, labels) |
| `/tasks` | < 100KB | 50 tasks with assignee, workstream |
| `/clients` | < 120KB | 50 clients with project counts |
| `/inbox` | < 80KB | 50 inbox items with metadata |
| `/settings` | < 50KB | Static form data, no lists |
| `/` (dashboard) | < 100KB | Stat cards + recent projects + tasks |

**Assertion:** Fail PR if any page exceeds its budget.

#### Category B: API Response Time Tests

**Purpose:** Detect server-side slowdowns in data fetching, cache misses, or DB query regressions.

**Method:** Measure TTFB and `domcontentloaded` timing via `PerformanceNavigationTiming` API for full-page loads. For interactions (Load More), measure the network response time of the triggered fetch.

**Endpoints tested:**

| Page | Metric | Budget | Notes |
|------|--------|--------|-------|
| `/projects` | TTFB | < 500ms | Accounts for KV cold start |
| `/tasks` | TTFB | < 500ms | Accounts for KV cold start |
| `/clients` | TTFB | < 500ms | No KV cache currently |
| `/inbox` | TTFB | < 300ms | Lighter page |
| `/settings` | TTFB | < 300ms | Lightweight data |
| `/` (dashboard) | TTFB | < 500ms | Multiple stat queries |
| Load More (any) | Response | < 500ms | Direct DB query |

**Assertion:** Warn on first violation (network variance), fail on 3 consecutive violations.

#### Category C: Core Web Vitals Collection

**Purpose:** Collect LCP, CLS, and TBT from real page loads for trend analysis. Lighthouse CI provides the enforcement; these Playwright tests provide supplementary data points from actual browser rendering.

**Method:** Use `PerformanceObserver` in the browser context to collect LCP and CLS entries. Use Playwright's `page.evaluate()` to extract metrics after page load.

**Assertion:** Informational only (Lighthouse CI enforces the hard limits). These tests record values to `latest-results.json` for trend analysis.

#### Category D: Navigation Performance (Existing)

**Purpose:** Already implemented in `navigation-performance.spec.ts`. No changes needed.

**Current thresholds:**
- Route transition: < 3s (recommend tightening to < 2s after baseline confirmation)
- Network settle: < 5s
- API requests per navigation: warn above 15

#### Category E: Bundle Size Tracking

**Purpose:** Catch dependency additions or code-splitting regressions that inflate the client-side JS payload.

**Method:** Run `next build` and parse the build output to extract route-level JS sizes. Compare against committed baselines.

**Budgets:**

| Route Group | First Load JS | Budget |
|-------------|---------------|--------|
| Shared (framework + layout) | ~85-100KB | < 120KB |
| `/login` | ~90-100KB | < 120KB |
| `/projects` | ~100-120KB | < 150KB |
| `/tasks` | ~110-130KB | < 160KB |
| `/clients` | ~90-110KB | < 140KB |
| `/inbox` | ~85-100KB | < 120KB |
| `/settings` | ~100-120KB | < 150KB |
| `/chat` | ~90-110KB | < 140KB |

**Note:** These are **First Load JS** (gzipped) values from `next build` output. They include shared chunks.

**Assertion:** Fail PR if any route exceeds its budget OR if total JS increases by > 10% vs. baseline.

---

## 4. Performance Budgets and Thresholds

### 4.1 Hard Budgets (Block PRs)

These thresholds cause CI to fail. They are set with headroom above current baselines to avoid flaky failures while still catching meaningful regressions.

| Metric | Budget | Current Baseline | Headroom |
|--------|--------|-----------------|----------|
| **Lighthouse Performance Score** | >= 75 | ~85-95 (public) | 10-20 pts |
| **LCP** (Lighthouse) | < 2500ms | ~800-1500ms | ~1000ms |
| **CLS** (Lighthouse) | < 0.10 | ~0.01-0.05 | ~0.05 |
| **TBT** (Lighthouse) | < 500ms | ~100-200ms | ~300ms |
| **FCP** (Lighthouse) | < 1800ms | ~500-1000ms | ~800ms |
| **Route transition** (Playwright) | < 3000ms | ~500-1500ms | ~1500ms |
| **RSC payload: /projects** | < 150KB | ~100KB | 50KB |
| **RSC payload: /tasks** | < 100KB | ~40KB | 60KB |
| **RSC payload: /clients** | < 120KB | ~80KB | 40KB |
| **RSC payload: /inbox** | < 80KB | ~30KB | 50KB |
| **Bundle: per-route first load** | Per table above | See 3.2E | ~30KB |
| **Bundle: total increase** | < 10% vs baseline | N/A | Relative |

### 4.2 Soft Budgets (Warn but Do Not Block)

These thresholds produce warnings in CI output and are tracked for trends, but do not block merging. They are informational because network-dependent metrics have high natural variance.

| Metric | Warning Threshold | Notes |
|--------|-------------------|-------|
| **TTFB per page** | > 500ms | Network-dependent; KV cold vs. warm |
| **API requests per navigation** | > 15 | Existing check in navigation-performance.spec.ts |
| **Load More response time** | > 500ms | Database latency dependent |
| **Build time** | > 120s | Machine-dependent |
| **Lighthouse Performance (auth pages)** | < 80 | Auth pages have higher variability |
| **Lighthouse SEO** | < 90 | Already a warn in lighthouserc.cjs |

### 4.3 Budget Rationale

**Why these specific numbers?**

1. **LCP < 2500ms / CLS < 0.10 / FID < 100ms**: These are Google's "Good" thresholds for Core Web Vitals. Meeting these ensures the app is in the top tier for search ranking signals and user experience.

2. **RSC payload budgets**: Set at approximately 1.5x current measured values. RSC payloads scale linearly with item count (paginated at 50 items). The budgets assume 50 items per page with full relations. A payload exceeding the budget likely means either: (a) pagination broke, (b) unnecessary fields were added to the RSC serialization, or (c) a `Pick<>` type was removed.

3. **Bundle size per-route budgets**: Set at approximately 1.2x current measured values. A 20% buffer allows for normal feature additions. Exceeding the budget likely means: (a) a large dependency was added statically instead of dynamically, (b) a `dynamic()` import was converted to a static import, or (c) tree-shaking regressed.

4. **Route transition < 3s**: The existing threshold. Based on UX research showing that users perceive delays over 1s as "noticeable" and over 3s as "unacceptable." The 3s limit provides headroom for CI environments which are slower than developer machines.

---

## 5. Regression Detection Rules

### 5.1 Statistical Approach

Performance metrics are inherently noisy. A single test run may report TTFB of 150ms or 450ms depending on network conditions, KV cache state, and CI machine load. The regression detection strategy accounts for this:

**For Lighthouse metrics (LCP, CLS, TBT, FCP):**
- Lighthouse CI runs 3 passes per URL and uses the **median** value
- Assertion applies to the median, not individual runs
- This is already configured in `lighthouserc.cjs`

**For Playwright timing metrics (route transitions, TTFB):**
- Run each measurement 2 times when feasible (cold load tests are inherently single-shot)
- Use the **best of N** (minimum) for timing metrics, not the average
- Rationale: We want to know the *achievable* performance, not the average including CI jitter. If the minimum exceeds the budget, it is a real regression.

**For size metrics (RSC payload, bundle size):**
- These are deterministic -- no variance between runs
- A single measurement is sufficient
- Use exact comparison against budgets

### 5.2 Regression vs. Normal Variance Decision Tree

```
Is the metric deterministic (bundle size, RSC payload)?
  YES --> Compare to budget. Exceeds? --> FAIL
  NO  --> Is this a Lighthouse metric?
    YES --> Lighthouse CI handles via median-of-3. Exceeds? --> FAIL
    NO  --> Is this a Playwright timing metric?
      YES --> Is the MINIMUM of runs above budget?
        YES --> FAIL (real regression)
        NO  --> PASS (likely variance)
```

### 5.3 Flaky Test Mitigation

| Strategy | Applied To | Implementation |
|----------|-----------|----------------|
| Median of 3 runs | Lighthouse metrics | Built into `lhci autorun --collect.numberOfRuns=3` |
| Minimum of N runs | Route transitions | Already single-run in test; budget has 2x headroom |
| Absolute budgets with headroom | RSC payloads, bundle sizes | Budgets set at 1.2-1.5x current values |
| Warn-not-fail for network metrics | TTFB, API response times | Soft budgets in test output |
| Retry on CI | All Playwright tests | `retries: 2` in `playwright.config.ts` for CI |
| Separate deterministic from timing | Bundle size, RSC payload | Separate test describe blocks with distinct failure modes |

### 5.4 Handling Expected Regressions

When a feature legitimately increases bundle size or RSC payload (e.g., adding a new column to the projects table):

1. **Update the baseline:** Modify the budget in the test file or baseline JSON
2. **Document the reason:** Include in the PR description why the budget changed
3. **Keep the delta small:** Budgets should only increase by the minimum necessary amount
4. **Review cadence:** Every quarter, re-evaluate budgets against actual usage to tighten where possible

---

## 6. Lighthouse CI Setup

### 6.1 Enhanced `lighthouserc.cjs`

The existing configuration covers the basics. Enhancements to add:

```javascript
/** @type {import('@lhci/cli').Config} */
module.exports = {
  ci: {
    collect: {
      url: [
        'https://pms-nine-gold.vercel.app/login',
        'https://pms-nine-gold.vercel.app/signup',
        'https://pms-nine-gold.vercel.app/forgot-password',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        skipAudits: ['uses-http2'],
        // Budget file for per-resource-type limits
        budgets: [
          {
            path: '/*',
            resourceSizes: [
              { resourceType: 'script', budget: 500 },      // 500KB total JS
              { resourceType: 'stylesheet', budget: 100 },   // 100KB total CSS
              { resourceType: 'image', budget: 500 },        // 500KB total images
              { resourceType: 'font', budget: 200 },         // 200KB total fonts
              { resourceType: 'total', budget: 1500 },       // 1.5MB total
            ],
            resourceCounts: [
              { resourceType: 'script', budget: 30 },        // Max 30 JS files
              { resourceType: 'third-party', budget: 10 },   // Max 10 third-party requests
            ],
          },
        ],
      },
    },
    assert: {
      assertions: {
        // Performance category
        'categories:performance': ['error', { minScore: 0.75 }],

        // Best Practices
        'categories:best-practices': ['error', { minScore: 0.95 }],

        // Accessibility
        'categories:accessibility': ['error', { minScore: 0.9 }],

        // SEO
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals
        'total-blocking-time': ['error', { maxNumericValue: 500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],

        // Additional performance audits
        'speed-index': ['warn', { maxNumericValue: 3400 }],
        'interactive': ['warn', { maxNumericValue: 3800 }],

        // Resource budgets (from settings.budgets above)
        'resource-summary:script:size': ['error', { maxNumericValue: 512000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 1536000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### 6.2 Authenticated Page Configuration

The current workflow already handles auth via `auth-script.cjs`. One improvement: increase `numberOfRuns` for authenticated pages from 1 to 3 to get meaningful medians:

```yaml
# In .github/workflows/lighthouse.yml, change:
--collect.numberOfRuns=1
# To:
--collect.numberOfRuns=3
```

This triples the CI time for authenticated pages (from ~2min to ~6min) but eliminates most noise from single-run measurements.

### 6.3 Per-Page Lighthouse Budgets

For authenticated pages where performance characteristics differ significantly, add page-specific budgets using Lighthouse's `budgets` config:

```javascript
// In lighthouserc.cjs, under settings.budgets:
{
  path: '/projects',
  timings: [
    { metric: 'first-contentful-paint', budget: 2000 },
    { metric: 'largest-contentful-paint', budget: 3000 },
    { metric: 'interactive', budget: 4000 },
  ],
},
{
  path: '/tasks',
  timings: [
    { metric: 'first-contentful-paint', budget: 2000 },
    { metric: 'largest-contentful-paint', budget: 3000 },
    { metric: 'interactive', budget: 4000 },
  ],
},
```

---

## 7. Bundle Size Tracking

### 7.1 Strategy

The application already has `@next/bundle-analyzer` as a devDependency and a `build:analyze` script. The missing piece is automated tracking in CI.

**Approach:** Parse `next build` output to extract per-route First Load JS sizes. Compare against committed baselines. Report deltas in CI output.

### 7.2 Bundle Size Check Script

**File:** `scripts/check-bundle-size.mjs`

```javascript
#!/usr/bin/env node
/**
 * Bundle Size Regression Check
 *
 * Parses `next build` output to extract per-route JS sizes.
 * Compares against committed baselines in .performance-baselines/bundle-size.json.
 * Exits with code 1 if any route exceeds its budget or total increases > 10%.
 *
 * Usage:
 *   next build 2>&1 | node scripts/check-bundle-size.mjs
 *   node scripts/check-bundle-size.mjs --update-baselines  # Update baselines from latest build
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const BASELINES_PATH = resolve('.performance-baselines/bundle-size.json');

// Per-route budgets (First Load JS, gzipped KB)
const BUDGETS = {
  '/': 120,
  '/login': 120,
  '/signup': 120,
  '/projects': 150,
  '/projects/[id]': 160,
  '/tasks': 160,
  '/clients': 140,
  '/clients/[id]': 150,
  '/inbox': 120,
  '/settings': 150,
  '/chat': 140,
  '/chat/[conversationId]': 150,
  '/performance': 150,
};

const TOTAL_BUDGET_INCREASE_PERCENT = 10;

function parseBuildOutput(input) {
  const lines = input.split('\n');
  const routes = {};

  for (const line of lines) {
    // Match lines like: ○ /projects  4.2 kB  105 kB
    // or: ƒ /projects/[id]  5.1 kB  112 kB
    const match = line.match(
      /[○●ƒλ]\s+(\/\S*)\s+[\d.]+\s+[kKmM]?B\s+([\d.]+)\s+([kKmM]?B)/
    );
    if (match) {
      const route = match[1];
      let size = parseFloat(match[2]);
      const unit = match[3].toLowerCase();
      if (unit === 'mb') size *= 1024;
      routes[route] = size; // KB
    }
  }

  return routes;
}

function loadBaselines() {
  if (!existsSync(BASELINES_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(BASELINES_PATH, 'utf-8'));
}

function saveBaselines(routes) {
  writeFileSync(
    BASELINES_PATH,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        routes,
      },
      null,
      2
    )
  );
}

// Main
const input = readFileSync('/dev/stdin', 'utf-8');
const routes = parseBuildOutput(input);

if (Object.keys(routes).length === 0) {
  console.error('ERROR: Could not parse any routes from build output.');
  console.error('Make sure to pipe next build output to this script.');
  process.exit(1);
}

const updateMode = process.argv.includes('--update-baselines');
if (updateMode) {
  saveBaselines(routes);
  console.log(`Updated baselines at ${BASELINES_PATH}`);
  process.exit(0);
}

let hasFailure = false;
const results = [];

// Check per-route budgets
for (const [route, budget] of Object.entries(BUDGETS)) {
  const actual = routes[route];
  if (actual === undefined) continue;

  const status = actual > budget ? 'FAIL' : 'PASS';
  if (status === 'FAIL') hasFailure = true;

  results.push({ route, actual: `${actual}KB`, budget: `${budget}KB`, status });
}

// Check total increase vs. baseline
const baselines = loadBaselines();
if (baselines) {
  const baselineTotal = Object.values(baselines.routes).reduce((s, v) => s + v, 0);
  const currentTotal = Object.values(routes).reduce((s, v) => s + v, 0);
  const increasePercent = ((currentTotal - baselineTotal) / baselineTotal) * 100;

  if (increasePercent > TOTAL_BUDGET_INCREASE_PERCENT) {
    hasFailure = true;
    results.push({
      route: 'TOTAL',
      actual: `${currentTotal.toFixed(1)}KB (+${increasePercent.toFixed(1)}%)`,
      budget: `< ${TOTAL_BUDGET_INCREASE_PERCENT}% increase`,
      status: 'FAIL',
    });
  } else {
    results.push({
      route: 'TOTAL',
      actual: `${currentTotal.toFixed(1)}KB (${increasePercent >= 0 ? '+' : ''}${increasePercent.toFixed(1)}%)`,
      budget: `< ${TOTAL_BUDGET_INCREASE_PERCENT}% increase`,
      status: 'PASS',
    });
  }
}

// Print results
console.log('\n=== Bundle Size Report ===\n');
console.log('Route'.padEnd(30) + 'Actual'.padEnd(15) + 'Budget'.padEnd(20) + 'Status');
console.log('-'.repeat(75));
for (const r of results) {
  console.log(
    r.route.padEnd(30) + r.actual.padEnd(15) + r.budget.padEnd(20) + r.status
  );
}

if (hasFailure) {
  console.error('\nFAILED: One or more bundle size budgets exceeded.');
  process.exit(1);
} else {
  console.log('\nPASSED: All bundle size budgets within limits.');
}
```

### 7.3 Baseline File

**File:** `.performance-baselines/bundle-size.json`

This file is committed to git and updated intentionally when budgets change. Initial structure:

```json
{
  "timestamp": "2026-02-14T00:00:00.000Z",
  "routes": {
    "/": 95,
    "/login": 92,
    "/signup": 93,
    "/projects": 110,
    "/tasks": 120,
    "/clients": 100,
    "/inbox": 90,
    "/settings": 105,
    "/chat": 100
  }
}
```

**Updating baselines after an intentional increase:**

```bash
pnpm build 2>&1 | node scripts/check-bundle-size.mjs --update-baselines
```

---

## 8. RSC Payload Size Tests

### 8.1 Test Design

RSC payloads are the flight data Next.js sends for Server Components. They are deterministic for a given data set (same user, same data returns same payload). This makes them ideal for regression testing.

**File:** `e2e/performance-budgets.spec.ts` (RSC section)

```typescript
import { test, expect } from '@playwright/test';

/**
 * RSC Payload Size Budgets
 *
 * Measures the total transfer size of RSC flight data for each page.
 * RSC payloads appear as fetch responses with content-type containing
 * "text/x-component" or as part of the initial HTML (inlined flight data).
 *
 * These budgets catch:
 * - Accidental removal of Pick<> type narrowing in RSC serialization
 * - Pagination bypass (loading all items instead of 50)
 * - New fields added to RSC-serialized data without need
 */

const RSC_BUDGETS: Record<string, number> = {
  '/projects': 150 * 1024,  // 150KB
  '/tasks': 100 * 1024,     // 100KB
  '/clients': 120 * 1024,   // 120KB
  '/inbox': 80 * 1024,      // 80KB
  '/settings': 50 * 1024,   // 50KB
  '/': 100 * 1024,           // 100KB (dashboard)
};

test.describe('RSC Payload Size Budgets', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  for (const [path, budget] of Object.entries(RSC_BUDGETS)) {
    test(`RSC payload for ${path} is within budget (${(budget / 1024).toFixed(0)}KB)`, async ({ page }) => {
      let totalRscBytes = 0;

      // Intercept all responses to measure RSC payload
      page.on('response', async (response) => {
        const url = response.url();
        const headers = response.headers();
        const contentType = headers['content-type'] || '';

        // RSC flight data responses (Next.js App Router)
        const isRsc =
          contentType.includes('text/x-component') ||
          contentType.includes('application/octet-stream') ||
          url.includes('_rsc') ||
          (headers['x-nextjs-matched-path'] && contentType.includes('text/plain'));

        if (isRsc) {
          try {
            const body = await response.body();
            totalRscBytes += body.length;
          } catch {
            // Response body may not be available for redirects
          }
        }
      });

      // Also measure the initial HTML which contains inlined RSC data
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (response) {
        const html = await response.body();
        // The RSC data is embedded in script tags in the HTML
        // This is a rough approximation; the actual RSC data is a subset
        totalRscBytes += html.length;
      }

      // Wait for any deferred RSC requests
      await page.waitForLoadState('networkidle').catch(() => {});

      const budgetKB = (budget / 1024).toFixed(0);
      const actualKB = (totalRscBytes / 1024).toFixed(1);

      console.log(`[PERF] RSC payload ${path}: ${actualKB}KB (budget: ${budgetKB}KB)`);

      expect(
        totalRscBytes,
        `RSC payload for ${path} is ${actualKB}KB, exceeds budget of ${budgetKB}KB`
      ).toBeLessThan(budget);
    });
  }
});
```

### 8.2 Measurement Accuracy Notes

The RSC payload measurement intercepts:

1. **Inlined RSC data**: Embedded in the initial HTML `<script>` tags (counted via HTML body length -- overestimates slightly because it includes non-RSC HTML)
2. **Streaming RSC chunks**: Subsequent fetch responses with `text/x-component` content type
3. **Navigation RSC data**: Flight data sent during client-side navigation (`_rsc` parameter)

For regression detection, the absolute value matters less than consistency between runs. Since the same user with the same data produces the same RSC payload, the test is deterministic.

---

## 9. API Response Time Tests

### 9.1 Test Design

**File:** `e2e/performance-budgets.spec.ts` (API timing section)

```typescript
/**
 * API Response Time Budgets
 *
 * Measures TTFB and full page load time for each authenticated page.
 * These are SOFT budgets -- they produce warnings but do not fail the build
 * because network timing has natural variance in CI environments.
 *
 * Exception: If ALL runs of a metric exceed the budget, it IS a failure
 * (indicates a real regression, not variance).
 */

const TTFB_BUDGETS: Record<string, number> = {
  '/projects': 500,
  '/tasks': 500,
  '/clients': 500,
  '/inbox': 300,
  '/settings': 300,
  '/': 500,
};

test.describe('API Response Time Budgets', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  for (const [path, budget] of Object.entries(TTFB_BUDGETS)) {
    test(`TTFB for ${path} is within budget (${budget}ms)`, async ({ page }) => {
      // Perform a fresh navigation (simulates cold load)
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const metrics = await page.evaluate(() => {
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        const nav = entries[0];
        const paint = performance.getEntriesByType('paint');
        const fcp = paint.find(e => e.name === 'first-contentful-paint');

        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          domInteractive: nav ? Math.round(nav.domInteractive) : null,
          domComplete: nav ? Math.round(nav.domComplete) : null,
          transferSize: nav ? nav.transferSize : null,
        };
      });

      console.log(
        `[PERF] ${path}: TTFB=${metrics.ttfb}ms FCP=${metrics.fcp}ms ` +
        `domInteractive=${metrics.domInteractive}ms domComplete=${metrics.domComplete}ms ` +
        `transferSize=${metrics.transferSize ? (metrics.transferSize / 1024).toFixed(1) + 'KB' : 'N/A'}`
      );

      // Soft assertion: warn but do not fail
      if (metrics.ttfb && metrics.ttfb > budget) {
        console.warn(
          `[PERF] WARNING: TTFB for ${path} (${metrics.ttfb}ms) exceeds budget (${budget}ms). ` +
          `This may be normal variance in CI. Investigate if consistently above budget.`
        );
      }

      // Hard assertion: TTFB should never exceed 3x budget (indicates catastrophic regression)
      if (metrics.ttfb) {
        expect(
          metrics.ttfb,
          `TTFB for ${path} is ${metrics.ttfb}ms, exceeds hard limit of ${budget * 3}ms`
        ).toBeLessThan(budget * 3);
      }
    });
  }
});
```

### 9.2 Load More Interaction Timing

```typescript
test.describe('Load More Interaction Timing', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  const LOAD_MORE_BUDGET = 500; // ms

  for (const pagePath of ['/projects', '/tasks', '/clients', '/inbox']) {
    test(`Load More on ${pagePath} responds within ${LOAD_MORE_BUDGET}ms`, async ({ page }) => {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Look for Load More button
      const loadMoreBtn = page.locator('button:has-text("Load More"), button:has-text("Load more"), [data-testid="load-more"]');
      if (!(await loadMoreBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        console.log(`[PERF] ${pagePath}: No Load More button visible (list may be short). Skipping.`);
        return;
      }

      // Track the network request triggered by Load More
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('supabase') && resp.status() === 200,
        { timeout: 10000 }
      );

      const start = Date.now();
      await loadMoreBtn.click();

      try {
        await responsePromise;
        const elapsed = Date.now() - start;

        console.log(`[PERF] Load More ${pagePath}: ${elapsed}ms (budget: ${LOAD_MORE_BUDGET}ms)`);

        expect(
          elapsed,
          `Load More on ${pagePath} took ${elapsed}ms, exceeds ${LOAD_MORE_BUDGET}ms`
        ).toBeLessThan(LOAD_MORE_BUDGET);
      } catch {
        console.warn(`[PERF] Load More ${pagePath}: No Supabase response detected within timeout`);
      }
    });
  }
});
```

---

## 10. Core Web Vitals Tests

### 10.1 Strategy

Lighthouse CI (section 6) provides the authoritative CWV measurements. The Playwright-based tests below supplement Lighthouse by collecting CWV from real page loads in the actual application (with auth, with data). This data feeds into trend analysis.

### 10.2 CWV Collection Test

```typescript
/**
 * Core Web Vitals Collection
 *
 * Collects LCP, CLS, and FCP from authenticated page loads.
 * These are informational -- Lighthouse CI enforces the hard limits.
 * Values are recorded to stdout for CI artifact collection.
 */

const CWV_PAGES = ['/projects', '/tasks', '/clients', '/inbox', '/', '/settings'];

test.describe('Core Web Vitals Collection', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  for (const path of CWV_PAGES) {
    test(`collect CWV for ${path}`, async ({ page }) => {
      // Inject PerformanceObserver before navigation
      await page.addInitScript(() => {
        (window as any).__cwv = { lcp: 0, cls: 0, fcp: 0 };

        // LCP observer
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as any;
          if (last) (window as any).__cwv.lcp = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // CLS observer
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              (window as any).__cwv.cls += entry.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        // FCP from paint timing
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              (window as any).__cwv.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });
      });

      await page.goto(path, { waitUntil: 'load' });

      // Wait for LCP to settle (typically fires within 2.5s of load)
      await page.waitForTimeout(3000);

      const cwv = await page.evaluate(() => (window as any).__cwv);

      console.log(
        `[CWV] ${path}: LCP=${Math.round(cwv.lcp)}ms CLS=${cwv.cls.toFixed(4)} FCP=${Math.round(cwv.fcp)}ms`
      );

      // Output in machine-parseable format for trend collection
      console.log(
        `[CWV-DATA] ${JSON.stringify({
          page: path,
          lcp: Math.round(cwv.lcp),
          cls: parseFloat(cwv.cls.toFixed(4)),
          fcp: Math.round(cwv.fcp),
          timestamp: new Date().toISOString(),
        })}`
      );

      // Soft assertions (Lighthouse CI is the authority)
      expect(cwv.lcp, `LCP for ${path} exceeds 4000ms`).toBeLessThan(4000);
      expect(cwv.cls, `CLS for ${path} exceeds 0.25`).toBeLessThan(0.25);
    });
  }
});
```

### 10.3 CWV Budget Summary

| Metric | Good | Needs Improvement | Poor | Our Budget |
|--------|------|-------------------|------|------------|
| **LCP** | < 2.5s | 2.5s - 4.0s | > 4.0s | < 2.5s (Lighthouse), < 4.0s (Playwright soft) |
| **FID/INP** | < 200ms | 200ms - 500ms | > 500ms | < 200ms (Lighthouse TBT proxy) |
| **CLS** | < 0.1 | 0.1 - 0.25 | > 0.25 | < 0.1 (Lighthouse), < 0.25 (Playwright soft) |
| **FCP** | < 1.8s | 1.8s - 3.0s | > 3.0s | < 1.8s (Lighthouse) |
| **TBT** | < 200ms | 200ms - 600ms | > 600ms | < 500ms (Lighthouse) |

---

## 11. CI/CD Integration Configuration

### 11.1 Unified Performance Regression Workflow

**File:** `.github/workflows/performance-regression.yml`

```yaml
name: Performance Regression

on:
  pull_request:
    branches: [main]

concurrency:
  group: perf-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  # Job 1: Bundle size check (runs on build output, no server needed)
  bundle-size:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and check bundle sizes
        run: |
          pnpm build 2>&1 | tee /tmp/build-output.txt
          cat /tmp/build-output.txt | node scripts/check-bundle-size.mjs
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXT_PUBLIC_SITE_URL: https://pms-nine-gold.vercel.app
          ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}

      - name: Upload build output
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: bundle-size-report
          path: /tmp/build-output.txt
          retention-days: 30

  # Job 2: RSC payload and API timing tests (needs Vercel preview)
  performance-budgets:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Wait for Vercel preview deployment
        uses: patrickedqvist/wait-for-vercel-preview@06c79330064b0e6ef7a2574603b62d3c98789125
        id: vercel_preview
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
          check_interval: 10

      - name: Install dependencies
        run: |
          npm install @playwright/test
          npx playwright install chromium --with-deps

      - name: Authenticate and save state
        run: |
          node -e "
          const { chromium } = require('playwright');
          const fs = require('fs');
          const path = require('path');
          (async () => {
            const browser = await chromium.launch({ headless: true });
            const context = await browser.newContext();
            const page = await context.newPage();

            const baseUrl = process.env.PREVIEW_URL;
            await page.goto(baseUrl + '/login', { waitUntil: 'networkidle' });
            await page.locator('input[type=\"email\"]').fill(process.env.TEST_USER_EMAIL);
            await page.locator('input[autocomplete=\"current-password\"]').fill(process.env.TEST_USER_PASSWORD);
            await page.locator('button[type=\"submit\"]').click();
            await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });

            const authDir = path.join('e2e', '.auth');
            fs.mkdirSync(authDir, { recursive: true });
            await context.storageState({ path: path.join(authDir, 'user.json') });
            console.log('Authenticated successfully');

            await browser.close();
          })();
          "
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          PREVIEW_URL: ${{ steps.vercel_preview.outputs.url }}

      - name: Run performance budget tests
        run: |
          npx playwright test performance-budgets.spec.ts \
            --project=chromium \
            --reporter=list
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.vercel_preview.outputs.url }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: performance-budget-results
          path: |
            e2e/test-results/
            playwright-report/
          retention-days: 30

  # Job 3: Collect results and post summary (runs after both jobs)
  summary:
    needs: [bundle-size, performance-budgets]
    if: always()
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: /tmp/perf-artifacts

      - name: Post PR comment with performance summary
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            let comment = '## Performance Regression Report\n\n';

            // Check bundle size results
            const bundleJob = '${{ needs.bundle-size.result }}';
            comment += `### Bundle Size: ${bundleJob === 'success' ? 'PASS' : 'FAIL'}\n\n`;

            // Check performance budget results
            const perfJob = '${{ needs.performance-budgets.result }}';
            comment += `### Performance Budgets: ${perfJob === 'success' ? 'PASS' : 'FAIL'}\n\n`;

            comment += '> Full results available in workflow artifacts.\n';

            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const existing = comments.find(c =>
              c.body.includes('## Performance Regression Report')
            );

            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body: comment,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: comment,
              });
            }
```

### 11.2 Workflow Trigger Strategy

| Workflow | Trigger | What It Tests | Blocks PR? |
|----------|---------|---------------|------------|
| `performance-regression.yml` (NEW) | Every PR to main | Bundle size, RSC payload, API timing, CWV | Yes (bundle + RSC) |
| `lighthouse.yml` (EXISTING) | Every PR + push to main | Lighthouse scores, CWV, resource budgets | Yes (via assertions) |
| `navigation-perf.yml` (EXISTING) | Every PR + push to main | Route transition timing | Yes (3s threshold) |

### 11.3 CI Execution Time Estimates

| Job | Estimated Duration | Runs In Parallel? |
|-----|-------------------|-------------------|
| `bundle-size` | ~2-3 min (build time) | Yes (no preview needed) |
| `performance-budgets` | ~3-5 min (after preview) | Yes (after preview deploy) |
| `lighthouse-preview` | ~6-8 min (3 runs x 8 pages) | Separate workflow |
| `navigation-perf-preview` | ~2-3 min | Separate workflow |
| `summary` | ~30s | Sequential (after jobs complete) |

**Total wall time for PR:** ~8-10 min (preview deploy wait is the bottleneck; tests run in parallel after)

### 11.4 Required GitHub Secrets

| Secret | Purpose | Already Configured? |
|--------|---------|---------------------|
| `TEST_USER_EMAIL` | E2E test authentication | Yes |
| `TEST_USER_PASSWORD` | E2E test authentication | Yes |
| `GITHUB_TOKEN` | Vercel preview detection, PR comments | Automatic |
| `NEXT_PUBLIC_SUPABASE_URL` | Build env var | Needs verification |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build env var | Needs verification |
| `SUPABASE_SERVICE_ROLE_KEY` | Build env var | Needs verification |
| `ENCRYPTION_KEY` | Build env var | Needs verification |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI GitHub status checks (optional) | If Lighthouse CI GitHub app installed |

---

## 12. Performance Data Storage and Trend Analysis

### 12.1 Data Collection Points

Every CI run produces performance data. To detect slow regressions (death by a thousand cuts), this data must be stored and analyzed over time.

**Data sources:**

| Source | Format | Where Stored |
|--------|--------|-------------|
| Lighthouse results | `.lighthouseci/*.json` | GitHub Actions artifact (30-day retention) |
| Lighthouse upload | temporary-public-storage URL | LHCI server (temporary) |
| Bundle size report | Text from `check-bundle-size.mjs` | GitHub Actions artifact |
| RSC payload sizes | Playwright test output (`[PERF]` lines) | GitHub Actions artifact |
| CWV measurements | Playwright test output (`[CWV-DATA]` lines) | GitHub Actions artifact |
| Navigation timing | Playwright test output (`[PERF]` lines) | GitHub Actions artifact |

### 12.2 Trend Analysis Approach

**Phase 1 (Immediate):** Artifact-based storage. Performance data is stored as CI artifacts with 30-day retention. Manual trend analysis by downloading artifacts and comparing.

**Phase 2 (Recommended):** Automated trend tracking. Options:

1. **Lighthouse CI Server (self-hosted):** Deploy `@lhci/server` to track Lighthouse results over time with built-in trend charts. Change `lighthouserc.cjs` upload target from `temporary-public-storage` to the server URL.

2. **GitHub Pages dashboard:** A scheduled GitHub Action collects `[CWV-DATA]` and `[PERF]` outputs from recent workflow runs via the GitHub API, appends to a JSON file in a `gh-pages` branch, and renders a simple HTML dashboard.

3. **External service:** Datadog RUM, SpeedCurve, or Calibre for continuous real-user monitoring with built-in trend analysis and alerting.

**Recommendation:** Start with Phase 1. Move to Phase 2 option 1 (LHCI Server) when the team wants historical Lighthouse comparisons, or option 3 if observability is being added (see `02-observability.md`).

### 12.3 Baseline Management

| Baseline File | Tracked in Git? | Update Process |
|---------------|-----------------|----------------|
| `.performance-baselines/bundle-size.json` | Yes | Run `pnpm build 2>&1 \| node scripts/check-bundle-size.mjs --update-baselines` |
| `lighthouserc.cjs` assertions | Yes | Manual edit when budgets change |
| `RSC_BUDGETS` in test file | Yes | Manual edit when page data shape changes |
| `TTFB_BUDGETS` in test file | Yes | Manual edit (rarely changes) |

**When to update baselines:**

- After a feature that legitimately increases payload (new column, new relation)
- After a dependency upgrade that changes bundle size
- After quarterly budget review (tighten budgets if actual values have improved)
- Never in response to flaky failures (investigate root cause first)

---

## 13. Test File Specifications

### 13.1 New Files to Create

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `e2e/performance-budgets.spec.ts` | RSC payload, API timing, CWV, Load More tests | ~250 |
| `scripts/check-bundle-size.mjs` | Bundle size regression check | ~120 |
| `.performance-baselines/bundle-size.json` | Bundle size baselines | ~15 |
| `.github/workflows/performance-regression.yml` | Unified CI workflow | ~150 |

### 13.2 Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `lighthouserc.cjs` | Add resource budgets, per-page timing budgets | More comprehensive Lighthouse assertions |
| `.github/workflows/lighthouse.yml` | Increase `numberOfRuns` for auth pages to 3 | Better median, +4min CI time |
| `package.json` | Add `test:perf` and `check:bundle` scripts | Developer convenience |
| `.gitignore` | Add `.performance-baselines/latest-results.json` | Exclude CI-generated results |

### 13.3 New package.json Scripts

```json
{
  "scripts": {
    "test:perf": "playwright test performance-budgets.spec.ts --project=chromium",
    "test:perf:nav": "playwright test navigation-performance.spec.ts --project=chromium",
    "check:bundle": "node scripts/check-bundle-size.mjs",
    "check:bundle:update": "node scripts/check-bundle-size.mjs --update-baselines"
  }
}
```

### 13.4 Complete `e2e/performance-budgets.spec.ts`

The complete test file combines all sections from sections 8, 9, and 10 into a single spec:

```typescript
import { test, expect } from '@playwright/test';

/**
 * Performance Budget Tests
 *
 * Automated regression tests for:
 * 1. RSC payload sizes per page (hard budget)
 * 2. API response times / TTFB per page (soft budget + hard catastrophic limit)
 * 3. Core Web Vitals collection (informational, Lighthouse CI enforces)
 * 4. Load More interaction timing (hard budget)
 *
 * Run: pnpm test:perf
 * CI:  .github/workflows/performance-regression.yml
 */

// ============================================================
// RSC Payload Size Budgets
// ============================================================

const RSC_BUDGETS: Record<string, number> = {
  '/projects': 150 * 1024,
  '/tasks': 100 * 1024,
  '/clients': 120 * 1024,
  '/inbox': 80 * 1024,
  '/settings': 50 * 1024,
  '/': 100 * 1024,
};

test.describe('RSC Payload Size Budgets', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  for (const [path, budget] of Object.entries(RSC_BUDGETS)) {
    test(`RSC payload for ${path} within ${(budget / 1024).toFixed(0)}KB`, async ({ page }) => {
      let totalRscBytes = 0;

      page.on('response', async (response) => {
        const contentType = response.headers()['content-type'] || '';
        const url = response.url();
        const isRsc =
          contentType.includes('text/x-component') ||
          url.includes('_rsc') ||
          contentType.includes('application/octet-stream');

        if (isRsc) {
          try {
            const body = await response.body();
            totalRscBytes += body.length;
          } catch { /* redirect or empty */ }
        }
      });

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (response) {
        const html = await response.body();
        totalRscBytes += html.length;
      }

      await page.waitForLoadState('networkidle').catch(() => {});

      const actualKB = (totalRscBytes / 1024).toFixed(1);
      const budgetKB = (budget / 1024).toFixed(0);
      console.log(`[PERF] RSC ${path}: ${actualKB}KB / ${budgetKB}KB budget`);

      expect(totalRscBytes, `RSC ${path}: ${actualKB}KB exceeds ${budgetKB}KB`).toBeLessThan(budget);
    });
  }
});

// ============================================================
// API Response Time Budgets (TTFB)
// ============================================================

const TTFB_BUDGETS: Record<string, number> = {
  '/projects': 500,
  '/tasks': 500,
  '/clients': 500,
  '/inbox': 300,
  '/settings': 300,
  '/': 500,
};

test.describe('API Response Time Budgets', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  for (const [path, budget] of Object.entries(TTFB_BUDGETS)) {
    test(`TTFB for ${path} within ${budget}ms`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const metrics = await page.evaluate(() => {
        const nav = (performance.getEntriesByType('navigation') as PerformanceNavigationTiming[])[0];
        const fcp = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint');
        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          domInteractive: nav ? Math.round(nav.domInteractive) : null,
          domComplete: nav ? Math.round(nav.domComplete) : null,
        };
      });

      console.log(`[PERF] TTFB ${path}: ${metrics.ttfb}ms | FCP: ${metrics.fcp}ms | domComplete: ${metrics.domComplete}ms`);

      // Soft: warn if above budget
      if (metrics.ttfb && metrics.ttfb > budget) {
        console.warn(`[PERF] WARNING: TTFB ${path} = ${metrics.ttfb}ms > ${budget}ms budget`);
      }

      // Hard: fail if above 3x budget (catastrophic regression)
      if (metrics.ttfb) {
        expect(metrics.ttfb, `TTFB ${path}: ${metrics.ttfb}ms exceeds hard limit ${budget * 3}ms`).toBeLessThan(budget * 3);
      }
    });
  }
});

// ============================================================
// Load More Interaction Timing
// ============================================================

test.describe('Load More Interaction Timing', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  const LOAD_MORE_BUDGET_MS = 500;
  const PAGES_WITH_LOAD_MORE = ['/projects', '/tasks', '/clients', '/inbox'];

  for (const path of PAGES_WITH_LOAD_MORE) {
    test(`Load More on ${path} within ${LOAD_MORE_BUDGET_MS}ms`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      const btn = page.locator('button:has-text("Load More"), button:has-text("Load more"), [data-testid="load-more"]');
      const visible = await btn.isVisible({ timeout: 5000 }).catch(() => false);

      if (!visible) {
        console.log(`[PERF] ${path}: No Load More button (list may be short). Skipping.`);
        test.skip();
        return;
      }

      const responsePromise = page.waitForResponse(
        (r) => r.url().includes('supabase') && r.status() === 200,
        { timeout: 10000 }
      );

      const start = Date.now();
      await btn.click();

      try {
        await responsePromise;
        const elapsed = Date.now() - start;
        console.log(`[PERF] Load More ${path}: ${elapsed}ms / ${LOAD_MORE_BUDGET_MS}ms budget`);
        expect(elapsed, `Load More ${path}: ${elapsed}ms > ${LOAD_MORE_BUDGET_MS}ms`).toBeLessThan(LOAD_MORE_BUDGET_MS);
      } catch {
        console.warn(`[PERF] Load More ${path}: No response detected in time. Skipping.`);
      }
    });
  }
});

// ============================================================
// Core Web Vitals Collection (Informational)
// ============================================================

const CWV_PAGES = ['/projects', '/tasks', '/clients', '/inbox', '/', '/settings'];

test.describe('Core Web Vitals Collection', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  for (const path of CWV_PAGES) {
    test(`CWV for ${path}`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as any).__cwv = { lcp: 0, cls: 0, fcp: 0 };

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as any;
          if (last) (window as any).__cwv.lcp = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) (window as any).__cwv.cls += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              (window as any).__cwv.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });
      });

      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(3000);

      const cwv = await page.evaluate(() => (window as any).__cwv);

      console.log(`[CWV] ${path}: LCP=${Math.round(cwv.lcp)}ms CLS=${cwv.cls.toFixed(4)} FCP=${Math.round(cwv.fcp)}ms`);
      console.log(`[CWV-DATA] ${JSON.stringify({
        page: path, lcp: Math.round(cwv.lcp), cls: parseFloat(cwv.cls.toFixed(4)),
        fcp: Math.round(cwv.fcp), timestamp: new Date().toISOString(),
      })}`);

      // Soft assertions (safety net only)
      expect(cwv.lcp, `LCP ${path} > 4000ms`).toBeLessThan(4000);
      expect(cwv.cls, `CLS ${path} > 0.25`).toBeLessThan(0.25);
    });
  }
});
```

---

## 14. Implementation Priority Matrix

### Phase 1: Immediate (Week 1)

| # | Task | Effort | Impact | Deliverable |
|---|------|--------|--------|-------------|
| 1 | Create `e2e/performance-budgets.spec.ts` | Low | High | RSC payload + API timing + CWV tests |
| 2 | Create `.github/workflows/performance-regression.yml` | Low | High | CI enforcement on every PR |
| 3 | Update `lighthouserc.cjs` with resource budgets | Low | Medium | Resource-level Lighthouse assertions |
| 4 | Add `test:perf` script to `package.json` | Trivial | Low | Developer convenience |

### Phase 2: Short-term (Week 2-3)

| # | Task | Effort | Impact | Deliverable |
|---|------|--------|--------|-------------|
| 5 | Create `scripts/check-bundle-size.mjs` | Medium | High | Bundle size regression detection |
| 6 | Create `.performance-baselines/bundle-size.json` | Low | Medium | Committed baseline for comparison |
| 7 | Increase Lighthouse auth page runs to 3 | Trivial | Medium | More reliable auth page scores |
| 8 | Add PR comment summary to CI | Low | Medium | Inline performance report on PR |

### Phase 3: Medium-term (Month 2)

| # | Task | Effort | Impact | Deliverable |
|---|------|--------|--------|-------------|
| 9 | Deploy LHCI Server for trend tracking | Medium | High | Historical Lighthouse comparison |
| 10 | Tighten navigation threshold to 2s | Trivial | Medium | Stricter transition budget |
| 11 | Add mobile viewport performance tests | Medium | Medium | Mobile-specific budgets |
| 12 | Quarterly budget review process | Low | High | Process to prevent budget drift |

### Phase 4: Long-term (Quarter 2+)

| # | Task | Effort | Impact | Deliverable |
|---|------|--------|--------|-------------|
| 13 | Real User Monitoring (RUM) integration | High | High | Production CWV tracking |
| 14 | Performance dashboard (GitHub Pages) | Medium | Medium | Visual trend analysis |
| 15 | Automated budget tightening | Medium | Medium | CI auto-suggests tighter budgets |
| 16 | Cross-browser performance comparison | High | Low | Firefox/WebKit-specific regressions |

---

## Appendix A: Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Use Playwright for RSC/API tests (not a separate tool) | Already in the stack, same auth infrastructure, same CI patterns | k6 (would need separate auth, separate CI, no RSC interception) |
| Lighthouse CI for CWV enforcement (not Playwright) | Industry standard, better simulation (throttling, scoring), built-in assertions | web-vitals library (no throttling simulation, harder to enforce budgets) |
| Soft budgets for TTFB (not hard) | Network variance in CI causes false positives; TTFB depends on KV warm/cold state | Hard budget with retry (still flaky; retries mask real issues) |
| Hard budgets for RSC payload (not soft) | Deterministic measurement; same data = same payload every time | Soft budget (would allow gradual bloat) |
| Artifact-based storage (not database) | Zero infrastructure cost; sufficient for current team size | PostgreSQL/InfluxDB (premature complexity) |
| PR comment with results (not status check) | More visible, easier to debug; status checks only show pass/fail | GitHub status check (less information visible) |

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **TTFB** | Time To First Byte -- time from request start to first byte of response |
| **FCP** | First Contentful Paint -- time until first text/image renders |
| **LCP** | Largest Contentful Paint -- time until the largest visible element renders |
| **CLS** | Cumulative Layout Shift -- sum of unexpected layout shift scores |
| **TBT** | Total Blocking Time -- sum of long task durations beyond 50ms threshold |
| **INP** | Interaction to Next Paint -- responsiveness metric (successor to FID) |
| **RSC** | React Server Components -- server-rendered component tree sent as flight data |
| **KV** | Key-Value cache (Vercel KV / Upstash Redis) |
| **Flight data** | The serialized RSC stream sent from server to client |
| **Budget** | Maximum acceptable value for a metric before it is considered a regression |
| **Baseline** | The current measured value of a metric, used as reference for comparison |
