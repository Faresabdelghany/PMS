#!/usr/bin/env node
// Comprehensive Performance Audit — tests ALL pages (public + authenticated)
// Usage: node --env-file=.env.local scripts/perf-audit.mjs [full|pages|interactions|lighthouse]

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// --- Config ---
const BASE = process.env.BASE_URL || 'https://pms-nine-gold.vercel.app';
const EMAIL = process.env.TEST_USER_EMAIL;
const PASS = process.env.TEST_USER_PASSWORD;
const OUT_DIR = '.lighthouseci';
const OUT_FILE = path.join(OUT_DIR, 'perf-audit-results.json');
const SETTLE = 3000; // ms to wait after load for LCP/CLS to finalize
const TARGET = process.argv[2] || 'full';

if (!EMAIL || !PASS) {
  console.error('ERROR: Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local');
  process.exit(1);
}

// --- Test Data Check ---
// Verifies that test data (projects, clients, tasks) exists for detail page tests.
// If missing, logs a warning so the user knows to create data in the app.
async function checkTestData(page) {
  // Check projects
  await page.goto(BASE + '/projects', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  const hasProjects = await page.$('[role="button"].rounded-2xl, [role="button"][tabindex="0"]');
  console.log(hasProjects ? '  Projects: found' : '  Projects: NONE — create a project for full coverage');

  // Check clients
  await page.goto(BASE + '/clients', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  const hasClients = await page.$('button[aria-label*="Actions for"]');
  console.log(hasClients ? '  Clients: found' : '  Clients: NONE — create a client for full coverage');

  console.log('');
}

// Perf observer — injected before every page load
const INIT_SCRIPT = `
window.__perf = { lcp: 0, cls: 0, lcpTag: '' };
new PerformanceObserver(l => {
  for (const e of l.getEntries()) {
    window.__perf.lcp = e.startTime;
    window.__perf.lcpTag = e.element?.tagName || '';
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver(l => {
  for (const e of l.getEntries()) {
    if (!e.hadRecentInput) window.__perf.cls += e.value;
  }
}).observe({ type: 'layout-shift', buffered: true });
`;

// --- Pages ---
const PUBLIC_PAGES = [
  { name: 'Login', path: '/login' },
  { name: 'Signup', path: '/signup' },
  { name: 'Forgot Password', path: '/forgot-password' },
];

const AUTH_PAGES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Projects', path: '/projects' },
  { name: 'Tasks', path: '/tasks' },
  { name: 'Clients', path: '/clients' },
  { name: 'Inbox', path: '/inbox' },
  { name: 'Chat', path: '/chat' },
  { name: 'Settings', path: '/settings' },
  { name: 'Performance', path: '/performance' },
  { name: 'Reports', path: '/reports' },
];

// --- Thresholds ---
const THRESHOLDS = {
  fcp: 1800,   // ms
  lcp: 2500,   // ms
  cls: 0.1,
  ttfb: 800,   // ms
};

// --- Security: validate shell arguments (defense in depth for S4721) ---
// All values are derived from hardcoded page arrays + env vars, not user input.
// This validation prevents shell metacharacter injection as an extra safeguard.
const SHELL_META = /[`$;&|<>!\n\r{}]/;
function assertSafeShellArg(value, label) {
  if (SHELL_META.test(value)) {
    throw new Error(`Unsafe characters detected in ${label}: ${value}`);
  }
}

// --- Helpers ---
async function collectMetrics(page) {
  await page.waitForTimeout(SETTLE);
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(p => p.name === 'first-contentful-paint');
    const res = performance.getEntriesByType('resource');
    let transfer = 0, jsBytes = 0, cssBytes = 0, imgBytes = 0;
    res.forEach(r => {
      const size = r.transferSize || 0;
      transfer += size;
      if (r.name.match(/\.js($|\?)/)) jsBytes += size;
      if (r.name.match(/\.css($|\?)/)) cssBytes += size;
      if (r.initiatorType === 'img' || r.name.match(/\.(png|jpg|jpeg|svg|webp|gif|avif)($|\?)/i)) imgBytes += size;
    });
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: Math.round(window.__perf?.lcp || 0) || null,
      cls: parseFloat((window.__perf?.cls || 0).toFixed(4)),
      lcpTag: window.__perf?.lcpTag || '',
      ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : null,
      domLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadEvent: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
      dom: document.querySelectorAll('*').length,
      requests: res.length,
      transferKB: Math.round(transfer / 1024),
      jsKB: Math.round(jsBytes / 1024),
      cssKB: Math.round(cssBytes / 1024),
      imgKB: Math.round(imgBytes / 1024),
    };
  });
}

async function measurePage(page, url, name) {
  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const loadMs = Date.now() - t0;
    const metrics = await collectMetrics(page);
    console.log(`    ${name}: ${loadMs}ms | FCP ${metrics.fcp}ms | LCP ${metrics.lcp}ms | CLS ${metrics.cls} | ${metrics.transferKB}kB`);
    return { name, path: url.replace(BASE, '') || '/', loadMs, ...metrics, status: 'ok' };
  } catch (err) {
    console.log(`    ${name}: ERROR - ${err.message}`);
    return { name, path: url.replace(BASE, '') || '/', status: 'error', error: err.message };
  }
}

async function measureInteraction(page, name, actionFn) {
  try {
    const t0 = Date.now();
    await actionFn();
    const ms = Date.now() - t0;
    console.log(`    ${name}: ${ms}ms`);
    return { name, interactionMs: ms, type: 'interaction', status: 'ok' };
  } catch (err) {
    console.log(`    ${name}: ERROR - ${err.message}`);
    return { name, type: 'interaction', status: 'error', error: err.message };
  }
}

async function measureNavigation(page, fromUrl, toSelector, label) {
  try {
    await page.goto(BASE + fromUrl, { waitUntil: 'networkidle', timeout: 20000 });
    const link = await page.$(toSelector);
    if (!link) return { name: `Nav: ${label}`, type: 'navigation', status: 'skipped', error: 'link not found' };
    const t0 = Date.now();
    await link.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const ms = Date.now() - t0;
    console.log(`    ${label}: ${ms}ms`);
    return { name: `Nav: ${label}`, navigationMs: ms, type: 'navigation', status: 'ok' };
  } catch (err) {
    console.log(`    ${label}: ERROR - ${err.message}`);
    return { name: `Nav: ${label}`, type: 'navigation', status: 'error', error: err.message };
  }
}

// --- Main ---
async function main() {
  console.log(`\nPMS Performance Audit`);
  console.log(`Target: ${TARGET} | URL: ${BASE}`);
  console.log(`${'='.repeat(100)}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  const results = [];

  // Warmup: hit the site once to avoid cold-start penalty on first measurement
  console.log('Warming up...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // ===== PHASE 1: Public pages =====
  if (TARGET === 'full' || TARGET === 'pages') {
    console.log('Phase 1: Public Pages');
    for (const p of PUBLIC_PAGES) {
      results.push(await measurePage(page, BASE + p.path, p.name));
    }
    console.log('');
  }

  // ===== PHASE 2: Authenticate =====
  console.log('Phase 2: Authenticating...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`  Authenticated! Redirected to: ${page.url()}\n`);
  } catch {
    console.error('  FAILED to authenticate. Check TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local');
    await browser.close();
    process.exit(1);
  }

  // Extract auth cookies for Lighthouse phase
  const authCookies = await ctx.cookies();
  const cookieHeader = authCookies.map(c => `${c.name}=${c.value}`).join('; ');

  // ===== PHASE 2b: Check test data =====
  console.log('Phase 2b: Checking test data...');
  await checkTestData(page);

  // ===== PHASE 3: Authenticated pages =====
  if (TARGET === 'full' || TARGET === 'pages') {
    console.log('Phase 3: Authenticated Pages');
    for (const p of AUTH_PAGES) {
      results.push(await measurePage(page, BASE + p.path, p.name));
    }
    console.log('');
  }

  // ===== PHASE 4: Detail pages =====
  if (TARGET === 'full' || TARGET === 'pages') {
    console.log('Phase 4: Detail Pages');

    // Project detail — ProjectCard uses role="button" with onClick → router.push
    await page.goto(BASE + '/projects', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // ProjectCard: <div role="button" ...> with project name inside
    const projCard = await page.$('[role="button"].rounded-2xl') || await page.$('[role="button"][tabindex="0"]');
    if (projCard) {
      await projCard.click();
      try {
        await page.waitForURL(/\/projects\//, { timeout: 10000 });
        const projUrl = page.url();
        results.push(await measurePage(page, projUrl, 'Project Detail'));
      } catch {
        console.log('    Project Detail: SKIPPED (navigation failed)');
        results.push({ name: 'Project Detail', status: 'skipped', error: 'navigation failed' });
      }
    } else {
      console.log('    Project Detail: SKIPPED (no projects)');
      results.push({ name: 'Project Detail', status: 'skipped', error: 'no projects found' });
    }

    // Client detail — ClientTableRow has a dropdown menu with "View full page" link to /clients/[id]
    await page.goto(BASE + '/clients', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // Open the actions dropdown on the first client row
    const actionsBtn = await page.$('button[aria-label*="Actions for"]');
    if (actionsBtn) {
      await actionsBtn.click();
      await page.waitForTimeout(500);
      // Click "View full page" menu item which contains a link to /clients/[id]
      const viewLink = await page.$('a[href*="/clients/"]');
      if (viewLink) {
        const clientHref = await viewLink.getAttribute('href');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        results.push(await measurePage(page, BASE + clientHref, 'Client Detail'));
      } else {
        await page.keyboard.press('Escape');
        console.log('    Client Detail: SKIPPED (no "View full page" link)');
        results.push({ name: 'Client Detail', status: 'skipped', error: 'no detail link in menu' });
      }
    } else {
      console.log('    Client Detail: SKIPPED (no clients)');
      results.push({ name: 'Client Detail', status: 'skipped', error: 'no clients found' });
    }

    // Chat conversation detail
    await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 20000 });
    const chatLink = await page.$('a[href*="/chat/"]');
    if (chatLink) {
      const href = await chatLink.getAttribute('href');
      results.push(await measurePage(page, BASE + href, 'Chat Conversation'));
    } else {
      console.log('    Chat Conversation: SKIPPED (no conversations)');
      results.push({ name: 'Chat Conversation', status: 'skipped', error: 'no conversations found' });
    }

    // Report detail — click first report link on /reports
    await page.goto(BASE + '/reports', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const reportLink = await page.$('a[href*="/reports/"]');
    if (reportLink) {
      const reportHref = await reportLink.getAttribute('href');
      results.push(await measurePage(page, BASE + reportHref, 'Report Detail'));
    } else {
      console.log('    Report Detail: SKIPPED (no reports)');
      results.push({ name: 'Report Detail', status: 'skipped', error: 'no reports found' });
    }

    console.log('');
  }

  // ===== PHASE 5: Interactions =====
  if (TARGET === 'full' || TARGET === 'interactions') {
    console.log('Phase 5: Interactions');

    // Command palette — click the Search button (lazy-loaded component)
    await page.goto(BASE + '/projects', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000); // Wait for lazy components to be ready
    results.push(await measureInteraction(page, 'Command Palette (open)', async () => {
      // Try keyboard shortcut first, then search button
      await page.keyboard.press('Control+k');
      try {
        await page.waitForSelector('[role="dialog"], [cmdk-input], [cmdk-root], input[placeholder*="Search"]', { timeout: 3000 });
      } catch {
        // Fallback: click the Search button
        const searchBtn = await page.$('button:has-text("Search")');
        if (searchBtn) {
          await searchBtn.click();
          await page.waitForSelector('[role="dialog"], [cmdk-input], [cmdk-root], input[placeholder*="Search"]', { timeout: 5000 });
        } else {
          throw new Error('Could not open command palette');
        }
      }
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Task detail panel — open from project detail page where TaskDetailPanel is used
    await page.goto(BASE + '/projects', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const projCardForTask = await page.$('[role="button"].rounded-2xl') || await page.$('[role="button"][tabindex="0"]');
    if (projCardForTask) {
      await projCardForTask.click();
      try { await page.waitForURL(/\/projects\//, { timeout: 10000 }); } catch {}
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      // Find a task title button (flex-1 truncate text-left)
      const taskTitle = await page.$('button.flex-1.truncate');
      if (taskTitle) {
        results.push(await measureInteraction(page, 'Task Detail Panel (open)', async () => {
          await taskTitle.click();
          // Panel opens as a sheet with role="dialog" or as a fixed panel
          await page.waitForSelector('[role="dialog"], .fixed.inset-y-0', { timeout: 5000 });
        }));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log('    Task Detail Panel: SKIPPED (no tasks in project)');
        results.push({ name: 'Task Detail Panel (open)', type: 'interaction', status: 'skipped' });
      }
    } else {
      console.log('    Task Detail Panel: SKIPPED (no projects)');
      results.push({ name: 'Task Detail Panel (open)', type: 'interaction', status: 'skipped' });
    }

    // Add Project wizard (lazy-loaded)
    await page.goto(BASE + '/projects', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    const addBtn = await page.$('button:has-text("Add Project")');
    const createBtn = addBtn || await page.$('button:has-text("Create new project")');
    if (createBtn) {
      results.push(await measureInteraction(page, 'Create Project Wizard (open)', async () => {
        await createBtn.click();
        // Wizard is lazy-loaded — wait for dialog or any modal overlay
        await page.waitForSelector('[role="dialog"], .fixed.inset-0, [data-state="open"]', { timeout: 8000 });
      }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('    Create Project Wizard: SKIPPED (button not found)');
      results.push({ name: 'Create Project Wizard (open)', type: 'interaction', status: 'skipped' });
    }

    // New Task button on /tasks page
    await page.goto(BASE + '/tasks', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
    const newTaskBtn = await page.$('button:has-text("New Task")');
    if (newTaskBtn) {
      results.push(await measureInteraction(page, 'New Task (create)', async () => {
        await newTaskBtn.click();
        await page.waitForTimeout(1000); // Wait for inline create or dialog
      }));
    }

    // Create Report wizard (lazy-loaded)
    await page.goto(BASE + '/reports', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    const createReportBtn = await page.$('button:has-text("Create Report")');
    if (createReportBtn) {
      results.push(await measureInteraction(page, 'Create Report Wizard (open)', async () => {
        await createReportBtn.click();
        // Wizard opens as a dialog
        await page.waitForSelector('[role="dialog"], .fixed.inset-0, [data-state="open"]', { timeout: 8000 });
      }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('    Create Report Wizard: SKIPPED (button not found)');
      results.push({ name: 'Create Report Wizard (open)', type: 'interaction', status: 'skipped' });
    }

    console.log('');
  }

  // ===== PHASE 6: Sidebar navigation =====
  if (TARGET === 'full' || TARGET === 'interactions') {
    console.log('Phase 6: Sidebar Navigation');

    const navTests = [
      { from: '/inbox', to: 'a[href="/tasks"]', label: 'Inbox -> Tasks' },
      { from: '/tasks', to: 'a[href="/projects"]', label: 'Tasks -> Projects' },
      { from: '/projects', to: 'a[href="/clients"]', label: 'Projects -> Clients' },
      { from: '/clients', to: 'a[href="/chat"]', label: 'Clients -> Chat' },
      { from: '/chat', to: 'a[href="/reports"]', label: 'Chat -> Reports' },
      { from: '/reports', to: 'a[href="/performance"]', label: 'Reports -> Performance' },
      { from: '/performance', to: 'a[href="/inbox"]', label: 'Performance -> Inbox' },
    ];

    for (const nav of navTests) {
      results.push(await measureNavigation(page, nav.from, nav.to, nav.label));
    }

    console.log('');
  }

  // ===== Save & Report =====
  await browser.close();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ===== PHASE 7: Lighthouse Audit =====
  if (TARGET === 'full' || TARGET === 'lighthouse') {
    console.log('Phase 7: Lighthouse Audit (all pages)');
    console.log('  Each page takes ~30-60s. This may take several minutes...\n');

    const headersFile = path.join(OUT_DIR, 'lh-extra-headers.json');
    fs.writeFileSync(headersFile, JSON.stringify({ Cookie: cookieHeader }));
    const headersArg = headersFile.replace(/\\/g, '/');

    const LH_PAGES = [...PUBLIC_PAGES, ...AUTH_PAGES];

    for (const p of LH_PAGES) {
      const url = BASE + p.path;
      const slug = p.name.toLowerCase().replace(/\s+/g, '-');
      const outPath = path.join(OUT_DIR, `lh-${slug}.json`);
      const outArg = outPath.replace(/\\/g, '/');

      process.stdout.write(`    ${p.name}... `);
      // Validate dynamic args before shell execution (defense in depth — S4721)
      assertSafeShellArg(url, 'url');
      assertSafeShellArg(outArg, 'output path');
      assertSafeShellArg(headersArg, 'headers path');
      try {
        // spawnSync with array args + validated inputs.
        // shell: true required on Windows for npx (.cmd batch file).
        spawnSync('npx', [
          'lighthouse', url,
          '--output=json', `--output-path=${outArg}`,
          '--preset=desktop', '--chrome-flags=--headless=new',
          `--extra-headers=${headersArg}`
        ], { timeout: 120000, stdio: 'pipe', shell: true });
      } catch (e) {
        // Lighthouse exits with code 1 on Windows due to Chrome temp dir cleanup — harmless
      }

      if (fs.existsSync(outPath)) {
        try {
          const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
          const finalUrl = report.finalDisplayedUrl || report.finalUrl || '';
          if (finalUrl.includes('/login') && !p.path.includes('/login')) {
            console.log('REDIRECTED TO LOGIN (auth cookies may have expired)');
            results.push({ name: p.name, path: p.path, type: 'lighthouse', status: 'error', error: 'Redirected to login' });
            continue;
          }
          const scores = {};
          Object.entries(report.categories).forEach(([k, v]) => {
            scores[k] = Math.round(v.score * 100);
          });
          results.push({ name: p.name, path: p.path, scores, type: 'lighthouse', status: 'ok' });
          console.log(`Perf ${scores.performance}% | A11y ${scores.accessibility}% | BP ${scores['best-practices']}% | SEO ${scores.seo}%`);
        } catch (e) {
          console.log('ERROR (failed to parse report)');
          results.push({ name: p.name, path: p.path, type: 'lighthouse', status: 'error', error: 'Failed to parse report' });
        }
      } else {
        console.log('ERROR (no report generated)');
        results.push({ name: p.name, path: p.path, type: 'lighthouse', status: 'error', error: 'No report generated' });
      }
    }

    // Clean up temp headers file
    try { fs.unlinkSync(headersFile); } catch {}
    console.log('');
  }


  // Load previous results for comparison
  let previous = null;
  if (fs.existsSync(OUT_FILE)) {
    try { previous = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch {}
  }

  const output = { timestamp: new Date().toISOString(), baseUrl: BASE, target: TARGET, results };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

  // --- Print report ---
  console.log('='.repeat(130));
  console.log('  PERFORMANCE AUDIT RESULTS');
  console.log('='.repeat(130));

  // Page load results
  const pageResults = results.filter(r => !r.type);
  if (pageResults.length > 0) {
    console.log('');
    console.log('  PAGE LOAD METRICS');
    console.log('  ' + '-'.repeat(126));
    console.log('  ' + [
      'Page'.padEnd(22),
      'Load'.padEnd(8),
      'FCP'.padEnd(8),
      'LCP'.padEnd(8),
      'CLS'.padEnd(7),
      'TTFB'.padEnd(8),
      'DOM'.padEnd(7),
      'Reqs'.padEnd(6),
      'Size'.padEnd(8),
      'JS'.padEnd(8),
      'CSS'.padEnd(7),
      'Img'.padEnd(7),
      'Status'.padEnd(8),
    ].join(''));
    console.log('  ' + '-'.repeat(126));

    for (const r of pageResults) {
      if (r.status === 'error' || r.status === 'skipped') {
        console.log('  ' + r.name.padEnd(22) + (r.status === 'error' ? `ERROR: ${r.error}` : 'SKIPPED'));
        continue;
      }
      console.log('  ' + [
        r.name.padEnd(22),
        (r.loadMs + 'ms').padEnd(8),
        ((r.fcp ?? '-') + (r.fcp ? 'ms' : '')).padEnd(8),
        ((r.lcp ?? '-') + (r.lcp ? 'ms' : '')).padEnd(8),
        String(r.cls ?? '-').padEnd(7),
        ((r.ttfb ?? '-') + (r.ttfb ? 'ms' : '')).padEnd(8),
        String(r.dom ?? '-').padEnd(7),
        String(r.requests ?? '-').padEnd(6),
        ((r.transferKB ?? '-') + 'kB').padEnd(8),
        ((r.jsKB ?? '-') + 'kB').padEnd(8),
        ((r.cssKB ?? '-') + 'kB').padEnd(7),
        ((r.imgKB ?? '-') + 'kB').padEnd(7),
        r.status.padEnd(8),
      ].join(''));
    }
  }

  // Interaction results
  const interactions = results.filter(r => r.type === 'interaction');
  if (interactions.length > 0) {
    console.log('');
    console.log('  INTERACTIONS');
    console.log('  ' + '-'.repeat(50));
    for (const r of interactions) {
      if (r.status === 'error' || r.status === 'skipped') {
        console.log(`  ${r.name.padEnd(40)} ${r.status === 'error' ? 'ERROR' : 'SKIPPED'}`);
      } else {
        console.log(`  ${r.name.padEnd(40)} ${r.interactionMs}ms`);
      }
    }
  }

  // Navigation results
  const navResults = results.filter(r => r.type === 'navigation');
  if (navResults.length > 0) {
    console.log('');
    console.log('  SIDEBAR NAVIGATION');
    console.log('  ' + '-'.repeat(50));
    for (const r of navResults) {
      if (r.status === 'error' || r.status === 'skipped') {
        console.log(`  ${r.name.padEnd(40)} ${r.status === 'error' ? 'ERROR' : 'SKIPPED'}`);
      } else {
        console.log(`  ${r.name.padEnd(40)} ${r.navigationMs}ms`);
      }
    }
  }

  // Lighthouse results
  const lhResults = results.filter(r => r.type === 'lighthouse');
  if (lhResults.length > 0) {
    console.log('');
    console.log('  LIGHTHOUSE SCORES');
    console.log('  ' + '-'.repeat(80));
    console.log('  ' + [
      'Page'.padEnd(22),
      'Perf'.padEnd(8),
      'A11y'.padEnd(8),
      'BP'.padEnd(8),
      'SEO'.padEnd(8),
      'Status'.padEnd(10),
    ].join(''));
    console.log('  ' + '-'.repeat(80));
    for (const r of lhResults) {
      if (r.status !== 'ok') {
        console.log('  ' + r.name.padEnd(22) + (r.error || r.status));
        continue;
      }
      console.log('  ' + [
        r.name.padEnd(22),
        (r.scores.performance + '%').padEnd(8),
        (r.scores.accessibility + '%').padEnd(8),
        ((r.scores['best-practices'] ?? '-') + '%').padEnd(8),
        (r.scores.seo + '%').padEnd(8),
        'ok'.padEnd(10),
      ].join(''));
    }
  }

  // Threshold checks
  console.log('');
  console.log('  THRESHOLD CHECKS');
  console.log('  ' + '-'.repeat(80));
  let failures = 0;
  for (const r of pageResults) {
    if (r.status !== 'ok') continue;
    const issues = [];
    if (r.fcp && r.fcp > THRESHOLDS.fcp) issues.push(`FCP ${r.fcp}ms > ${THRESHOLDS.fcp}ms`);
    if (r.lcp && r.lcp > THRESHOLDS.lcp) issues.push(`LCP ${r.lcp}ms > ${THRESHOLDS.lcp}ms`);
    if (r.cls > THRESHOLDS.cls) issues.push(`CLS ${r.cls} > ${THRESHOLDS.cls}`);
    if (r.ttfb && r.ttfb > THRESHOLDS.ttfb) issues.push(`TTFB ${r.ttfb}ms > ${THRESHOLDS.ttfb}ms`);
    if (issues.length > 0) {
      console.log(`  FAIL  ${r.name}: ${issues.join(', ')}`);
      failures++;
    } else {
      console.log(`  PASS  ${r.name}`);
    }
  }

  // Comparison with previous run
  if (previous && previous.results) {
    console.log('');
    console.log('  COMPARISON WITH PREVIOUS RUN');
    console.log(`  Previous: ${previous.timestamp}`);
    console.log('  ' + '-'.repeat(80));
    for (const r of pageResults) {
      if (r.status !== 'ok') continue;
      const prev = previous.results.find(p => p.name === r.name && p.status === 'ok');
      if (!prev) continue;
      const lcpDelta = (r.lcp || 0) - (prev.lcp || 0);
      const fcpDelta = (r.fcp || 0) - (prev.fcp || 0);
      const sizeDelta = (r.transferKB || 0) - (prev.transferKB || 0);
      const parts = [`${r.name.padEnd(22)}`];
      if (lcpDelta !== 0) parts.push(`LCP ${lcpDelta > 0 ? '+' : ''}${lcpDelta}ms`);
      if (fcpDelta !== 0) parts.push(`FCP ${fcpDelta > 0 ? '+' : ''}${fcpDelta}ms`);
      if (sizeDelta !== 0) parts.push(`Size ${sizeDelta > 0 ? '+' : ''}${sizeDelta}kB`);
      if (parts.length > 1) console.log('  ' + parts.join('  |  '));
    }
  }

  console.log('');
  console.log('='.repeat(130));
  console.log(`  ${failures === 0 ? 'ALL PAGES WITHIN THRESHOLDS' : failures + ' page(s) exceeded thresholds'}`);
  console.log(`  Results saved to: ${OUT_FILE}`);
  console.log('='.repeat(130));
}

main().catch(e => { console.error('Audit failed:', e); process.exit(1); });
