---
name: perf
description: Run a full performance audit on the PMS application. Use when asked to "test speed", "check performance", "run lighthouse", "audit performance", or "speed test".
argument-hint: [target]
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, WebFetch, Task
---

# Performance Audit Skill

Run a comprehensive performance audit on the PMS application. Target: $ARGUMENTS (defaults to "full" if not specified).

## Targets

- `full` (default) — Run everything below
- `lighthouse` — Lighthouse CI only (production URLs)
- `bundle` — Bundle size analysis only
- `vitals` — Core Web Vitals check via Vercel Speed Insights

## Workflow

### 1. Lighthouse CI Audit

Run Lighthouse against production `/login` and `/signup` pages:

```bash
npx lhci autorun 2>&1
```

If LHCI fails on Windows due to Chrome cleanup errors, fall back to:

```bash
npx lighthouse https://pms-nine-gold.vercel.app/login --output=json --output-path=.lighthouseci/login.json --preset=desktop --chrome-flags="--headless=new" 2>&1
npx lighthouse https://pms-nine-gold.vercel.app/signup --output=json --output-path=.lighthouseci/signup.json --preset=desktop --chrome-flags="--headless=new" 2>&1
```

Extract and report these scores from the JSON:
- Performance score (target: >= 85%)
- Accessibility score (target: >= 90%)
- Best Practices score (target: >= 95%)
- SEO score
- First Contentful Paint (target: < 1.8s)
- Largest Contentful Paint (target: < 2.5s)
- Total Blocking Time (target: < 500ms)
- Cumulative Layout Shift (target: < 0.1)
- Speed Index

### 2. Bundle Size Analysis

Run the Next.js build with bundle analyzer:

```bash
# On Windows use PowerShell
powershell -ExecutionPolicy Bypass -Command "$env:ANALYZE='true'; npm run build 2>&1"
```

Report:
- Total JS bundle size (First Load JS)
- Largest page bundles
- Compare against previous build if `.next/analyze/` exists

### 3. Core Web Vitals (Vercel Speed Insights)

Check if Vercel Analytics and Speed Insights are active:
- Verify `@vercel/analytics` and `@vercel/speed-insights` are in dependencies
- Remind user to check https://vercel.com/faresabdelghany/pms-nine-gold/speed-insights for real user metrics (RUM)

### 4. Summary Report

Present results as a table:

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Performance | XX% | >= 85% | PASS/FAIL |
| Accessibility | XX% | >= 90% | PASS/FAIL |
| Best Practices | XX% | >= 95% | PASS/FAIL |
| FCP | X.Xs | < 1.8s | PASS/FAIL |
| LCP | X.Xs | < 2.5s | PASS/FAIL |
| TBT | Xms | < 500ms | PASS/FAIL |
| CLS | X.XX | < 0.1 | PASS/FAIL |
| First Load JS | XXkB | < 200kB | PASS/FAIL |

Flag any regressions or failures. Suggest specific fixes for any failing metrics.
