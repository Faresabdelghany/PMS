const { chromium } = require('playwright');
const fs = require('fs');

const PAGES = [
  { name: 'Login (public)', path: '/login', auth: false },
  { name: 'Inbox', path: '/inbox', auth: true },
  { name: 'Projects', path: '/projects', auth: true },
  { name: 'Tasks', path: '/tasks', auth: true },
  { name: 'Clients', path: '/clients', auth: true },
  { name: 'Chat', path: '/chat', auth: true },
  { name: 'Performance', path: '/performance', auth: true },
  { name: 'Settings', path: '/settings', auth: true },
];

const BASE = 'https://pms-nine-gold.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const authState = JSON.parse(fs.readFileSync('e2e/.auth/user.json', 'utf8'));
  const authContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  const publicContext = await browser.newContext();
  
  const results = [];
  
  for (const pg of PAGES) {
    const context = pg.auth ? authContext : publicContext;
    const page = await context.newPage();
    
    try {
      // Warm-up run
      await page.goto(BASE + pg.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Measurement run
      await page.goto(BASE + pg.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for content to be visible
      await page.waitForLoadState('networkidle').catch(() => {});
      
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        const fcp = paint.find(e => e.name === 'first-contentful-paint');
        const resources = performance.getEntriesByType('resource');
        
        // CLS observer
        let cls = 0;
        const clsSources = [];
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
              if (entry.sources) {
                entry.sources.forEach(s => {
                  if (s.node) clsSources.push(s.node.nodeName + (s.node.className ? '.' + s.node.className.split(' ')[0] : ''));
                });
              }
            }
          }
        });
        try { observer.observe({ type: 'layout-shift', buffered: true }); } catch(e) {}
        
        const scriptResources = resources.filter(r => r.initiatorType === 'script');
        const styleResources = resources.filter(r => r.name.endsWith('.css') || r.initiatorType === 'style');
        const imageResources = resources.filter(r => r.initiatorType === 'img' || r.name.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i));
        const fontResources = resources.filter(r => r.name.match(/\.(woff2?|ttf|otf|eot)$/i));
        
        // Third-party scripts
        const thirdParty = resources.filter(r => {
          try {
            const url = new URL(r.name);
            return !url.hostname.includes('pms-nine-gold') && !url.hostname.includes('localhost') && r.initiatorType === 'script';
          } catch { return false; }
        });
        
        // Images audit
        const images = Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src.substring(0, 80),
          loading: img.loading,
          width: img.width,
          height: img.height,
          hasExplicitDimensions: img.hasAttribute('width') && img.hasAttribute('height'),
          isNextImage: img.closest('[data-nimg]') !== null,
        }));
        
        // Font audit
        const fonts = [];
        try {
          document.fonts.forEach(f => fonts.push({
            family: f.family,
            status: f.status,
            display: f.display || 'unknown',
          }));
        } catch(e) {}
        
        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          domInteractive: nav ? Math.round(nav.domInteractive) : null,
          domComplete: nav ? Math.round(nav.domComplete) : null,
          domCount: document.querySelectorAll('*').length,
          scriptCount: document.querySelectorAll('script').length,
          stylesheetCount: document.querySelectorAll('link[rel=stylesheet]').length,
          totalTransfer: Math.round(resources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
          jsBytes: Math.round(scriptResources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
          cssBytes: Math.round(styleResources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
          imageBytes: Math.round(imageResources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
          fontBytes: Math.round(fontResources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
          resourceCount: resources.length,
          cls: Math.round(cls * 1000) / 1000,
          clsSources,
          thirdParty: thirdParty.map(r => ({
            url: r.name.substring(0, 80),
            size: Math.round((r.transferSize || 0) / 1024),
            duration: Math.round(r.duration),
          })),
          images,
          fonts: [...new Set(fonts.map(f => f.family + ' (' + f.status + ')'))],
          fontCount: fontResources.length,
        };
      });
      
      results.push({ page: pg.name, path: pg.path, ...metrics });
      console.log('[PERF] ' + pg.name + ': TTFB=' + metrics.ttfb + 'ms FCP=' + metrics.fcp + 'ms DOM=' + metrics.domCount + ' Transfer=' + metrics.totalTransfer + 'kB JS=' + metrics.jsBytes + 'kB CLS=' + metrics.cls);
    } catch (err) {
      console.log('[PERF] ' + pg.name + ': ERROR - ' + err.message.substring(0, 100));
      results.push({ page: pg.name, path: pg.path, error: err.message.substring(0, 200) });
    }
    
    await page.close();
  }
  
  // Save results
  fs.writeFileSync('perf-page-metrics.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to perf-page-metrics.json');
  
  await authContext.close();
  await publicContext.close();
  await browser.close();
})().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
