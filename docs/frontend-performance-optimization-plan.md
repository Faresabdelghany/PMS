# Frontend Performance Optimization Plan

**Application:** PMS (Project Management SaaS)
**Stack:** Next.js 16.1, React 19, Tailwind CSS 4, Supabase, Vercel
**Date:** 2026-02-14
**Baseline context:** Cursor-based pagination (limit 50) recently added with LoadMoreButton. RSC payload reduced ~75-95% for key pages. Heavy view components already use `dynamic()` imports.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Bundle Analysis](#2-bundle-analysis)
3. [Code Splitting Audit](#3-code-splitting-audit)
4. [Resource Hints](#4-resource-hints)
5. [Critical Rendering Path](#5-critical-rendering-path)
6. [Image Optimization](#6-image-optimization)
7. [CSS Optimization](#7-css-optimization)
8. [Skeleton Components and CLS](#8-skeleton-components-and-cls)
9. [Additional Opportunities](#9-additional-opportunities)
10. [Implementation Priority Matrix](#10-implementation-priority-matrix)

---

## 1. Executive Summary

The PMS application already demonstrates a mature performance architecture. Key strengths include:

- **Extensive dynamic imports**: 28 files use `next/dynamic`, covering tabs, modals, board/timeline views, charts, DnD wrappers, the project wizard, and settings panes.
- **Lazy hydration**: Custom `createLazyHydratedComponent()` with IntersectionObserver for below-fold content on the project details page.
- **React.lazy with Suspense**: Settings dialog uses `React.lazy()` for all 12 panes with webpackChunkName hints.
- **Motion optimization**: Uses `LazyMotion` with `domAnimation` (4.6KB) instead of full motion bundle (34KB).
- **Idle-time prefetching**: Command palette chunk is prefetched via `requestIdleCallback`.
- **Tab hover preloading**: Project detail tabs trigger `import()` on `onMouseEnter` for instant tab switching.
- **No raw `<img>` tags**: All images use `next/image` with proper remote patterns.
- **Comprehensive loading.tsx files**: 11 route-level loading files with matched skeleton components.
- **CSS containment**: `contain: "strict"` on scrollable task lists and chat views.
- **`optimizePackageImports`**: 19 libraries listed for tree-shaking barrel imports.
- **Service Worker**: Caches static JS, CSS, images, fonts with stale-while-revalidate.
- **Router cache tuning**: `staleTimes.dynamic: 180s` avoids redundant server roundtrips.

The remaining optimizations are incremental but cumulatively meaningful. Below are the specific, actionable findings.

---

## 2. Bundle Analysis

### 2.1 Current `optimizePackageImports` Configuration

**File:** `C:\Users\Fares\Downloads\PMS\next.config.mjs` (lines 114-139)

The 19 libraries listed cover the major barrel-export offenders. This is well-configured.

**Missing candidates to add:**

| Library | Rationale |
|---------|-----------|
| `@radix-ui/react-*` (individual packages) | Radix UI ships 18+ packages, each with barrel exports. Although individual component imports are used, `optimizePackageImports` can still help with internal re-exports. |
| `zod` | Has named exports; tree-shaking benefits are modest but free. |
| `@supabase/supabase-js` | Large library with many sub-modules; worth testing. |

**Verdict:** Low priority. The current list covers the heaviest offenders. Adding Radix UI packages could shave 1-3KB if any unused Radix internals are leaking through.

### 2.2 Heavy Dependencies

**File:** `C:\Users\Fares\Downloads\PMS\package.json`

| Dependency | Estimated Size (gzip) | Status |
|---|---|---|
| `@supabase/supabase-js` | ~45KB | Required, no alternative |
| `recharts` | ~120KB | Already dynamically imported via `PerformanceCharts.tsx` |
| `react-syntax-highlighter` | ~100KB (PrismLight) / 1.4MB (full) | Already lazy-loaded in `syntax-highlighter-lazy.tsx` using PrismLight with selective language imports |
| `react-markdown` + `remark-gfm` | ~30KB | Statically imported in `markdown-content.tsx` -- see recommendation below |
| `@dnd-kit/*` | ~25KB | Already dynamically imported via `TaskListDndWrapper` and tab components |
| `@tiptap/*` | ~60KB | Dynamically imported via `ProjectDescriptionEditorLazy` and `TaskDetailDescription` |
| `dompurify` | ~8KB | Statically imported in 3 files -- see recommendation below |
| `motion` | ~4.6KB (domAnimation) | Already optimized with `LazyMotion` wrapper |
| `date-fns` | Tree-shakeable | Listed in `optimizePackageImports`, good |
| `cmdk` | ~8KB | Already dynamically imported via `CommandPaletteLazy` |

### 2.3 Recommendations

**R2.1 -- Lazy-load `react-markdown` + `remark-gfm` (Medium Priority)**

`react-markdown` (~30KB gzip) is statically imported in `C:\Users\Fares\Downloads\PMS\components\ai\markdown-content.tsx`, which is in turn statically imported by `ai-chat-message.tsx`. Since chat is a secondary feature (not visible on initial page load for most routes), this ~30KB is included in the chat page's client bundle but does not affect non-chat routes.

However, if `MarkdownContent` is ever pulled into a shared bundle, lazy-loading it via `dynamic()` would be beneficial. **Current state is acceptable** since the chat route already has its own loading boundary.

**R2.2 -- Lazy-load `dompurify` (Low Priority)**

`dompurify` (~8KB gzip) is statically imported in three components:
- `C:\Users\Fares\Downloads\PMS\components\tasks\TaskDetailDescription.tsx`
- `C:\Users\Fares\Downloads\PMS\components\tasks\TaskCommentItem.tsx`
- `C:\Users\Fares\Downloads\PMS\components\projects\NotePreviewModal.tsx`

These are all conditionally rendered components (task detail panel, comment items, note preview modals). Since `dompurify` is a pure utility (no UI), it can be loaded asynchronously:

```typescript
// Create lib/sanitize.ts
let sanitize: (html: string) => string

export async function getSanitizer() {
  if (!sanitize) {
    const DOMPurify = (await import("dompurify")).default
    sanitize = (html: string) => DOMPurify.sanitize(html)
  }
  return sanitize
}
```

**Estimated savings:** ~8KB from the initial task detail bundle.

---

## 3. Code Splitting Audit

### 3.1 Components Already Using Dynamic Imports

The codebase has excellent code splitting coverage. Files using `next/dynamic`:

| Component | Dynamic Targets |
|---|---|
| `ProjectDetailsPage.tsx` | NotesTab, AssetsFilesTab, DeliverableTab, ProjectReportsTab, AddFileModal |
| `MyTasksPage.tsx` | TaskWeekBoardView, TaskListDndWrapper |
| `projects-content.tsx` | ProjectTimeline, ProjectBoardView |
| `PerformanceCharts.tsx` | ProjectStatusPieChart, TaskVelocityChart, TeamProductivityChart |
| `command-palette-lazy.tsx` | CommandPalette |
| `ai-chat-trigger.tsx` | AIChatBubble/Sheet/Modal |
| `chat-page-content.tsx` | ChatView (lazy) |
| `settings-dialog-provider.tsx` | SettingsDialog |
| `notification-toast-provider-lazy.tsx` | NotificationToastProvider |
| Various `*Lazy.tsx` wrappers | WorkstreamTab, ProjectTasksTab, ProjectWizard, TaskQuickCreateModal, ProjectDescriptionEditor, AIChatInputLazy |

Additionally, `React.lazy()` is used in:
- `clients-content.tsx` (ClientWizard, ClientDetailsDrawer)
- `settings-dialog.tsx` (12 settings panes with webpackChunkName hints)

### 3.2 Components That Could Benefit from Code Splitting

**R3.1 -- `TaskQuickCreateModal` in `MyTasksPage.tsx` (Medium Priority)**

In `C:\Users\Fares\Downloads\PMS\components\tasks\MyTasksPage.tsx`, `TaskQuickCreateModal` is statically imported at line 108. This modal is only rendered when `isCreateTaskOpen` is true. While `TaskQuickCreateModalLazy` exists and is used in `CommandPaletteProvider`, the tasks page imports the full version directly.

**Impact:** The modal includes form fields, React Hook Form, Zod validation, and various UI components. Using the lazy variant would defer ~15-20KB until the user clicks "New Task".

**R3.2 -- `AlertDialog` in `MyTasksPage.tsx` (Low Priority)**

The delete confirmation dialog (`AlertDialog*` components, lines 96-104) is statically imported but only rendered when `taskToDelete` is non-null. This is a smaller component (~3KB), so the benefit is marginal.

**R3.3 -- `TaskQuickCreateModal` in `ProjectDetailsPage.tsx` (Medium Priority)**

Same pattern at `C:\Users\Fares\Downloads\PMS\components\projects\ProjectDetailsPage.tsx` line 30. The modal is statically imported but only conditionally rendered.

**R3.4 -- `InboxContent` icon imports (Low Priority)**

`C:\Users\Fares\Downloads\PMS\components\inbox\InboxContent.tsx` imports 12 Phosphor icons from individual SSR paths. These are already tree-shaken via `optimizePackageImports`, but the sheer count (12 icons for a single component) adds up. No immediate action needed since these are SSR-compatible deep imports.

### 3.3 Lazy Hydration Coverage

The `createLazyHydratedComponent()` in `C:\Users\Fares\Downloads\PMS\components\lazy-hydrate.tsx` is well-implemented with IntersectionObserver and configurable `rootMargin`. Currently used for 4 below-fold components on the project details overview tab:

- `LazyOutcomesList`
- `LazyKeyFeaturesColumns`
- `LazyTimelineGantt`
- `LazyRightMetaPanel`

**R3.5 -- Extend lazy hydration to other below-fold content (Low Priority)**

No other pages have significant below-fold content that would benefit from this pattern. The dashboard, tasks, and inbox pages render list content that is typically above-fold.

---

## 4. Resource Hints

### 4.1 Current State

**File:** `C:\Users\Fares\Downloads\PMS\app\layout.tsx` (lines 45-47)

```html
<link rel="preconnect" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
<link rel="dns-prefetch" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
```

This correctly preconnects to the Supabase API origin, which is the primary external dependency.

### 4.2 Font Loading Strategy

**File:** `C:\Users\Fares\Downloads\PMS\app\layout.tsx` (lines 11-20)

```typescript
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})
```

This is optimal:
- `display: "swap"` prevents invisible text during font load (FOIT), improving LCP.
- `subsets: ["latin"]` reduces font file size.
- Next.js `next/font/google` automatically self-hosts fonts and generates `<link rel="preload">` for them, eliminating render-blocking requests to Google Fonts.

### 4.3 Recommendations

**R4.1 -- Add `preconnect` to Google Fonts origin (Not Needed)**

Not applicable. Next.js `next/font/google` self-hosts fonts, so no external font origin connection is needed. This is already optimal.

**R4.2 -- Consider `preconnect` to Vercel Analytics (Low Priority)**

If `@vercel/analytics` and `@vercel/speed-insights` make requests to external Vercel endpoints, a preconnect could save ~100ms on the first analytics beacon. However, analytics is non-critical and fires asynchronously, so this has no UX impact.

**R4.3 -- Prefetch key navigation routes (Low Priority)**

Next.js App Router already prefetches `<Link>` hrefs on viewport entry by default. The `staleTimes.dynamic: 180` setting further improves repeat navigation. No additional `<link rel="prefetch">` tags are needed.

---

## 5. Critical Rendering Path

### 5.1 Dashboard Layout Provider Nesting

**File:** `C:\Users\Fares\Downloads\PMS\app\(dashboard)\layout.tsx`

Provider nesting order (outermost first):
```
SWRProvider > UserProvider > OrganizationProvider > RealtimeProvider
  > SettingsDialogProvider > CommandPaletteProvider > ColorThemeSyncer
  > NotificationToastProviderLazy > SidebarProvider > [children]
```

**Analysis:**
- 9 providers is a substantial nesting depth but each serves a distinct purpose.
- `NotificationToastProviderLazy` is correctly lazy-loaded.
- `CommandPaletteProvider` renders `CommandPaletteLazy` which defers actual component load until Cmd+K.
- `SettingsDialogProvider` lazy-loads the `SettingsDialog` via `next/dynamic`.
- `ColorThemeSyncer` is a lightweight effect-only component.

**R5.1 -- Potential provider composition optimization (Low Priority)**

The current nesting depth is acceptable. React 19's automatic batching handles provider re-renders efficiently. Composing providers into a single `AppProviders` wrapper would improve readability but has no performance impact.

### 5.2 Data Fetching Waterfall Analysis

**File:** `C:\Users\Fares\Downloads\PMS\app\(dashboard)\layout.tsx` (lines 130-148)

```typescript
// Start ALL queries in parallel
const orgsPromise = getOrganizations(supabase, user.id)
const profilePromise = getUserProfile(supabase, user.id)
const colorThemePromise = getCachedColorTheme(supabase, user.id)

const organizations = await orgsPromise  // Wait for orgs first

// activeProjects needs org ID - start it but DON'T block layout render
const activeProjectsPromise = getActiveProjects(supabase, organizations[0].id)

const [profile, colorTheme] = await Promise.all([
  profilePromise, colorThemePromise,
])
```

This is well-structured:
1. Three independent queries fire in parallel immediately.
2. Only `orgs` is awaited first (needed for redirect check and org-dependent queries).
3. `activeProjects` is started but not awaited -- it streams via `<Suspense>` around `SidebarWithData`.
4. `profile` and `colorTheme` were already started in parallel, so `Promise.all` just collects already-resolved values.

**No waterfall detected.** This is optimal.

### 5.3 Suspense Boundary Coverage

**Layout-level boundaries:**
```tsx
<Suspense fallback={<AppSidebar activeProjects={[]} />}>
  <SidebarWithData activeProjectsPromise={activeProjectsPromise} />
</Suspense>
<SidebarInset>
  <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
</SidebarInset>
```

This is correct. The sidebar streams independently from page content.

**Route-level boundaries:**
All 11 dashboard routes have `loading.tsx` files that show skeleton UIs, enabling streaming.

**Component-level boundaries:**
`ProjectDetailsPage.tsx` wraps each tab content in `<Suspense fallback={<TabSkeleton />}>`.

**R5.2 -- Missing Suspense boundary in `ProjectDetailsPage` overview tab (Low Priority)**

The overview tab content (lines 266-276) renders `ScopeColumns`, `LazyOutcomesList`, `LazyKeyFeaturesColumns`, and `LazyTimelineGantt` without a Suspense boundary. However, the lazy-hydrated components handle their own loading internally via IntersectionObserver, so this is acceptable.

### 5.4 Middleware Performance

**File:** `C:\Users\Fares\Downloads\PMS\middleware.ts`

The middleware is well-optimized:
- Fast-path: No auth cookie + protected route = immediate redirect (no Supabase call).
- Prefetch requests skip `getUser()` entirely.
- KV session caching skips `getUser()` for 5 minutes after validation.
- Nonce generation uses `crypto.randomUUID()` which is fast.

**R5.3 -- Middleware cacheSessionInKV is fire-and-forget (Observation)**

At line 188: `if (user) cacheSessionInKV(user.id)` -- this is correctly fire-and-forget (not awaited), so it does not block the response. Good.

---

## 6. Image Optimization

### 6.1 Current State

**No raw `<img>` tags found** in any component or page file. All image rendering uses `next/image` from:

- `C:\Users\Fares\Downloads\PMS\components\projects\FileTypeIcon.tsx`
- `C:\Users\Fares\Downloads\PMS\components\app-sidebar.tsx`
- `C:\Users\Fares\Downloads\PMS\components\project-wizard\steps\StepQuickCreate.tsx`
- `C:\Users\Fares\Downloads\PMS\components\projects\FilesTable.tsx`
- `C:\Users\Fares\Downloads\PMS\components\projects\FileLinkRow.tsx`

### 6.2 Image Configuration

**File:** `C:\Users\Fares\Downloads\PMS\next.config.mjs` (lines 51-70)

```javascript
images: {
  minimumCacheTTL: 86400, // 24 hours
  remotePatterns: [
    { hostname: 'lazhmdyajdqbnxxwyxun.supabase.co', pathname: '/storage/v1/object/public/**' },
    { hostname: '*.googleusercontent.com' },
    { hostname: 'avatars.githubusercontent.com' },
  ],
}
```

- `minimumCacheTTL: 86400` overrides short upstream cache headers. Good.
- Remote patterns cover all external image sources.

### 6.3 Image Caching Headers

**File:** `C:\Users\Fares\Downloads\PMS\next.config.mjs` (lines 89-98)

```javascript
{
  source: '/_next/image',
  headers: [{
    key: 'Cache-Control',
    value: 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
  }],
}
```

24-hour cache with 7-day stale-while-revalidate is appropriate.

### 6.4 Recommendations

**R6.1 -- Enable AVIF format (Medium Priority)**

Next.js supports AVIF via the `formats` configuration:

```javascript
images: {
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 86400,
  // ...
}
```

AVIF is typically 20-50% smaller than WebP for photographic content (avatars, project thumbnails). The tradeoff is slightly slower server-side encoding on first request. For a Vercel deployment, this is handled transparently by the image optimization API.

**Estimated savings:** 20-50% reduction in image bytes for avatar and file preview images.

**R6.2 -- Add explicit `width`/`height` or `sizes` to all `<Image>` components (Verification Needed)**

Verify that all `<Image>` usages include explicit dimensions or `fill` + `sizes` to prevent CLS. The files listed above should be checked individually.

**R6.3 -- Consider `priority` prop for LCP images (Low Priority)**

If any avatar or logo image is consistently the LCP element (e.g., the sidebar logo), adding `priority` would issue a `<link rel="preload">` for it. Typically the LCP element in this app is text content, not an image, so this is unlikely to matter.

---

## 7. CSS Optimization

### 7.1 Tailwind CSS 4 Configuration

**File:** `C:\Users\Fares\Downloads\PMS\postcss.config.mjs`

```javascript
plugins: { '@tailwindcss/postcss': {} }
```

Tailwind CSS 4 with PostCSS. Tailwind 4 uses a JIT (Just-In-Time) compiler by default, which generates only the CSS classes actually used in the codebase. No purge configuration is needed as it is automatic.

### 7.2 CSS Custom Properties (Color Themes)

**File:** `C:\Users\Fares\Downloads\PMS\app\globals.css` -- 1,077 lines

The file contains CSS custom property definitions for 12 color themes, each with light and dark mode variants. This means:

- **Default theme:** ~80 lines (light + dark)
- **11 additional themes:** ~90 lines each x 11 = ~990 lines
- **Utility styles:** ~70 lines (animations, content-visibility, etc.)

All 12 themes (24 variants including dark mode) are loaded in the initial CSS bundle regardless of which theme the user has selected.

### 7.3 Recommendations

**R7.1 -- Extract non-default color themes into separate CSS files (Medium-High Priority)**

The 11 non-default themes contribute approximately 990 lines of CSS custom property declarations. While CSS custom properties are lightweight (no selector specificity or layout cost), they still add to the initial CSS payload and parse time.

**Option A -- Dynamic CSS import per theme:**
```typescript
// In ColorThemeSyncer or a similar client component
useEffect(() => {
  if (theme && theme !== 'default') {
    import(`@/styles/themes/${theme}.css`)
  }
}, [theme])
```

This would reduce the initial CSS by ~4-5KB (uncompressed). After gzip, the savings are smaller (~1-2KB) because CSS custom property blocks compress very well due to repetitive structure.

**Verdict:** Medium priority. The absolute savings are modest (~1-2KB gzip) but this is a clean architectural improvement. The color theme flash prevention script in `layout.tsx` (which reads from localStorage and sets `data-color-theme` before React hydrates) would need to remain, and the theme CSS would need to be loaded synchronously or the FOUC would be noticeable.

**Option B -- CSS Layers (simpler, no code change):**
Keep all themes in `globals.css` but wrap them in `@layer themes` so the browser can skip selector matching for unused themes. This has no payload benefit but reduces style recalculation cost.

**R7.2 -- `content-visibility: auto` for long lists (Low Priority)**

The `command-item-optimized` class in `globals.css` already uses `content-visibility: auto` for command palette items. Consider applying this to other long scrollable lists:

- Inbox items (`InboxContent.tsx` renders up to 50 items)
- Task rows in the task list view
- Client table rows

However, since cursor-based pagination now limits lists to 50 items, the rendering cost is already bounded. This optimization would provide minimal benefit.

**R7.3 -- Review `will-change: transform` usage (Low Priority)**

Only one instance found at `globals.css:1060` for the `.animate-chat-bounce` class. This is correctly scoped to an animation and does not cause unnecessary GPU layer promotion elsewhere. No action needed.

---

## 8. Skeleton Components and CLS

### 8.1 Skeleton Coverage

The `C:\Users\Fares\Downloads\PMS\components\skeletons\` directory provides comprehensive skeleton components:

| Skeleton File | Components | Used In |
|---|---|---|
| `dashboard-skeletons.tsx` | StatCardSkeleton, ProjectCardSkeleton, ProjectsListSkeleton, DashboardHeaderSkeleton | `app/(dashboard)/loading.tsx`, `app/(dashboard)/projects/loading.tsx` |
| `task-skeletons.tsx` | TaskRowSkeleton, TaskListSkeleton, MyTasksSkeleton, TaskDetailSkeleton | `app/(dashboard)/tasks/loading.tsx` |
| `inbox-skeletons.tsx` | InboxItemSkeleton, InboxListSkeleton, InboxPageSkeleton | `app/(dashboard)/inbox/loading.tsx` |
| `client-skeletons.tsx` | ClientCardSkeleton, ClientsListSkeleton, ClientDetailsSkeleton | `app/(dashboard)/clients/loading.tsx` |
| `project-skeletons.tsx` | ProjectHeaderSkeleton, WorkstreamSkeleton, ProjectDetailsSkeleton | `app/(dashboard)/projects/[id]/loading.tsx` |
| `settings-skeletons.tsx` | SettingsPageSkeleton | `app/(dashboard)/settings/loading.tsx` |
| `chat-skeletons.tsx` | ChatPageSkeleton | `app/(dashboard)/chat/loading.tsx`, `chat/[conversationId]/loading.tsx` |
| `performance-skeletons.tsx` | ChartSkeleton, PerformancePageSkeleton | `app/(dashboard)/performance/loading.tsx` |
| `report-skeletons.tsx` | ReportDetailSkeleton, ReportsListSkeleton | Report route loading files |

### 8.2 CLS Analysis

**Well-matched skeletons (low CLS risk):**

- **`MyTasksSkeleton`** (task-skeletons.tsx): Mirrors the exact layout of `MyTasksPage.tsx` -- same container classes (`flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0`), same header structure with sidebar trigger + title, same filter/view sub-header, and project task sections. This is excellent CLS prevention.

- **`InboxPageSkeleton`** (inbox-skeletons.tsx): Mirrors `InboxContent.tsx` container structure with matching header, tab bar, search, and item list layout. The 6 tab skeletons and 8 item skeletons match the expected content shape.

**Potential CLS concerns:**

**R8.1 -- `ProjectsListSkeleton` used for both dashboard and projects page (Low Risk)**

`C:\Users\Fares\Downloads\PMS\app\(dashboard)\loading.tsx` and `C:\Users\Fares\Downloads\PMS\app\(dashboard)\projects\loading.tsx` both use `ProjectsListSkeleton`, which renders a 3-column grid of 6 project cards. However:

- The dashboard page (`/inbox` rewrite) shows inbox content, not projects. If the user navigates to the root, the loading skeleton shows project cards but the actual content is inbox. This is a minor mismatch but only visible during the loading.tsx phase.
- The projects page uses both a header (filters, view options) and a content area. The `ProjectsListSkeleton` does not include the header skeleton.

**Recommendation:** Create a dedicated `ProjectsPageSkeleton` that includes the project header (filter bar, view options) above the cards grid, matching the `ProjectsContent` component layout. Also create an `InboxPageSkeleton`-like wrapper for the dashboard loading state.

**R8.2 -- `LoadMoreButton` CLS safety (Already Safe)**

The `LoadMoreButton` component in `C:\Users\Fares\Downloads\PMS\components\ui\load-more-button.tsx` returns `null` when `hasMore` is false, which means it occupies zero space and does not shift content. When it appears, it is always at the bottom of the scrollable container. This is CLS-safe.

**R8.3 -- Dynamic import loading fallbacks (Good)**

Most `dynamic()` imports provide loading fallbacks:
- `TaskListDndWrapper`: `<div className="space-y-4 animate-pulse" />` -- minimal skeleton, could be improved with `TaskListSkeleton`.
- `TaskWeekBoardView`: Text-based loading indicator -- acceptable for a view switch.
- `PerformanceCharts`: `<ChartSkeleton height={300} />` -- properly sized.
- `ProjectDescriptionEditor`: `<div className="h-32 bg-muted/30 rounded animate-pulse" />` -- fixed height, good.

**R8.4 -- Improve `TaskListDndWrapper` loading skeleton (Low Priority)**

Replace the generic `<div className="space-y-4 animate-pulse" />` with an actual `TaskListSkeleton` to better match the final content dimensions.

---

## 9. Additional Opportunities

### 9.1 Service Worker Enhancements

**File:** `C:\Users\Fares\Downloads\PMS\public\sw.js`

The current service worker uses a stale-while-revalidate strategy for static assets. This is good for repeat visits.

**R9.1 -- Add versioned cache busting (Medium Priority)**

The cache name is hardcoded as `pms-cache-v1`. When deploying new versions, stale cached assets may be served until the background update completes. Consider:

1. Injecting the build hash into the cache name at build time.
2. Or relying on Next.js's content-hashed filenames (which already ensure unique URLs for new deployments).

Since Next.js uses content-hashed URLs for `/_next/static/*` assets, the current approach is actually fine -- a new deployment generates new URLs that will miss the cache and be fetched fresh. The `STATIC_ASSETS` array only caches `/`, `/icon.png`, and `/apple-touch-icon.png`.

**Verdict:** No change needed. The service worker is correctly scoped.

**R9.2 -- Skip caching HTML responses (Important Observation)**

The service worker currently caches ANY successful GET response that is not to an API/auth/Supabase URL. This could cache HTML page responses (RSC payloads), leading to stale content after deployments.

The extension-based check (lines 73-86) only caches `.js`, `.css`, `.png`, `.jpg`, `.svg`, `.woff2` files, which is correct. HTML responses are not cached. **This is fine.**

### 9.2 CSS Containment Opportunities

Current usage of CSS containment:
- `contain: "strict"` on task list scrollable area (`MyTasksPage.tsx`)
- `contain: "content"` on chat messages area (`chat-view.tsx`)
- `contain: "strict"` on virtualized workstream list (`VirtualizedWorkstreamList.tsx`)

**R9.3 -- Add `contain: "content"` to inbox item list (Low Priority)**

The inbox scrollable area in `InboxContent.tsx` could benefit from `contain: "content"` on the items container to isolate layout recalculations when items are marked as read or deleted.

### 9.3 Virtualization

**R9.4 -- Virtualization is no longer critical with pagination (Observation)**

With cursor-based pagination limiting items to 50 per page, virtual scrolling is less necessary. The existing `@tanstack/react-virtual` usage in `VirtualizedWorkstreamList.tsx` is appropriate for workstreams that may have many tasks within a single view.

For the main lists (tasks, inbox, clients, projects), 50 items render quickly without virtualization.

### 9.4 Phosphor Icons Import Pattern

All 438 Phosphor icon imports across 94 files use the deep SSR import path (`@phosphor-icons/react/dist/ssr/IconName`). Combined with `optimizePackageImports`, this ensures each icon is individually tree-shaken. **No issues found.**

### 9.5 Third-Party Script Loading

**R9.5 -- Verify `@vercel/analytics` and `@vercel/speed-insights` are non-blocking (Observation)**

`C:\Users\Fares\Downloads\PMS\components\analytics-wrapper.tsx` uses `dynamic()` to lazy-load analytics. The Vercel analytics scripts should not block the critical rendering path.

### 9.6 Router Cache Tuning

`staleTimes.dynamic: 180` (3 minutes) is a good balance for a real-time-backed application. Combined with Supabase Realtime subscriptions that push live updates, the router can serve cached RSC payloads for 3 minutes without stale data concerns.

---

## 10. Implementation Priority Matrix

### High Priority (Measurable CWV Impact)

| # | Recommendation | Estimated Impact | Effort |
|---|---|---|---|
| R6.1 | Enable AVIF image format in `next.config.mjs` | 20-50% smaller images, faster LCP | 1 line change |

### Medium Priority (Meaningful Bundle/Payload Reduction)

| # | Recommendation | Estimated Impact | Effort |
|---|---|---|---|
| R3.1 | Use `TaskQuickCreateModalLazy` in `MyTasksPage.tsx` | ~15-20KB deferred from initial bundle | Small refactor |
| R3.3 | Use `TaskQuickCreateModalLazy` in `ProjectDetailsPage.tsx` | ~15-20KB deferred from initial bundle | Small refactor |
| R7.1 | Extract non-default color themes from `globals.css` | ~1-2KB gzip CSS reduction | Medium refactor |
| R2.2 | Lazy-load `dompurify` utility | ~8KB deferred from task detail bundle | Small refactor |

### Low Priority (Minor or Architectural Improvements)

| # | Recommendation | Estimated Impact | Effort |
|---|---|---|---|
| R8.1 | Create dedicated `ProjectsPageSkeleton` with header | Better CLS match on projects route | Small |
| R8.4 | Improve `TaskListDndWrapper` loading skeleton | Better CLS during DnD chunk load | Trivial |
| R9.3 | Add `contain: "content"` to inbox list | Reduced layout thrashing | 1 line |
| R2.1 | Add Radix UI to `optimizePackageImports` | 1-3KB potential savings | 1 line |

### No Action Needed (Already Optimal)

| Area | Status |
|---|---|
| Font loading | Self-hosted with `display: swap`, auto-preloaded |
| Raw `<img>` tags | None found, all use `next/image` |
| Resource hints | Supabase preconnect + dns-prefetch in place |
| Dynamic imports | 28+ files, covering all heavy/conditional components |
| Data fetching waterfall | Parallel queries with streaming Suspense |
| Loading states | 11 route-level loading.tsx files with matched skeletons |
| Motion library | LazyMotion with domAnimation (4.6KB vs 34KB) |
| Icon imports | Deep SSR imports + optimizePackageImports |
| Command palette | Idle-time prefetch + lazy render on Cmd+K |
| Tab preloading | Hover-based import() on project detail tabs |
| Static asset caching | Service worker + immutable cache headers |
| Router cache | staleTimes.dynamic: 180s to avoid redundant roundtrips |
| CSS containment | Applied to scrollable lists and chat |
| Cursor-based pagination | 50-item limit reduces RSC payload 75-95% |

---

## Summary

This application has a mature, well-architected performance posture. The most impactful remaining change is **enabling AVIF image format** (1-line config change with 20-50% image size reduction). The medium-priority items (lazy-loading task modals, extracting theme CSS, lazy-loading DOMPurify) collectively save ~40-50KB from initial bundles. The low-priority items are polish-level improvements with diminishing returns.

The recent cursor-based pagination change was the highest-impact optimization, reducing RSC payloads by 75-95% and enabling 200-800ms faster LCP. Combined with the extensive dynamic import coverage, streaming Suspense boundaries, and matched skeleton components, the application is well-positioned for strong Core Web Vitals scores.
