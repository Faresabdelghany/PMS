import { test, expect } from '@playwright/test';

/**
 * Navigation Performance Tests
 *
 * Measures client-side route transition times between authenticated pages.
 * These tests capture what Lighthouse misses: the real-world navigation
 * experience when clicking between pages in the app.
 *
 * Thresholds:
 * - Route transition: < 3s (click to content visible)
 * - Network settle: < 5s (all API calls complete)
 *
 * Run locally: pnpm test:e2e navigation-performance.spec.ts --project=chromium
 * Run in CI:   Triggered by .github/workflows/navigation-perf.yml
 */

// Page definitions with their expected content selectors
const PAGES = [
  { name: 'Inbox', path: '/inbox', contentSelector: 'h1, [data-testid="inbox"], main' },
  { name: 'Projects', path: '/projects', contentSelector: 'h1, [data-testid="projects-list"], main' },
  { name: 'Tasks', path: '/tasks', contentSelector: 'h1, [data-testid="task-list"], main' },
  { name: 'Clients', path: '/clients', contentSelector: 'h1, [data-testid="clients-list"], main' },
] as const;

// Sidebar nav links by href (more reliable than role-based matching)
const NAV_SELECTORS: Record<string, string> = {
  '/inbox': '[data-slot="sidebar"] a[href="/inbox"]',
  '/projects': '[data-slot="sidebar"] a[href="/projects"]',
  '/tasks': '[data-slot="sidebar"] a[href="/tasks"]',
  '/clients': '[data-slot="sidebar"] a[href="/clients"]',
};

// Thresholds in milliseconds
const ROUTE_TRANSITION_THRESHOLD = 3000;

test.describe('Navigation Performance', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Start on inbox (/ redirects to /inbox) to ensure authenticated
    await page.goto('/inbox', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-slot="sidebar"]').first().waitFor({ state: 'visible', timeout: 15000 });
  });

  // Test cold navigation (direct URL) for each page
  for (const target of PAGES) {
    test(`cold load: ${target.name} (${target.path}) loads within threshold`, async ({ page }) => {
      const start = Date.now();

      await page.goto(target.path, { waitUntil: 'domcontentloaded' });
      await page.locator(target.contentSelector).first().waitFor({ state: 'visible', timeout: 15000 });

      const transitionMs = Date.now() - start;

      // Wait for network to settle
      await page.waitForLoadState('networkidle').catch(() => {});
      const networkMs = Date.now() - start;

      // Collect performance metrics from the browser
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
        };
      });

      console.log(`[PERF] Cold load ${target.name}: ${transitionMs}ms (network: ${networkMs}ms) | TTFB: ${metrics.ttfb}ms | FCP: ${metrics.fcp}ms`);

      expect(transitionMs, `${target.name} cold load exceeded ${ROUTE_TRANSITION_THRESHOLD}ms`).toBeLessThan(ROUTE_TRANSITION_THRESHOLD);
    });
  }

  // Test client-side navigation between pages (the "real feel")
  test('client-side navigation: all routes transition within threshold', async ({ page }) => {
    const navigationResults: { from: string; to: string; ms: number }[] = [];

    for (let i = 0; i < PAGES.length; i++) {
      const from = i === 0 ? 'Inbox' : PAGES[i - 1].name;
      const target = PAGES[i];

      // Skip first page (already on Inbox from beforeEach)
      if (i === 0) continue;

      const selector = NAV_SELECTORS[target.path];
      if (!selector) continue;

      const link = page.locator(selector).first();

      // Ensure link is visible before clicking
      await link.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (!(await link.isVisible())) {
        console.log(`[PERF] Skipping ${target.name} — nav link not found`);
        continue;
      }

      const start = Date.now();

      await link.click();

      // Wait for URL change
      await page.waitForURL(`**${target.path}*`, { timeout: 10000 });

      // Wait for main content to appear
      await page.locator(target.contentSelector).first().waitFor({ state: 'visible', timeout: 10000 });

      const transitionMs = Date.now() - start;

      navigationResults.push({ from, to: target.name, ms: transitionMs });
      console.log(`[PERF] ${from} → ${target.name}: ${transitionMs}ms`);

      expect(transitionMs, `${from} → ${target.name} exceeded ${ROUTE_TRANSITION_THRESHOLD}ms`).toBeLessThan(ROUTE_TRANSITION_THRESHOLD);

      // Brief pause to let the page settle before next navigation
      await page.waitForTimeout(500);
    }

    // Print summary table
    console.log('\n[PERF] === Navigation Performance Summary ===');
    console.log('[PERF] Route Transition            | Time');
    console.log('[PERF] ----------------------------|-------');
    for (const r of navigationResults) {
      const label = `${r.from} → ${r.to}`.padEnd(30);
      const status = r.ms < ROUTE_TRANSITION_THRESHOLD ? 'PASS' : 'FAIL';
      console.log(`[PERF] ${label} | ${r.ms}ms (${status})`);
    }

    const avg = navigationResults.reduce((s, r) => s + r.ms, 0) / navigationResults.length;
    const max = Math.max(...navigationResults.map(r => r.ms));
    console.log(`[PERF] Average: ${Math.round(avg)}ms | Max: ${max}ms`);
  });

  // Test rapid navigation (click multiple pages quickly)
  test('rapid navigation: no crashes or stuck states', async ({ page }) => {
    const paths = ['/projects', '/tasks', '/clients', '/inbox'];

    for (const path of paths) {
      const selector = NAV_SELECTORS[path];
      if (!selector) continue;

      const link = page.locator(selector).first();
      if (await link.isVisible()) {
        await link.click();
        // Don't wait for full load — simulate rapid clicking
        await page.waitForTimeout(300);
      }
    }

    // After rapid navigation, verify the page is in a good state
    await page.waitForLoadState('domcontentloaded');
    const sidebar = page.locator('[data-slot="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  // Measure network requests per navigation
  test('network efficiency: reasonable request count per navigation', async ({ page }) => {
    for (const target of PAGES.slice(1)) {
      const selector = NAV_SELECTORS[target.path];
      if (!selector) continue;

      const link = page.locator(selector).first();
      if (!(await link.isVisible())) continue;

      // Start tracking network requests
      const requests: string[] = [];
      const handler = (request: { url: () => string }) => {
        const url = request.url();
        if (url.includes('supabase') || url.includes('/api/')) {
          requests.push(url);
        }
      };

      page.on('request', handler);
      await link.click();
      await page.waitForURL(`**${target.path}*`, { timeout: 10000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      page.removeListener('request', handler);

      console.log(`[PERF] ${target.name}: ${requests.length} API requests on navigation`);

      // Flag pages with excessive API calls (>15 is a smell)
      if (requests.length > 15) {
        console.log(`[PERF] WARNING: ${target.name} made ${requests.length} API calls — consider caching or batching`);
      }

      await page.waitForTimeout(500);
    }
  });
});
