# Cache Components (PPR) Implementation Design

**Date:** 2026-02-02
**Status:** Approved
**Goal:** Maximum performance through Partial Prerendering with static/cached/dynamic separation

## Overview

Implement Next.js 16 Cache Components to achieve:
- 6-8x faster Time to First Byte
- 4-5x faster First Contentful Paint
- 80% reduction in database queries per request
- Component-level streaming for progressive content loading

## Design Decisions

### Cache Profiles (Four Tiers)

| Profile | Stale | Revalidate | Expire | Use Case |
|---------|-------|------------|--------|----------|
| `realtimeBacked` | 5 min | 15 min | 1 hour | Projects, tasks, clients |
| `semiStatic` | 15 min | 30 min | 2 hours | Members, tags, workstreams |
| `static` | 30 min | 1 hour | 4 hours | Organization details |
| `user` | 30s-5min | varies | varies | Inbox, activity, my tasks |

### Architecture

1. **Centralized Cache Layer** (`lib/cache.ts`) - All cached functions with `'use cache'` directive
2. **Component-Level Suspense** - Fine-grained loading states for maximum perceived speed
3. **Immediate Invalidation** - `updateTag()` in all server actions for read-your-own-writes
4. **Preload Pattern** - Data prefetching in layout before page render
5. **Edge Caching** - `'use cache: remote'` for shared organizational data

### Pages Covered

All dashboard pages: Dashboard, Tasks, Clients, Client Details, Project Details, Inbox, Settings

## Implementation Phases

### Phase 1: Infrastructure
- Update `next.config.mjs` with `cacheComponents` and `cacheLife` profiles
- Update `lib/cache-tags.ts` with all cache tags
- Create `lib/cache.ts` centralized cache layer
- Database migration for performance indexes

### Phase 2: Skeleton Components
- Extend `components/ui/skeleton.tsx` with primitives
- Create skeleton components for all cached units

### Phase 3: Server Action Updates
- Switch all `revalidateTag()` to `updateTag()` for immediate invalidation

### Phase 4: Cached Components
- Create cached wrapper components for each data type

### Phase 5: Page Restructuring
- Restructure all pages with static/cached/dynamic separation
- Add Suspense boundaries with matching skeletons

### Phase 6: Testing & Verification
- Build verification
- Manual testing
- Performance testing

## Files to Create

- `lib/cache.ts`
- `components/skeletons/*.tsx`
- `components/dashboard/*.tsx`
- `components/tasks/*.tsx`
- `components/clients/*.tsx`
- `components/projects/*.tsx`
- `components/inbox/*.tsx`
- `components/settings/*.tsx`
- `supabase/migrations/XXX_add_performance_indexes.sql`

## Files to Modify

- `next.config.mjs`
- `lib/cache-tags.ts`
- `lib/actions/*.ts` (all action files)
- `app/(dashboard)/*.tsx` (all page files)
- `components/ui/skeleton.tsx`

## Real-time Integration

Existing WebSocket subscriptions (`useTasksRealtime`, `useProjectsRealtime`, etc.) continue to push live updates after initial cached load. Cache serves fast initial render; real-time handles subsequent updates.

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| TTFB | 300-800ms | 50-100ms |
| FCP | 400-900ms | 100-200ms |
| LCP | 800-1500ms | 300-500ms |
| DB queries/request | 5-15 | 0-3 |
