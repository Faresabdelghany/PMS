/**
 * Lighthouse CI configuration with performance budgets.
 *
 * Assertions define minimum scores and CWV thresholds.
 * "warn" = report but don't fail; "error" = fail the CI check.
 *
 * These budgets are intentionally lenient for an auth-protected SPA:
 * - Performance 40+ (auth pages have inherent overhead)
 * - LCP < 4s (includes SSR + data fetch time)
 * - CLS < 0.25 (allows some layout shift from lazy content)
 * - TBT < 600ms (Tiptap + Recharts add JS weight)
 */
module.exports = {
  ci: {
    assert: {
      preset: "lighthouse:no-pwa",
      assertions: {
        // Core Web Vitals — error on regression
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.25 }],
        "total-blocking-time": ["warn", { maxNumericValue: 600 }],

        // Lighthouse category scores (0-1 scale) — warn on drops
        "categories:performance": ["warn", { minScore: 0.4 }],
        "categories:accessibility": ["warn", { minScore: 0.8 }],
        "categories:best-practices": ["warn", { minScore: 0.8 }],
        "categories:seo": ["warn", { minScore: 0.7 }],

        // Resource size budgets (bytes)
        "resource-summary:script:size": ["warn", { maxNumericValue: 500000 }],
        "resource-summary:total:size": ["warn", { maxNumericValue: 2000000 }],

        // Disable assertions that don't apply to auth-protected SPAs
        "is-on-https": "off",
        "redirects-http": "off",
        "service-worker": "off",
        "works-offline": "off",
        "installable-manifest": "off",
        "splash-screen": "off",
        "themed-omnibox": "off",
        "maskable-icon": "off",
        "content-width": "off",
        "viewport": "off",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
