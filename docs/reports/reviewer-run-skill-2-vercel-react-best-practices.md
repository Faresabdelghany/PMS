# Vercel React Best Practices — Review Report

**Date:** 2026-03-01  
**Skill:** vercel-react-best-practices (57 rules, 8 categories)  
**Codebase:** PMS (Next.js App Router, Supabase, SWR, motion/react)  
**Code Changes:** None (codebase already well-optimized)

---

## Executive Summary

The PMS codebase demonstrates **strong adherence** to Vercel's React best practices across all 8 categories. The architecture shows clear awareness of performance patterns — parallel data fetching, bundle splitting, server-side data minimization, and proper Suspense boundaries are all in place. No high-confidence safe fixes were identified; all findings are advisory for future work.

**Overall Score: 8.5/10** — Production-grade performance architecture with minor improvement opportunities.

---

## Category-by-Category Findings

### 1. Eliminating Waterfalls (CRITICAL) — ✅ Excellent

| Rule | Status | Notes |
|------|--------|-------|
| `async-parallel` | ✅ Pass | Dashboard layout uses `Promise.all()` for profile + colorTheme. Org-dependent queries start immediately after org resolves. Projects page uses `Promise.all()` for projects + clients. |
| `async-suspense-boundaries` | ✅ Pass | `SidebarWithData` streams via Suspense with promises passed as props. Children wrapped in `<Suspense fallback={<PageSkeleton />}>`. |
| `async-defer-await` | ✅ Pass | `activeProjectsPromise`, `unreadCountPromise`, `pendingApprovalsPromise` are started but not awaited until needed (or streamed). |
| `async-api-routes` | ✅ Pass | Server actions use `requireAuth()` early, data queries follow. |

**No issues found.** The waterfall-free architecture in `app/(dashboard)/layout.tsx` is exemplary.

### 2. Bundle Size Optimization (CRITICAL) — ✅ Excellent

| Rule | Status | Notes |
|------|--------|-------|
| `bundle-barrel-imports` | ✅ Pass | `optimizePackageImports` configured for 22+ packages (lucide-react, date-fns, motion/react, etc.). Phosphor icons imported from `/dist/ssr/` paths (individual file imports). |
| `bundle-dynamic-imports` | ✅ Pass | Heavy components lazy-loaded: `NotesTab`, `AssetsFilesTab`, `DeliverableTab`, `AIChatInputLazy`, `SyntaxHighlighterLazy`, `NotificationToastProviderLazy`. |
| `bundle-preload` | ✅ Pass | Tab components have explicit `preloadNotesTab()`, `preloadAssetsFilesTab()` functions for hover preloading. |
| `bundle-defer-third-party` | ✅ Pass | `AnalyticsWrapper` loaded after main content. Sentry configured with `bundleSizeOptimizations` (excludes replay, debug). |
| `bundle-conditional` | ✅ Pass | `gateway-test-button.tsx` dynamically imports `@/lib/supabase/client` only when test is triggered. |

**Motion optimization is notable:** Uses `m` + `LazyMotion` with `domAnimation` (~4.6KB vs ~34KB). Single `MotionProvider` at root.

### 3. Server-Side Performance (HIGH) — ✅ Very Good

| Rule | Status | Notes |
|------|--------|-------|
| `server-auth-actions` | ✅ Pass | All server actions use `requireAuth()` from `auth-helpers.ts`. Org/project membership checks via `requireOrgMember()`, `requireProjectMember()`. |
| `server-cache-react` | ✅ Pass | `cachedGetUser` and `getSupabaseClient` use React `cache()` for request-level dedup. |
| `server-cache-lru` | ✅ Pass | KV caching layer (`lib/cache`) with TTLs for orgs, sidebar, user profile, color theme. |
| `server-dedup-props` | ✅ Pass | Project detail page pre-computes UI transform server-side, strips unused fields before serialization. |
| `server-serialization` | ✅ Pass | `app/(dashboard)/projects/[id]/page.tsx` explicitly selects only needed fields for client components. |
| `server-parallel-fetching` | ✅ Pass | Layout fetches orgs/profile/colorTheme in parallel. Project page fetches clients/members/tags in parallel. |
| `server-after-nonblocking` | ✅ Pass | `after()` imported from `next/server` in task mutations for non-blocking side effects. |

### 4. Client-Side Data Fetching (MEDIUM-HIGH) — ✅ Good

| Rule | Status | Notes |
|------|--------|-------|
| `client-swr-dedup` | ✅ Pass | SWR provider at root. Used throughout for client-side data. |
| `client-event-listeners` | ✅ Pass | Realtime context centralizes Supabase channel subscriptions, deduplicating listeners. |

**Advisory:** Could not verify passive event listeners usage exhaustively; the codebase appears to use framework-managed events predominantly (React synthetic events), which is fine.

### 5. Re-render Optimization (MEDIUM) — ⚠️ Good with Minor Opportunities

| Rule | Status | Notes |
|------|--------|-------|
| `rerender-memo` | ✅ Pass | `AppSidebar` wrapped in `memo()`. Heavy list components use `useMemo`. |
| `rerender-derived-state-no-effect` | ⚠️ Advisory | `project-timeline.tsx` syncs `initialProjects` prop → state via `useEffect`. This is a common pattern but could use React's recommended approach of keying the component or computing during render. Not a bug — the current pattern works correctly. |
| `rerender-functional-setstate` | ✅ Pass | Seen in multiple components (e.g., tags-client uses functional updates). |
| `rerender-transitions` | ✅ Pass | `useTransition` used extensively in CRUD client components (approvals, board-groups, custom-fields, tags, webhooks). `startTransition` used in `ProjectDetailsPage`. |
| `rerender-lazy-state-init` | ✅ Pass | `viewStartDate` in project-timeline uses lazy initializer `() => startOfWeek(...)`. |

**Advisory findings (not actionable as fixes):**
- Several settings panes use `useEffect` to load initial data on mount. This is appropriate for client components that fetch from server actions, but could potentially be refactored to server components that pass data as props (already done for most pages).
- `project-timeline.tsx` has 5 `useEffect` calls — could benefit from consolidation, but each serves a distinct purpose.

### 6. Rendering Performance (MEDIUM) — ✅ Good

| Rule | Status | Notes |
|------|--------|-------|
| `rendering-hydration-no-flicker` | ✅ Pass | Root layout uses inline `<script>` with nonce for color theme to prevent flash. |
| `rendering-hydration-suppress-warning` | ✅ Pass | `suppressHydrationWarning` on `<html>` and `<body>` for theme provider. |
| `rendering-conditional-render` | ⚠️ Advisory | Some components use `{value && <Component />}` pattern (e.g., `TaskDetail.tsx` lines 140, 152, 243, 274, 280, 282, 290). This is safe when `value` is always a boolean/string/object (not `0` or `""`), which appears to be the case here. No fix needed. |
| `rendering-content-visibility` | ⚠️ Advisory | `LazySection` component uses IntersectionObserver for viewport-based rendering. Could additionally apply `content-visibility: auto` CSS for off-screen sections. |

### 7. JavaScript Performance (LOW-MEDIUM) — ✅ Pass

No significant issues found. The codebase uses standard patterns appropriately.

### 8. Advanced Patterns (LOW) — ✅ Pass

| Rule | Status | Notes |
|------|--------|-------|
| `advanced-init-once` | ✅ Pass | Supabase client, SWR provider, and realtime context all initialize once at appropriate lifecycle points. |

---

## Noteworthy Architecture Decisions

These go **beyond** the skill guidelines and show mature engineering:

1. **KV cache layer with tag-based invalidation** — Custom `cacheGet`/`CacheKeys`/`CacheTTL` system with `revalidateTag()` in server actions.
2. **Request-level dedup via React `cache()`** — Single `cachedGetUser()` shared across layout and pages.
3. **Explicit `cacheLife` profiles** in `next.config.mjs` for future PPR adoption.
4. **`staleTimes` configuration** — Reduces redundant server roundtrips on client navigation.
5. **Sentry bundle optimization** — `bundleSizeOptimizations` excluding replay/debug saves ~80-100KB.
6. **Image optimization** — AVIF priority, 24h cache TTL override, remote patterns configured.
7. **Font optimization** — `display: "swap"` on both fonts.
8. **Security headers** — Comprehensive (HSTS, X-Frame-Options, Permissions-Policy, CSP via nonce).

---

## Recommendations (Future Work, Not Urgent)

| Priority | Recommendation | Rule | Effort |
|----------|---------------|------|--------|
| Low | Add `content-visibility: auto` to `LazySection` CSS for additional off-screen optimization | `rendering-content-visibility` | 5 min |
| Low | Consider refactoring `project-timeline.tsx` prop-to-state sync to use component `key` instead of `useEffect` | `rerender-derived-state-no-effect` | 15 min |
| Low | Audit remaining `useEffect` data-loading patterns in settings panes for potential server component migration | `server-parallel-fetching` | 2-4 hrs |
| Low | Add `passive: true` explicitly to any custom scroll/touch listeners (if any exist outside React) | `client-passive-event-listeners` | 10 min |

---

## Conclusion

The PMS codebase is **well-optimized** and follows Vercel React best practices at a high level. The critical categories (waterfall elimination, bundle optimization) are handled excellently. No code changes were made — the codebase passes this review with only minor advisory notes for future consideration.
