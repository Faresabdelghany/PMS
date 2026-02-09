Run a full performance audit on the PMS application.

Target: $ARGUMENTS (defaults to "full" — options: full, lighthouse, bundle, vitals)

## Steps

### 1. Lighthouse CI (if target is "full" or "lighthouse")

Run Lighthouse against production pages:

```
npx lhci autorun 2>&1
```

If that fails on Windows, fall back to running lighthouse directly:

```
npx lighthouse https://pms-nine-gold.vercel.app/login --output=json --output-path=.lighthouseci/login.json --preset=desktop --chrome-flags="--headless=new" 2>&1
npx lighthouse https://pms-nine-gold.vercel.app/signup --output=json --output-path=.lighthouseci/signup.json --preset=desktop --chrome-flags="--headless=new" 2>&1
```

Parse the JSON results and extract: Performance, Accessibility, Best Practices, SEO scores, FCP, LCP, TBT, CLS, Speed Index.

### 2. Bundle Analysis (if target is "full" or "bundle")

Run production build and report First Load JS sizes per route:

```
powershell -ExecutionPolicy Bypass -Command "npm run build 2>&1"
```

Report the largest bundles and total First Load JS.

### 3. Vercel Speed Insights (if target is "full" or "vitals")

Confirm `@vercel/speed-insights` is in dependencies, then remind the user to check real user metrics at:
https://vercel.com/faresabdelghany/pms-nine-gold/speed-insights

### 4. Summary

Present a results table:

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

Flag regressions and suggest fixes for any failing metrics.
