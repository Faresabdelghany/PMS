# CDN and Edge Performance Optimization Plan

**Application:** PMS (Project Management SaaS)
**Stack:** Next.js 16.1, React 19, Supabase, Vercel
**Production URL:** https://pms-nine-gold.vercel.app
**Date:** 2026-02-14

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Image Optimization (AVIF, Responsive, Sizing)](#2-image-optimization)
3. [Cache Header Optimization](#3-cache-header-optimization)
4. [CSS Delivery: Color Theme Splitting](#4-css-delivery-color-theme-splitting)
5. [Compression Setup (Brotli/gzip)](#5-compression-setup)
6. [Service Worker Improvements](#6-service-worker-improvements)
7. [Vercel Edge Function Opportunities](#7-vercel-edge-function-opportunities)
8. [Geographic Distribution Considerations](#8-geographic-distribution-considerations)
9. [Preconnect and Resource Hints](#9-preconnect-and-resource-hints)
10. [Implementation Priority and Impact Matrix](#10-implementation-priority-and-impact-matrix)

---

## 1. Current State Assessment

### What is already well-configured

The application has a strong foundation:

- **Static asset headers:** `/_next/static/*` correctly uses `immutable, max-age=31536000` (content-hashed, cache forever)
- **Image cache headers:** `/_next/image` has `max-age=86400, s-maxage=86400, stale-while-revalidate=604800` (24h cache, 7-day stale)
- **`minimumCacheTTL: 86400`** overrides short upstream Supabase Storage headers
- **Self-hosted fonts** (Geist, Geist Mono) via `next/font/google` with `display: swap` -- no external font CDN dependency
- **Preconnect** to Supabase hostname in root layout
- **59 dynamic imports** across 31 files for aggressive code splitting
- **Hover-based prefetching** in sidebar (`router.prefetch` on mouse enter)
- **Middleware fast-paths:** cookie check before Supabase call, KV session caching, prefetch skip
- **Router stale times:** `dynamic: 180s, static: 300s` to reduce redundant RSC requests
- **Security headers:** HSTS with preload, X-Frame-Options DENY, CSP with nonce
- **Content-visibility CSS utilities** for render performance of large lists

### Gaps identified

| Area | Current State | Opportunity |
|------|--------------|-------------|
| Image format | WebP only (default) | AVIF not enabled (30-50% smaller than WebP) |
| Image `sizes` | Not specified on any `<Image>` | Oversized images served to small viewports |
| CSS payload | 1,077 lines in `globals.css`, 11 color themes (~990 lines for non-default themes) | Users load all 12 themes; only 1 is active |
| Service Worker | Caches `/`, icons, and static extensions by URL suffix | Does not cache `/_next/static` chunks (hashed), no versioned cache busting |
| Font preload | `next/font` handles it, but no crossorigin preconnect for Google font API | Minor -- `next/font` self-hosts, so this is already handled |
| `Vary` header | Not set on dynamic routes | Vercel handles this, but explicit `Vary: Cookie` would help CDN correctness |
| Manifest file | Missing `manifest.json` / `manifest.webmanifest` | Service Worker is registered but no web app manifest exists |
| API route caching | Only 2 API routes (auth callback, AI chat) | AI chat correctly uses `no-cache, no-transform` |

---

## 2. Image Optimization

### 2a. Enable AVIF Format

**Impact: HIGH | Effort: LOW**

AVIF provides 30-50% smaller file sizes than WebP for photographic content. Next.js supports it but does not enable it by default because encoding is CPU-intensive (adds ~200ms to first-request optimization time). For a SaaS app where images are cached after first serve, this tradeoff is strongly favorable.

**Change in `next.config.mjs`:**

```js
images: {
  formats: ['image/avif', 'image/webp'],  // ADD THIS LINE
  minimumCacheTTL: 86400,
  remotePatterns: [
    // ... existing patterns
  ],
},
```

The `formats` array is ordered by preference. Browsers that support AVIF (Chrome 85+, Firefox 93+, Safari 16.1+) get AVIF; others fall back to WebP. Given the app's browserslist targets (`last 2 Chrome/Firefox/Safari/Edge versions`), AVIF support is universal for the target audience.

**Expected savings:**
- Avatar images (user photos, 28-64px): ~40% smaller
- File type icons (pdf.png, figma.png, zip.png): ~30% smaller
- Cumulative: reduces `/_next/image` bandwidth per page by 30-50%

### 2b. Add `sizes` Attribute to All `<Image>` Components

**Impact: MEDIUM | Effort: MEDIUM**

Currently, none of the 6 components using `next/image` specify `sizes`. Without it, Next.js generates srcsets but the browser uses the viewport width to pick a size, often downloading an image larger than needed.

**Files to update:**

| File | Current | Recommended `sizes` |
|------|---------|-------------------|
| `components/app-sidebar.tsx` (line 287) | `width={16} height={16}` | Add `sizes="16px"` |
| `components/projects/FileLinkRow.tsx` (line 58-63) | `width={36} height={36}` | Add `sizes="36px"` |
| `components/projects/FilesTable.tsx` (line 148-149) | `width={28} height={28}` | Add `sizes="28px"` |
| `components/tasks/TaskQuickCreateModal.tsx` (line 526-527) | `width={20} height={20}` | Add `sizes="20px"` |
| `components/project-wizard/steps/StepQuickCreate.tsx` (lines 490-491, 606-607) | `width={20} height={20}`, `width={16} height={16}` | Add `sizes="20px"`, `sizes="16px"` |

For small fixed-dimension images (icons under 64px), the `sizes` attribute tells the browser exactly what size to request, preventing unnecessary upscaling in the srcset.

### 2c. Convert Static Public Images to Modern Formats

**Impact: LOW | Effort: LOW**

The `public/` directory contains 17 image files, all in legacy formats (PNG, JPG, SVG). The PNG files (logo-wrapper.png, pdf.png, figma.png, zip.png, placeholder-logo.png, etc.) should be:

1. Kept as-is for `public/` (they serve as fallbacks)
2. Served through `next/image` wherever possible (already done for most)
3. For any referenced via raw `<img>` tags or CSS `background-image`, consider converting to WebP with PNG fallback

The SVG files (icon.svg, placeholder.svg, placeholder-logo.svg) are already optimal and should remain as SVG.

---

## 3. Cache Header Optimization

### 3a. Add Font Cache Headers

**Impact: MEDIUM | Effort: LOW**

Self-hosted fonts from `next/font` are served from `/_next/static` and already get the immutable header. However, if any font files are served from other paths, they should have long cache headers. The current config already covers this via `/_next/static/:path*`.

No change needed -- fonts are correctly cached.

### 3b. Add `stale-while-revalidate` to HTML Document Responses

**Impact: MEDIUM | Effort: LOW**

Currently only `/_next/image` and `/_next/static` have explicit cache headers. The HTML document responses for dashboard pages have no explicit `Cache-Control`. While Vercel sets sensible defaults for Server-Rendered pages (`private, no-cache, no-store, max-age=0, must-revalidate`), this is correct for auth-protected pages -- they must NOT be cached by the CDN.

**No change recommended** for HTML responses. The auth-protected nature of the app means CDN caching of HTML would serve stale/wrong user data. The existing KV caching + React `cache()` deduplication strategy is the correct approach for this architecture.

### 3c. Add Cache Headers for Public Assets Not Under `_next`

**Impact: LOW | Effort: LOW**

Public directory images (logo, icons, placeholders) currently have no explicit cache headers. Add a rule for them:

```js
// In next.config.mjs headers()
{
  // Cache public images (not under _next, so need explicit headers)
  source: '/:path*.(png|jpg|jpeg|svg|webp|ico)',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  ],
},
```

This gives public images a 1-day browser cache and 7-day CDN cache with 1-day stale-while-revalidate. Since these files rarely change and are not content-hashed, this is a good balance.

### 3d. Strengthen Service Worker Cache Header

**Impact: LOW | Effort: LOW**

The service worker file `sw.js` is excluded from the middleware matcher, but has no explicit cache header. Service workers have special caching semantics -- the browser re-fetches them on navigation if they are more than 24 hours old. Set a short cache to ensure updates propagate quickly:

```js
{
  source: '/sw.js',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=0, must-revalidate',
    },
    {
      key: 'Service-Worker-Allowed',
      value: '/',
    },
  ],
},
```

The `max-age=0, must-revalidate` ensures the browser always checks for updates (conditional request with ETag), while `Service-Worker-Allowed` explicitly declares the SW scope.

---

## 4. CSS Delivery: Color Theme Splitting

**Impact: HIGH | Effort: MEDIUM**

### The Problem

`globals.css` is 1,077 lines. The default theme (light + dark) occupies ~80 lines. The remaining ~990 lines define 11 alternate color themes (forest, ocean, sunset, rose, supabase, chatgpt, midnight, lavender, ember, mint, slate), each with light and dark variants.

Every user downloads all 12 themes on every page load, but only uses 1. This is ~24KB of uncompressed CSS (roughly ~4-5KB gzipped) that is completely dead weight for 91.7% of theme variants.

### The Solution: Dynamic Theme CSS Loading

Create separate CSS files per theme and load them dynamically based on the user's active theme.

**Step 1:** Extract each theme into its own CSS file:

```
app/
  globals.css           (default theme + base styles only -- ~150 lines)
  themes/
    forest.css          (~80 lines)
    ocean.css           (~80 lines)
    sunset.css          (~80 lines)
    rose.css            (~80 lines)
    supabase.css        (~80 lines)
    chatgpt.css         (~80 lines)
    midnight.css        (~80 lines)
    lavender.css        (~80 lines)
    ember.css           (~80 lines)
    mint.css            (~80 lines)
    slate.css           (~80 lines)
```

**Step 2:** Update `ColorThemeSyncer` to dynamically inject a `<link>` tag for the active theme:

```tsx
// In ColorThemeSyncer or a new ThemeStyleLoader component
useEffect(() => {
  if (theme === 'default') return

  const linkId = 'color-theme-css'
  let link = document.getElementById(linkId) as HTMLLinkElement | null

  if (!link) {
    link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }

  link.href = `/themes/${theme}.css`

  return () => { link?.remove() }
}, [theme])
```

**Step 3:** The theme CSS files in `public/themes/` get the public asset cache headers (from 3c above).

**Expected savings:**
- Initial CSS payload reduced by ~85% (from ~1,077 lines to ~150 lines)
- Non-default theme users load only their theme (80 lines) after hydration
- Default theme users (likely the majority) load zero extra CSS

**Alternative (simpler, less optimal):** Use CSS `@import` with `@layer` and `media` queries. However, dynamic `<link>` injection is more effective because it completely avoids downloading unused themes.

---

## 5. Compression Setup

### 5a. Vercel Automatic Compression

**Impact: Already handled | Effort: NONE**

Vercel's Edge Network automatically applies:
- **Brotli** compression for all text-based responses (HTML, CSS, JS, JSON, SVG) when the client sends `Accept-Encoding: br`
- **gzip** fallback for clients that do not support Brotli

No configuration is needed. Vercel compresses at the edge PoP closest to the user, which means:
- Static assets: compressed once at build time (or first request), then cached compressed
- Dynamic responses: compressed on-the-fly at the edge

### 5b. Verify Compression is Working

You can verify with:

```bash
curl -sI -H "Accept-Encoding: br" https://pms-nine-gold.vercel.app/ | grep -i content-encoding
# Expected: content-encoding: br

curl -sI -H "Accept-Encoding: gzip" https://pms-nine-gold.vercel.app/ | grep -i content-encoding
# Expected: content-encoding: gzip
```

### 5c. Optimize for Compression

While Vercel handles compression automatically, you can improve compression ratios:

1. **JSON response structure consistency:** Server Actions returning `ActionResult<T>` with consistent field names (`data`, `error`) compresses better because repeated keys compress well
2. **CSS custom properties:** The oklch color values in globals.css compress extremely well due to repeated patterns (this is already the case)
3. **No additional compression libraries needed:** Do NOT add `compression` middleware or `next-compress` -- these add server-side overhead that Vercel's edge compression already handles more efficiently

---

## 6. Service Worker Improvements

### 6a. Version the Cache Name

**Impact: MEDIUM | Effort: LOW**

The current `CACHE_NAME = 'pms-cache-v1'` is static. When the SW is updated, old caches are cleaned up, but the cache name never changes, so the activate handler's cleanup logic never fires.

**Recommendation:** Tie the cache version to the build:

```js
// In sw.js
const CACHE_VERSION = '2'  // Increment on breaking changes
const CACHE_NAME = `pms-cache-v${CACHE_VERSION}`
```

Or inject it at build time via `next.config.mjs` using a timestamp or git hash.

### 6b. Fix the `vercel.app` Hostname Skip

**Impact: MEDIUM | Effort: LOW**

The current SW skips all requests where `url.hostname.includes('vercel.app')`. This means on the production domain `pms-nine-gold.vercel.app`, the SW skips ALL requests including HTML document fetches and static assets. The SW effectively does nothing in production.

**This is a significant bug.** The SW's stale-while-revalidate strategy for static assets is completely bypassed.

**Fix:** Change the hostname check to be more specific:

```js
// Instead of:
url.hostname.includes('vercel.app')

// Use:
url.hostname.includes('supabase.co')
// Remove the vercel.app check entirely -- let the SW cache static assets on the production domain
```

The Supabase check is correct (API calls should not be cached by the SW). The `vercel.app` check should be removed.

### 6c. Cache `_next/static` Chunks Explicitly

**Impact: MEDIUM | Effort: LOW**

The SW currently caches files matching `.js`, `.css`, `.png`, `.jpg`, `.svg`, `.woff2` by extension. But Next.js static chunks are served as `/_next/static/chunks/abc123.js` -- which the SW will try to cache, but it matches by URL suffix, not path pattern.

**The extension check works**, but add path-based matching for clarity and to also cache `.mjs` chunks:

```js
const isStaticAsset = (url) => {
  return url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.mjs') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.avif') ||  // Add AVIF if enabling format
    url.pathname.endsWith('.webp')
}
```

### 6d. Add Network-First Strategy for HTML Navigation

**Impact: LOW | Effort: LOW**

The current SW uses stale-while-revalidate for everything (cache-first with background update). For HTML document requests, network-first is more appropriate because the HTML contains the RSC payload with fresh data:

```js
// For navigation requests, use network-first
if (event.request.mode === 'navigate') {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the response for offline fallback
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
  return
}
```

---

## 7. Vercel Edge Function Opportunities

### 7a. Middleware is Already at the Edge

The existing `middleware.ts` runs on Vercel's Edge Runtime by default. It already:
- Generates per-request CSP nonces
- Performs fast cookie-based auth checks
- Caches session validation in KV
- Rewrites `/` to `/inbox` (saves a redirect round-trip)

**This is well-optimized.** No changes needed to the middleware runtime.

### 7b. Consider Edge Runtime for the AI Chat Route

**Impact: LOW | Effort: MEDIUM**

`app/api/ai/chat/route.ts` handles streaming AI responses. If it currently runs on Node.js runtime, moving it to Edge Runtime would reduce cold start latency (Edge functions start in <50ms vs Node.js ~250-500ms):

```ts
export const runtime = 'edge'  // Add to route.ts
```

**Caveat:** Only do this if the route does not use Node.js-specific APIs (Buffer, fs, crypto.createHash, etc.). The Edge Runtime has a limited API surface. Given that this route streams to external AI APIs (OpenAI, Anthropic, Google), it likely only uses `fetch` and `ReadableStream`, which are edge-compatible.

### 7c. Edge Config for Feature Flags (Future)

**Impact: LOW | Effort: MEDIUM**

If the app needs feature flags or A/B testing in the future, Vercel Edge Config provides ultra-low-latency reads (~0ms from PoP memory) compared to KV (~1-5ms):

```ts
import { get } from '@vercel/edge-config'

// In middleware or server component
const enableNewDashboard = await get('enable-new-dashboard')
```

Not needed now, but worth noting for future architecture decisions.

### 7d. Vercel Skew Protection

**Impact: MEDIUM | Effort: LOW**

Vercel's Skew Protection ensures that during deployments, users who loaded the old version's HTML continue to get the old version's static assets (JS chunks, CSS). Without it, a deployment can cause `ChunkLoadError` if a user's cached HTML references a chunk that no longer exists on the new deployment.

**Enable in Vercel project settings** or via `vercel.json`:

```json
{
  "skewProtection": "12 hours"
}
```

This keeps old deployment assets available for 12 hours after a new deployment, eliminating chunk loading errors for users with stale HTML.

---

## 8. Geographic Distribution Considerations

### 8a. Vercel Edge Network Coverage

Vercel deploys to all edge locations automatically. The app benefits from:
- **Static assets:** Cached at all ~100+ edge PoPs worldwide
- **Serverless functions:** Run in the selected region (default: `iad1` / Washington D.C.)
- **Middleware:** Runs at every edge PoP (already the case)

### 8b. Supabase Region Alignment

The Supabase project (`lazhmdyajdqbnxxwyxun`) is hosted in a specific region. For optimal latency:

1. **Verify Supabase region:** Check the Supabase dashboard for the project's region
2. **Align Vercel function region:** Set the Vercel function region to match:
   ```json
   // vercel.json
   {
     "regions": ["iad1"]  // Match to Supabase region
   }
   ```
   Or in `next.config.mjs` per-route if needed.

If Supabase is in `us-east-1` (AWS Virginia), the default Vercel region `iad1` (Washington D.C.) is already optimal (~1ms network latency between them).

### 8c. KV/Redis Region

Vercel KV (backed by Upstash Redis) should be in the same region as the serverless functions. Check the KV instance region in the Vercel dashboard. If it is not co-located, this adds 10-50ms to every KV operation (session checks, cache reads).

### 8d. Multi-Region Considerations

For a SaaS with primarily North American or single-region users, the current setup is fine. If expanding globally:

1. **Supabase Read Replicas:** Deploy read replicas in secondary regions
2. **Vercel Fluid Compute:** Enable if available -- it runs serverless functions in the region closest to the user
3. **Edge-side data caching:** Move more reads into KV with regional replication

**Not recommended now** unless there is evidence of high-latency requests from specific geographies.

---

## 9. Preconnect and Resource Hints

### 9a. Current State

The root layout includes:
```html
<link rel="preconnect" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
<link rel="dns-prefetch" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
```

This is correct for the Supabase API/Realtime connection.

### 9b. Add `crossorigin` to Supabase Preconnect

**Impact: LOW | Effort: LOW**

The Supabase JS client uses `fetch()` for API calls and `WebSocket` for Realtime. Both are CORS requests. Without `crossorigin`, the browser establishes a non-CORS connection pool, then has to establish a second connection for the actual CORS requests.

```html
<link rel="preconnect" href="https://lazhmdyajdqbnxxwyxun.supabase.co" crossOrigin="anonymous" />
```

**Keep the existing non-crossorigin preconnect too** for cookie-bearing requests (Supabase auth uses cookies via SSR):

```html
<link rel="preconnect" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
<link rel="preconnect" href="https://lazhmdyajdqbnxxwyxun.supabase.co" crossOrigin="anonymous" />
<link rel="dns-prefetch" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
```

### 9c. Preconnect to Avatar CDNs

**Impact: LOW | Effort: LOW**

Google and GitHub avatars are loaded in many components (45 files reference Avatar). Add preconnects for the most common avatar CDNs:

```html
<link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
<link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
```

Use `dns-prefetch` (not full `preconnect`) because avatar loading is not critical-path -- it happens after the main content renders.

---

## 10. Implementation Priority and Impact Matrix

| # | Optimization | Impact | Effort | Category |
|---|-------------|--------|--------|----------|
| 1 | **Fix SW `vercel.app` hostname skip (6b)** | HIGH | LOW | Bug fix |
| 2 | **Enable AVIF image format (2a)** | HIGH | LOW | Image |
| 3 | **Split color theme CSS (4)** | HIGH | MEDIUM | CSS delivery |
| 4 | **Add `sizes` to Image components (2b)** | MEDIUM | MEDIUM | Image |
| 5 | **Enable Skew Protection (7d)** | MEDIUM | LOW | Reliability |
| 6 | **Add public asset cache headers (3c)** | LOW | LOW | Caching |
| 7 | **SW cache header + Service-Worker-Allowed (3d)** | LOW | LOW | Caching |
| 8 | **Add crossorigin to preconnect (9b)** | LOW | LOW | Resource hints |
| 9 | **DNS-prefetch for avatar CDNs (9c)** | LOW | LOW | Resource hints |
| 10 | **SW versioned cache + chunk caching (6a, 6c)** | MEDIUM | LOW | Service Worker |
| 11 | **Edge Runtime for AI chat route (7b)** | LOW | MEDIUM | Edge |
| 12 | **Verify region alignment (8b, 8c)** | MEDIUM | LOW | Infrastructure |

### Recommended Implementation Order

**Phase 1 -- Quick wins (1-2 hours):**
- Fix #1 (SW vercel.app bug)
- Implement #2 (AVIF -- one line)
- Implement #6 (public asset headers)
- Implement #7 (SW cache header)
- Implement #8 (crossorigin preconnect)
- Implement #9 (avatar DNS prefetch)
- Enable #5 (Skew Protection in Vercel dashboard)

**Phase 2 -- Medium effort (2-4 hours):**
- Implement #4 (sizes attributes on all Image components)
- Implement #10 (SW improvements)
- Verify #12 (region alignment)

**Phase 3 -- Larger refactor (4-8 hours):**
- Implement #3 (CSS theme splitting)
- Evaluate #11 (Edge Runtime for AI chat)

### Expected Cumulative Impact

| Metric | Current | After Phase 1 | After All Phases |
|--------|---------|---------------|-----------------|
| Image payload per page | Baseline | -30 to 50% (AVIF) | -40 to 60% |
| CSS initial load | ~1,077 lines | ~1,077 lines | ~150 lines (-86%) |
| SW effectiveness | 0% (vercel.app bug) | Active | Active + optimized |
| Public asset cache hits | 0% (no headers) | ~90%+ | ~90%+ |
| Chunk loading errors on deploy | Possible | Eliminated (Skew Protection) | Eliminated |

---

## Appendix: Files to Modify

| File | Changes |
|------|---------|
| `next.config.mjs` | Add `formats: ['image/avif', 'image/webp']`, add public asset cache headers, add SW headers |
| `public/sw.js` | Remove `vercel.app` hostname check, add `.mjs`/`.avif`/`.webp` extensions, version cache name, add navigate strategy |
| `app/layout.tsx` | Add crossorigin preconnect, add avatar DNS-prefetch hints |
| `app/globals.css` | Extract non-default themes (Phase 3) |
| `components/app-sidebar.tsx` | Add `sizes="16px"` to Image |
| `components/projects/FileLinkRow.tsx` | Add `sizes="36px"` to Image |
| `components/projects/FilesTable.tsx` | Add `sizes="28px"` to Image |
| `components/tasks/TaskQuickCreateModal.tsx` | Add `sizes="20px"` to Image |
| `components/project-wizard/steps/StepQuickCreate.tsx` | Add `sizes="20px"` and `sizes="16px"` to Images |
| Vercel Dashboard | Enable Skew Protection, verify function region and KV region |
