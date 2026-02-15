# Mobile & Progressive Web App Optimization Plan

**Application:** PMS (Project Management SaaS)
**Stack:** Next.js 16.1, React 19, Tailwind CSS 4, Supabase, Vercel
**Date:** 2026-02-14

---

## Table of Contents

1. [Current Mobile Architecture Assessment](#1-current-mobile-architecture-assessment)
2. [PWA Enhancement Opportunities](#2-pwa-enhancement-opportunities)
3. [Mobile-Specific Performance Optimizations](#3-mobile-specific-performance-optimizations)
4. [Offline Functionality Strategy](#4-offline-functionality-strategy)
5. [Adaptive Loading for Slow Networks](#5-adaptive-loading-for-slow-networks)
6. [Touch Responsiveness and Animations](#6-touch-responsiveness-and-animations)
7. [Service Worker Improvements for Mobile](#7-service-worker-improvements-for-mobile)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)

---

## 1. Current Mobile Architecture Assessment

### Strengths

| Area | Current State |
|------|--------------|
| Responsive layout | Tailwind CSS breakpoints throughout; sidebar collapses on mobile |
| Mobile detection | `useMobile()` hook via `useMediaQuery("(max-width: 768px)")` |
| Touch-friendly UI | Radix UI primitives with built-in touch support |
| Code splitting | 28+ dynamic imports reduce initial bundle on low-powered devices |
| Skeleton loading | 11 route-level loading.tsx files prevent blank screens on slow connections |
| Pagination | Cursor-based (50 items max) limits RSC payloads — critical for mobile data |
| LazyMotion | 4.6KB domAnimation instead of 34KB full bundle |
| Font loading | `display: swap` prevents FOIT on mobile |
| CSS containment | `contain: strict` on scrollable task/chat lists |
| Lazy hydration | IntersectionObserver-based for below-fold content on project detail |

### Gaps Identified

| Area | Current State | Mobile Impact |
|------|--------------|---------------|
| No web app manifest | `manifest.json` does not exist | Cannot install as PWA; no splash screen, no standalone mode |
| Service Worker bug | SW skips all requests on `vercel.app` hostname | No offline caching on production |
| No offline fallback | SW has no offline page fallback | Users see browser error on network loss |
| No adaptive loading | Same content served to all network speeds | Slow 3G users get same heavy payloads as WiFi |
| Realtime on mobile | WebSocket stays active when tab is backgrounded (inbox uses non-pooled subscription) | Battery drain on mobile |
| No touch gesture support | No swipe-to-dismiss, swipe-between-tabs, or pull-to-refresh | Suboptimal mobile UX patterns |
| Viewport meta | Standard `width=device-width, initial-scale=1` only | No `interactive-widget=resizes-visual` for virtual keyboard handling |

---

## 2. PWA Enhancement Opportunities

### 2a. Create Web App Manifest

**Impact: HIGH | Effort: LOW**

A web app manifest enables "Add to Home Screen" on mobile devices, providing:
- Custom splash screen during app startup
- Standalone display mode (no browser chrome)
- Custom theme color and app icon
- App-like experience without app store

**Create `public/manifest.webmanifest`:**

```json
{
  "name": "PMS - Project Management",
  "short_name": "PMS",
  "description": "Project & task management SaaS",
  "start_url": "/inbox",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0a0a0a",
  "orientation": "any",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**Link in `app/layout.tsx`:**

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### 2b. Generate PWA Icons

**Impact: MEDIUM | Effort: LOW**

Currently the app has `icon.png` and `apple-touch-icon.png`. For a complete PWA, generate:
- 192x192 icon (required for manifest)
- 512x512 icon (required for splash screen)
- Maskable variants with safe zone padding

### 2c. Add `theme-color` Meta Tag

**Impact: LOW | Effort: LOW**

Dynamic theme-color based on the active color theme:

```html
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
```

This colors the mobile browser toolbar to match the app theme.

---

## 3. Mobile-Specific Performance Optimizations

### 3a. Reduce JavaScript Execution on Mobile CPUs

**Impact: HIGH | Effort: MEDIUM**

Mobile CPUs are 3-5x slower than desktop. Key optimizations:

**1. Defer non-critical hydration:**
The dashboard layout renders 9 nested providers. On mobile, prioritize:
- `UserProvider` and `OrganizationProvider` — critical for auth
- Defer `CommandPaletteProvider` until first Ctrl+K (already lazy-loaded)
- Defer `NotificationToastProvider` — already lazy-loaded
- `RealtimeProvider` — defer initial subscription by 2 seconds on mobile to prioritize FCP

**2. Reduce re-renders on mobile navigation:**
The sidebar collapse/expand triggers re-renders of the entire layout. The `useMobile()` hook re-evaluates on every resize event. Use `useSyncExternalStore` with a debounced media query listener to reduce re-render frequency.

### 3b. Optimize List Rendering for Mobile

**Impact: MEDIUM | Effort: LOW**

Mobile screens show fewer items per viewport. Currently, all 50 paginated items render immediately. Consider:

**1. `content-visibility: auto` for list items:**
Already applied to command palette items. Extend to:
- Inbox items (`InboxContent.tsx`)
- Task rows in list view (`MyTasksPage.tsx`)
- Client table rows (`clients-content.tsx`)

This allows the browser to skip layout/paint for offscreen items, saving ~30-50ms on initial render of 50-item lists on mobile.

**2. Reduce items per page on mobile:**
Consider `MOBILE_PAGE_SIZE = 25` vs desktop `DEFAULT_PAGE_SIZE = 50`. Halving the page size reduces:
- RSC payload by 50%
- React reconciliation cost by 50%
- DOM node count by 50%

The `useMobile()` hook could drive this decision.

### 3c. Optimize Images for Mobile Viewports

**Impact: MEDIUM | Effort: LOW**

Add responsive `sizes` attributes to all `<Image>` components (detailed in CDN report section 2b). On mobile viewports, this ensures images are served at the correct size rather than the desktop resolution.

### 3d. Defer Realtime Connections on Mobile

**Impact: MEDIUM | Effort: MEDIUM**

Supabase Realtime WebSocket connections are expensive on mobile:
- Battery drain from persistent connections
- Data usage from keepalive pings
- Memory for WebSocket buffers

**Recommendation:** In `RealtimeProvider`, add a mobile-aware delay:

```typescript
// Defer realtime connection on mobile to prioritize initial render
const isMobile = useIsMobile()
useEffect(() => {
  const delay = isMobile ? 3000 : 0 // 3s delay on mobile
  const timer = setTimeout(() => initRealtimeSubscriptions(), delay)
  return () => clearTimeout(timer)
}, [isMobile])
```

The pooled realtime already pauses on tab visibility change, but the non-pooled inbox subscription does not. Consider migrating inbox to pooled subscriptions.

---

## 4. Offline Functionality Strategy

### 4a. Offline Fallback Page

**Impact: HIGH | Effort: LOW**

Currently, when a mobile user loses connectivity, they see the browser's default offline error. Create a custom offline page:

**Create `public/offline.html`:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PMS - Offline</title>
  <style>
    body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 1.5rem; color: #171717; }
    p { color: #737373; margin-top: 0.5rem; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid #e5e5e5; background: white; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're offline</h1>
    <p>Check your internet connection and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>
```

**Add to SW install event:**

```js
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icon.png',
  '/apple-touch-icon.png',
]
```

**Add offline fallback to SW fetch handler:**

```js
// For navigation requests, try network first, then cache, then offline page
if (event.request.mode === 'navigate') {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match('/offline.html'))
  )
  return
}
```

### 4b. Cache Key Data for Offline Access

**Impact: MEDIUM | Effort: HIGH**

For a full offline experience, cache the user's most recent data in IndexedDB:
- Last viewed project details
- Task list for the current project
- User profile and settings

This is a significant engineering effort and is recommended as a future enhancement rather than an immediate priority. The current architecture (server actions + RSC) makes offline data access challenging because all data flows through server-rendered pages.

### 4c. Queue Offline Mutations

**Impact: LOW | Effort: HIGH**

Implement a background sync queue for offline mutations:
- Task status changes
- Comment additions
- Read/unread toggling

This requires `BackgroundSync` API support (Chrome only) and a mutation queue in IndexedDB. Not recommended for initial implementation due to complexity and limited browser support.

---

## 5. Adaptive Loading for Slow Networks

### 5a. Network-Aware Loading

**Impact: MEDIUM | Effort: MEDIUM**

Use the Network Information API to adapt content loading:

```typescript
// hooks/use-network-quality.ts
export function useNetworkQuality() {
  const [quality, setQuality] = useState<'fast' | 'slow' | 'offline'>('fast')

  useEffect(() => {
    const nav = navigator as any
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection

    if (!conn) return // API not supported, assume fast

    const update = () => {
      if (!navigator.onLine) setQuality('offline')
      else if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') setQuality('slow')
      else if (conn.effectiveType === '3g' && conn.downlink < 1) setQuality('slow')
      else setQuality('fast')
    }

    update()
    conn.addEventListener('change', update)
    return () => conn.removeEventListener('change', update)
  }, [])

  return quality
}
```

**Adapt loading behavior:**

| Network | Behavior |
|---------|----------|
| Fast (4G/WiFi) | Normal loading — all features enabled |
| Slow (2G/slow 3G) | Disable auto-prefetching, reduce page size to 25, skip realtime subscriptions |
| Offline | Show offline fallback, serve cached content |

### 5b. `Save-Data` Header Respect

**Impact: LOW | Effort: LOW**

When users enable "Data Saver" mode, browsers send `Save-Data: on`. Respect this in middleware:

```typescript
// In middleware.ts
const saveData = request.headers.get('save-data') === 'on'
if (saveData) {
  response.headers.set('X-Save-Data', 'on')
}
```

Components can then check for this header to reduce data usage (skip avatar images, reduce list sizes, etc.).

---

## 6. Touch Responsiveness and Animations

### 6a. Virtual Keyboard Handling

**Impact: MEDIUM | Effort: LOW**

Mobile virtual keyboards can push content off-screen or cause layout shifts. Add the `interactive-widget` viewport meta:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-visual" />
```

This tells the browser to resize only the visual viewport (not the layout viewport) when the keyboard appears, preventing layout shifts in chat, task comments, and search inputs.

### 6b. Touch Target Sizes

**Impact: LOW | Effort: LOW**

WCAG 2.5.5 recommends 44x44px minimum touch targets. Most UI components (Radix UI buttons, Shadcn components) meet this requirement. Verify:

- Task list checkboxes (may be smaller than 44px)
- Project card action buttons (three-dot menu)
- Inbox item action icons
- Tab bar items on project detail

### 6c. Scroll Performance

**Impact: MEDIUM | Effort: LOW**

The app uses `overflow-y-auto` and `overflow-y-scroll` throughout. For smooth mobile scrolling:

1. **Already good:** CSS containment (`contain: strict`) on task lists and chat views
2. **Add `overscroll-behavior: contain`** to scrollable containers to prevent scroll chaining (where scrolling a list also scrolls the parent page):

```css
.scrollable-list {
  overscroll-behavior: contain;
}
```

3. **Passive touch event listeners:** React 19 automatically uses passive listeners for scroll/touch events. Verify that any manual `addEventListener` calls for touch events include `{ passive: true }`.

### 6d. Haptic Feedback (Future)

**Impact: LOW | Effort: LOW**

For installed PWA on supported devices, the Vibration API can provide subtle haptic feedback on actions:
- Task completion toggle
- Drag-and-drop reorder
- Pull-to-refresh completion

Not critical but enhances the native app feel.

---

## 7. Service Worker Improvements for Mobile

### 7a. Fix Production SW Bug (Critical)

**Impact: CRITICAL | Effort: LOW**

The current SW skips ALL requests where `url.hostname.includes('vercel.app')`. Since the production URL is `pms-nine-gold.vercel.app`, the SW does nothing in production. This completely negates any mobile caching benefits.

**Fix:** Remove the `vercel.app` hostname check from `public/sw.js` line 50.

### 7b. Add Navigation Preload

**Impact: MEDIUM | Effort: LOW**

Navigation Preload allows the browser to start fetching the navigation request in parallel with the SW boot-up, eliminating the SW startup delay (30-100ms on mobile):

```js
// In activate event
globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(names =>
        Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
      ),
      // Enable navigation preload
      globalThis.registration.navigationPreload?.enable(),
    ])
  )
  globalThis.clients.claim()
})
```

### 7c. Cache Strategy per Resource Type

**Impact: MEDIUM | Effort: MEDIUM**

Implement differentiated caching strategies:

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| `/_next/static/*` | Cache-first (immutable) | Content-hashed, never changes |
| Navigation (HTML) | Network-first with offline fallback | Must show fresh data |
| Images | Stale-while-revalidate | OK to show slightly stale images |
| Fonts | Cache-first | Rarely change |
| API responses | Network-only | Auth-protected, must not cache |

### 7d. Limit Cache Size

**Impact: LOW | Effort: LOW**

Mobile devices have limited storage. Add cache eviction:

```js
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxItems) {
    await Promise.all(keys.slice(0, keys.length - maxItems).map(k => cache.delete(k)))
  }
}
```

Call `trimCache(CACHE_NAME, 100)` in the activate event to keep the cache under 100 entries.

---

## 8. Implementation Priority Matrix

### Critical (Blocking Mobile Performance)

| # | Optimization | Impact | Effort |
|---|-------------|--------|--------|
| 1 | Fix SW `vercel.app` hostname skip | CRITICAL | LOW |
| 2 | Create web app manifest (`manifest.webmanifest`) | HIGH | LOW |
| 3 | Add offline fallback page | HIGH | LOW |

### High Priority (Meaningful Mobile Improvements)

| # | Optimization | Impact | Effort |
|---|-------------|--------|--------|
| 4 | Defer realtime on mobile (3s delay) | MEDIUM | MEDIUM |
| 5 | `content-visibility: auto` on list items | MEDIUM | LOW |
| 6 | Virtual keyboard handling (`interactive-widget`) | MEDIUM | LOW |
| 7 | `overscroll-behavior: contain` on scrollable lists | MEDIUM | LOW |
| 8 | SW navigation preload | MEDIUM | LOW |

### Medium Priority (Progressive Enhancement)

| # | Optimization | Impact | Effort |
|---|-------------|--------|--------|
| 9 | Adaptive page size for mobile (25 vs 50) | MEDIUM | MEDIUM |
| 10 | Network-aware loading hook | MEDIUM | MEDIUM |
| 11 | PWA icons (192/512, maskable) | LOW | LOW |
| 12 | Theme-color meta tags | LOW | LOW |
| 13 | SW per-resource caching strategies | MEDIUM | MEDIUM |

### Future Enhancements (Significant Effort)

| # | Optimization | Impact | Effort |
|---|-------------|--------|--------|
| 14 | IndexedDB offline data caching | HIGH | HIGH |
| 15 | Background sync for offline mutations | MEDIUM | HIGH |
| 16 | Touch gestures (swipe, pull-to-refresh) | LOW | MEDIUM |
| 17 | Haptic feedback in installed PWA | LOW | LOW |

### Expected Mobile Performance Improvements

| Metric | Current | After Priority Items | Improvement |
|--------|---------|---------------------|-------------|
| Repeat visit load (SW active) | No SW in prod | ~500ms (cached assets) | N/A → fast |
| Offline experience | Browser error | Custom offline page | Usable |
| PWA installability | Not installable | Full PWA | New capability |
| Mobile FCP | ~1.5s | ~1.2s (deferred realtime) | ~20% faster |
| Mobile list render | 50 items forced | 25 items + load more | ~50% faster |
| Scroll jank on task lists | Occasional | Eliminated (containment + overscroll) | Smooth |
| Battery drain (background) | WebSocket stays open | Paused on tab hide | Significant reduction |

---

## Appendix: Files to Modify

| File | Changes |
|------|---------|
| `public/sw.js` | Remove vercel.app check, add navigation preload, add cache strategies, add offline fallback |
| `public/manifest.webmanifest` | **CREATE** — web app manifest |
| `public/offline.html` | **CREATE** — offline fallback page |
| `app/layout.tsx` | Add manifest link, apple-mobile-web-app meta, theme-color meta, interactive-widget viewport |
| `hooks/use-network-quality.ts` | **CREATE** — network-aware loading hook |
| `hooks/realtime-context.tsx` | Add mobile-aware subscription delay |
| `hooks/use-realtime.ts` | Consider migrating inbox to pooled subscriptions |
| `app/globals.css` | Add `overscroll-behavior: contain` utility, extend `content-visibility: auto` patterns |
| `lib/constants.ts` | Add `MOBILE_PAGE_SIZE = 25` |
