# PMS Performance Audit - February 2026

## Overview

Full architecture and performance audit of the PMS application against official Next.js 16 and Supabase best practices. The application was fast ~3 weeks ago but has degraded since. This document captures all findings, root causes, and recommended fixes.

**Audit Date:** 2026-02-17
**Next.js Version:** 16.1.6
**React Version:** 19.2.4
**Supabase JS:** 2.91.1

---

## Table of Contents

1. [Root Cause of Recent Slowdown](#1-root-cause-of-recent-slowdown)
2. [Project Structure](#2-project-structure)
3. [Layout & Provider Architecture](#3-layout--provider-architecture)
4. [CSS Strategy](#4-css-strategy)
5. [Caching & Data Fetching](#5-caching--data-fetching)
6. [Realtime Subscriptions](#6-realtime-subscriptions)
7. [Middleware](#7-middleware)
8. [Component Composition](#8-component-composition)
9. [Bundle Size & Lazy Loading](#9-bundle-size--lazy-loading)
10. [Image Optimization](#10-image-optimization)
11. [Security Headers](#11-security-headers)
12. [Priority Fix List](#12-priority-fix-list)

---

## 1. Root Cause of Recent Slowdown

Three recent commits (last 2-3 weeks) introduced performance regressions that compound each other:

| Commit | Date | Change | Impact |
|--------|------|--------|--------|
| `1cbde42` | ~3 weeks ago | Added `useState` for connection health to `RealtimeProvider` | Every subscription status change re-renders the entire app tree |
| `55b7f60` | ~2 weeks ago | Added `usePooledProjectsRealtime` to sidebar | Persistent WebSocket subscription on every page, triggers RealtimeProvider state changes |
| `d0915c8` | ~1 week ago | Added database trigger for auto-progress calculation | Adds latency to every task mutation |

**How they compound:** The sidebar (rendered on every page) now has 2 realtime subscriptions. Each subscription connect/disconnect triggers `useState` setters in `RealtimeProvider`, which wraps the entire app. This creates a new context value object, forcing ALL components using `useRealtimeContext()` to re-render. On every page navigation, subscriptions mount/unmount, and on every tab visibility toggle, all channels pause/resume — each event cascades re-renders through the entire component tree.

---

## 2. Project Structure

**Status: GOOD - No issues**

```
app/
  (auth)/              -- Route group for auth pages (login, signup)
  (dashboard)/         -- Route group for main app with shared layout
    inbox/page.tsx     -- Default landing page (/ redirects here)
    projects/page.tsx
    tasks/page.tsx
    clients/page.tsx
    chat/page.tsx
    settings/page.tsx
  auth/callback/       -- OAuth callback handler
  onboarding/          -- Organization onboarding
  invite/              -- Organization invitation flow
components/            -- Feature-organized React components
  ui/                  -- shadcn/ui design system primitives
  projects/, tasks/, clients/ -- Feature components
  skeletons/           -- Loading skeleton components
  ai/                  -- AI chat components
lib/                   -- Utilities, actions, cache, data
  actions/             -- Server Actions (organized by feature)
  cache/               -- KV caching layer
  supabase/            -- Supabase clients and types
hooks/                 -- Custom React hooks
supabase/              -- Database migrations
e2e/                   -- Playwright E2E tests
```

**Next.js docs reference:**
> Route groups are created by wrapping a folder name in parentheses, e.g., `(folderName)`. This signifies that the folder is for organizational purposes and will not be included in the route's URL path.

The project correctly uses:
- Route groups `(auth)` and `(dashboard)` for organizational separation
- Nested layouts with `layout.tsx` at each level
- `loading.tsx` files for every dashboard route (excellent streaming coverage)
- File-system based routing following Next.js conventions

---

## 3. Layout & Provider Architecture

**Status: PROBLEMS FOUND**

### Current Layout Structure

**File:** `app/(dashboard)/layout.tsx`

```tsx
// Current provider nesting (8 levels deep)
<SWRProvider>
  <UserProvider initialUser={...} initialProfile={profile}>
    <OrganizationProvider initialOrganizations={organizations}>
      <RealtimeProvider>                              // <-- PROBLEM: contains frequently-changing state
        <SettingsDialogProvider>
          <CommandPaletteProvider>
            <ColorThemeSyncer serverTheme={colorTheme} />
            <NotificationToastProviderLazy userId={user.id} />
            <SidebarProvider>
              <Suspense fallback={<AppSidebar activeProjects={[]} />}>
                <SidebarWithData activeProjectsPromise={activeProjectsPromise} />
              </Suspense>
              <SidebarInset>
                <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
              </SidebarInset>
            </SidebarProvider>
            <Toaster richColors closeButton />
          </CommandPaletteProvider>
        </SettingsDialogProvider>
      </RealtimeProvider>
    </OrganizationProvider>
  </UserProvider>
</SWRProvider>
```

### Issue A: RealtimeProvider Context Value Not Memoized (CRITICAL)

**File:** `hooks/realtime-context.tsx:77-224`

The `RealtimeProvider` wraps the **entire app** and uses three `useState` hooks for connection status:

```tsx
// hooks/realtime-context.tsx (current - problematic)
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const subscriptionsRef = useRef<Map<SubscriptionKey, SubscriptionState>>(new Map())
  const listenerIdCounter = useRef(0)
  const isVisible = useDocumentVisibility()
  const [isConnected, setIsConnected] = useState(false)                           // <-- state change = re-render
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("disconnected")  // <-- state change = re-render
  const [lastError, setLastError] = useState<string | null>(null)                 // <-- state change = re-render

  // ...subscribe callback is memoized with useCallback, but...

  // This creates a NEW object on every render when any state changes:
  return (
    <RealtimeContext.Provider value={{ subscribe, isConnected, connectionStatus, lastError }}>
      {children}
    </RealtimeContext.Provider>
  )
}
```

**Problem:** Every time any subscription connects/disconnects/errors, these state setters fire. This creates a new `value` object for the context, which causes ALL consumers of `useRealtimeContext()` to re-render. Consumers include every component using `usePooledRealtime`, `usePooledTasksRealtime`, `usePooledProjectsRealtime`, etc.

**When this triggers:**
- Every page navigation (components mount/unmount subscriptions)
- Every tab visibility toggle (all channels pause/resume)
- Any channel error or timeout
- Any new subscription being created

**Next.js docs reference:**
> "Render providers as deep as possible in the tree. Notice how ThemeProvider only wraps {children} instead of the entire `<html>` document. This makes it easier for Next.js to optimize the static parts of your Server Components."

**Fix Option 1 - Memoize the context value:**

```tsx
// hooks/realtime-context.tsx (fixed)
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("disconnected")
  const [lastError, setLastError] = useState<string | null>(null)

  const subscribe = useCallback(/* ... */, [])

  // Memoize so consumers only re-render when specific values change
  const value = useMemo(
    () => ({ subscribe, isConnected, connectionStatus, lastError }),
    [subscribe, isConnected, connectionStatus, lastError]
  )

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}
```

**Fix Option 2 - Split into two contexts (best):**

```tsx
// Stable context - rarely changes, used by all subscription consumers
const RealtimeSubscribeContext = createContext<{ subscribe: SubscribeFn } | null>(null)

// Volatile context - changes frequently, only used by connection status UI
const RealtimeStatusContext = createContext<{
  isConnected: boolean
  connectionStatus: RealtimeConnectionStatus
  lastError: string | null
} | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("disconnected")
  const [lastError, setLastError] = useState<string | null>(null)

  const subscribe = useCallback(/* ... */, [])

  const subscribeValue = useMemo(() => ({ subscribe }), [subscribe])
  const statusValue = useMemo(
    () => ({ isConnected, connectionStatus, lastError }),
    [isConnected, connectionStatus, lastError]
  )

  return (
    <RealtimeSubscribeContext.Provider value={subscribeValue}>
      <RealtimeStatusContext.Provider value={statusValue}>
        {children}
      </RealtimeStatusContext.Provider>
    </RealtimeSubscribeContext.Provider>
  )
}

// usePooledRealtime uses ONLY the stable subscribe context
// useRealtimeConnectionStatus uses ONLY the volatile status context
```

This way, subscription status changes only re-render components that explicitly display connection status, not every component with a realtime subscription.

### Issue B: SWRProvider Wraps Server Components Unnecessarily

**File:** `components/providers/swr-provider.tsx`

```tsx
"use client"
import { SWRConfig } from "swr"

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,      // <-- triggers request bursts on tab switch
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        errorRetryCount: 2,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
```

SWR is client-only, but it wraps the entire dashboard tree including Server Components. While this doesn't break anything (Server Components pass through client component boundaries as `children`), `revalidateOnFocus: true` is redundant since the app already has realtime subscriptions for live updates. Every tab switch triggers revalidation of ALL active SWR hooks simultaneously.

**Fix:** Set `revalidateOnFocus: false` since realtime handles live updates:

```tsx
<SWRConfig
  value={{
    revalidateOnFocus: false,      // Realtime subscriptions handle live updates
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    errorRetryCount: 2,
    keepPreviousData: true,
  }}
>
```

---

## 4. CSS Strategy

**Status: MAJOR PROBLEM**

### Issue: globals.css Contains 12 Themes Inlined (~950 Lines of Dead CSS)

**File:** `app/globals.css` (1064 lines)

The file contains 12 color themes, each with light AND dark variants:
- Default, Forest, Ocean, Sunset, Rose, Supabase, ChatGPT, Midnight, Lavender, Ember, Mint, Slate

Each theme defines ~35 CSS custom properties x 2 (light + dark) = ~70 declarations per theme x 12 themes = **~840 variable declarations**.

Only 1 theme is ever active at a time. The other 11 themes (~770 declarations) are **dead CSS** that every page must parse.

**Next.js docs reference:**
> "Try to contain CSS imports to a single JavaScript or TypeScript entry file. Import global styles and Tailwind stylesheets in the root of your application. Use Tailwind CSS for most styling needs. Extract shared styles into shared components to avoid duplicate imports."

**Current structure:**

```css
/* app/globals.css - 1064 lines */
@import "tailwindcss";
@import "tw-animate-css";

:root { /* ~35 default theme variables */ }
.dark { /* ~35 default dark variables */ }

[data-color-theme="forest"] { /* ~35 variables */ }
[data-color-theme="forest"].dark { /* ~35 variables */ }

[data-color-theme="ocean"] { /* ~35 variables */ }
[data-color-theme="ocean"].dark { /* ~35 variables */ }

/* ... 9 more themes, each with light + dark ... */

@theme inline { /* Tailwind theme mapping ~40 lines */ }
@layer base { /* Base styles ~10 lines */ }
/* Utility classes ~50 lines */
```

**Fix: Extract themes into separate files, load on demand:**

```
app/globals.css                    -- Base theme + Tailwind + utilities (~150 lines)
lib/themes/forest.css              -- Forest theme only (~80 lines)
lib/themes/ocean.css               -- Ocean theme only
lib/themes/sunset.css              -- etc.
...
```

Then in `ColorThemeProvider`, dynamically import only the active theme:

```tsx
"use client"
import { useEffect } from "react"

export function ColorThemeSyncer({ serverTheme }: { serverTheme: string }) {
  useEffect(() => {
    if (serverTheme && serverTheme !== "default") {
      // Dynamically load only the active theme CSS
      import(`@/lib/themes/${serverTheme}.css`)
    }
  }, [serverTheme])

  // ...
}
```

This reduces the critical CSS from ~1064 lines to ~150 lines.

---

## 5. Caching & Data Fetching

**Status: MOSTLY GOOD, SOME ISSUES**

### What's Done Right

**Request-level deduplication with `React.cache()`:**

```tsx
// lib/request-cache.ts - Auth & Supabase client only
export const cachedGetUser = cache(async () => {
  const supabase = await getSupabaseClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  return { user: session?.user ?? null, error, supabase }
})

// lib/server-cache.ts - ALL data-fetching cached wrappers
export const getCachedProjects = cache(async (orgId: string) => {
  const { getProjects } = await import("./actions/projects")
  return getProjects(orgId)
})
```

**KV cache with stale-while-revalidate:**

```tsx
// lib/cache/utils.ts
export async function cacheGet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
  const cached = await cache.get<T>(key)
  if (cached !== null) {
    // SWR: if < 25% TTL remaining, serve stale + refresh in background
    if (remaining < ttlSeconds * 0.25) {
      fetcher().then(fresh => cache.set(key, fresh, { ex: ttlSeconds }))
    }
    return cached
  }
  const fresh = await fetcher()
  cache.set(key, fresh, { ex: ttlSeconds })
  return fresh
}
```

**Parallel data fetching in pages:**

```tsx
// app/(dashboard)/tasks/page.tsx
export default async function Page() {
  const { user, orgId } = await getPageOrganization()
  // Start ALL 4 data promises WITHOUT awaiting
  const tasksPromise = getCachedMyTasks(orgId)
  const projectsPromise = getCachedProjects(orgId)
  const membersPromise = getCachedOrganizationMembers(orgId)
  const tagsPromise = getCachedTags(orgId)

  return (
    <Suspense fallback={<MyTasksSkeleton />}>
      <TasksStreamed tasksPromise={tasksPromise} projectsPromise={projectsPromise} ... />
    </Suspense>
  )
}
```

**Unified cache invalidation:**

```tsx
// lib/cache/invalidation.ts
await invalidateCache.project({ projectId, orgId })  // Invalidates both Next.js tags AND KV cache
await invalidateCache.task({ taskId, projectId, assigneeId, orgId })
```

### Issue A: `getTasks` Returns ALL Rows Without `.limit()` (HIGH)

**File:** `lib/actions/tasks/queries.ts:94-101`

```tsx
// Current (problematic) - no cursor path returns EVERYTHING
export async function getTasks(projectId: string, filters?: TaskFilters, cursor?: string, limit: number = DEFAULT_PAGE_SIZE) {
  // ...

  // No cursor: return all tasks (board view, drag-drop, timeline need full set)
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
  // ^^^ NO .limit() - fetches EVERY task in the project

  return { data: (data || []) as TaskWithRelations[], nextCursor: null, hasMore: false }
}
```

For projects with hundreds of tasks, this creates massive payloads that slow down:
- RSC serialization on the server
- Network transfer
- Client-side hydration
- React rendering

**Fix:** Add a reasonable limit even for non-cursor queries:

```tsx
const MAX_BOARD_TASKS = 500

// No cursor: return tasks up to board limit
const { data, error } = await query
  .order("sort_order", { ascending: true })
  .order("id", { ascending: true })
  .limit(MAX_BOARD_TASKS)
```

### Issue B: `SELECT *` in Hot Queries (MEDIUM)

Several frequently-called queries fetch all columns when only a few are needed:

**Sidebar projects query (`layout.tsx:63`):**

```tsx
// Current - fetches ALL project columns
const { data } = await supabase
  .from("projects")
  .select("*")                    // <-- includes description, scope, outcomes, features, etc.
  .eq("organization_id", organizationId)
  .eq("status", "active")
  .order("updated_at", { ascending: false })
  .limit(SIDEBAR_PROJECT_LIMIT)

// Fix - select only what the sidebar needs
const { data } = await supabase
  .from("projects")
  .select("id, name, progress, status, updated_at")
  .eq("organization_id", organizationId)
  .eq("status", "active")
  .order("updated_at", { ascending: false })
  .limit(SIDEBAR_PROJECT_LIMIT)
```

**getProjects query (`crud.ts:271`):**

```tsx
// Current
.select(`
  *,                              // <-- includes description, all text fields
  client:clients(id, name),
  team:teams(id, name),
  members:project_members(id, role, user_id, profile:profiles(id, full_name, email, avatar_url))
`)

// Fix - select only list-view fields
.select(`
  id, name, status, priority, progress, start_date, end_date, updated_at, client_id, team_id,
  client:clients(id, name),
  team:teams(id, name),
  members:project_members(id, role, user_id, profile:profiles(id, full_name, email, avatar_url))
`)
```

**getMyTasks query (`queries.ts:128`):**

```tsx
// Current
.select(`
  *,                              // <-- includes full description text
  assignee:profiles(id, full_name, email, avatar_url),
  workstream:workstreams(id, name),
  project:projects!inner(id, name, organization_id)
`)

// Fix
.select(`
  id, name, status, priority, start_date, end_date, sort_order, assignee_id, workstream_id, project_id, updated_at,
  assignee:profiles(id, full_name, email, avatar_url),
  workstream:workstreams(id, name),
  project:projects!inner(id, name, organization_id)
`)
```

### Issue C: `staleTimes.dynamic` Set to 180s (LOW)

**File:** `next.config.mjs:158-161`

```javascript
experimental: {
  staleTimes: {
    dynamic: 180, // 3 minutes - dashboard data has real-time subscriptions for live updates
    static: 300,  // 5 minutes for static pages
  },
}
```

**Next.js docs reference:**
> `staleTimes` is an experimental feature that enables caching of page segments in the client-side router cache. The `static` and `dynamic` properties correspond with the time period (in seconds) based on different types of link prefetching.

Next.js 15+ defaults `dynamic` to **0 seconds**. Your 180s means navigating back to a page within 3 minutes shows stale data from the client router cache without checking the server.

Since you have realtime subscriptions for live updates, this is somewhat justified. But it can cause confusion when mutations happen in another tab/user. Consider reducing to 30-60s:

```javascript
staleTimes: {
  dynamic: 30,  // 30 seconds - balance between freshness and performance
  static: 180,  // 3 minutes
},
```

---

## 6. Realtime Subscriptions

**Status: CRITICAL PROBLEMS**

### Issue A: Mixed Realtime Systems (CRITICAL)

**File:** `components/app-sidebar.tsx:207-285`

The sidebar uses BOTH realtime systems simultaneously:

```tsx
export function AppSidebar({ activeProjects = [] }: AppSidebarProps) {
  // ...

  // POOLED subscription (via realtime-context.tsx)
  usePooledProjectsRealtime(organization?.id, {
    onInsert: (project) => { /* ... */ },
    onUpdate: (project, oldProject) => { /* ... */ },
    onDelete: (oldProject) => { /* ... */ },
  })

  // STANDALONE subscription (via use-realtime.ts - NOT pooled)
  useInboxRealtime(user?.id, {
    onInsert: () => setUnreadCount((prev) => prev + 1),
    onUpdate: (item, oldItem) => { /* ... */ },
    onDelete: (item) => { /* ... */ },
  })
}
```

The standalone `useInboxRealtime` creates its own channel via `createClient()` **outside** the pooled system:

```tsx
// hooks/use-realtime.ts (standalone)
useEffect(() => {
  const supabase = createClient()           // Creates channel outside pooled system
  const channel = supabase.channel(channelName)
  channel.on("postgres_changes", config, handler).subscribe()
  return () => {
    channel.unsubscribe()
    supabase.removeChannel(channel)
  }
}, [table, schema, event, filter, enabled, pauseWhenHidden])
```

Since the sidebar renders on **every page**, this means 2 separate subscription systems are always active.

**Supabase docs reference:**
> "It is highly recommended to clean up channels after you're done with them to prevent resource leaks."

**Fix:** Convert inbox subscription to use the pooled system:

```tsx
// In app-sidebar.tsx - use pooled instead of standalone
usePooledRealtime({
  table: "inbox_items",
  filter: user?.id ? `user_id=eq.${user.id}` : undefined,
  enabled: !!user?.id,
  onInsert: () => setUnreadCount((prev) => prev + 1),
  onUpdate: (item, oldItem) => {
    if (!oldItem.is_read && item.is_read) setUnreadCount((prev) => Math.max(0, prev - 1))
    if (oldItem.is_read && !item.is_read) setUnreadCount((prev) => prev + 1)
  },
  onDelete: (item) => {
    if (!item.is_read) setUnreadCount((prev) => Math.max(0, prev - 1))
  },
})
```

### Issue B: Sidebar Realtime Added Recently (HIGH)

**Commit:** `55b7f60` (~2 weeks ago)

This commit added `usePooledProjectsRealtime` to the sidebar. Before this commit, the sidebar only had the inbox realtime subscription. Now it has two persistent WebSocket subscriptions on every page.

**Diff from commit:**

```diff
+import { usePooledProjectsRealtime } from "@/hooks/realtime-context"
+import { useOrganization } from "@/hooks/use-organization"

+  const { organization } = useOrganization()
+  const [projects, setProjects] = useState<Project[]>(activeProjects)
+
+  useEffect(() => {
+    setProjects(activeProjects)
+  }, [activeProjects])
+
+  usePooledProjectsRealtime(organization?.id, {
+    onInsert: (project) => { /* ... */ },
+    onUpdate: (project, oldProject) => { /* ... */ },
+    onDelete: (oldProject) => { /* ... */ },
+  })
```

Combined with issue #1 (RealtimeProvider context), every subscription connect/disconnect now re-renders the entire app.

### Issue C: Each Subscription Creates Separate `createClient()` Call

**File:** `hooks/realtime-context.tsx:120`

```tsx
if (!subscription) {
  const supabase = createClient()      // Called for each unique subscription key
  const channel = supabase.channel(channelName)
  // ...
  subscription = {
    channel,
    client: supabase,                  // Stored per-subscription
    listeners: new Map(),
    table,
    filter,
  }
}
```

While the browser client is a singleton (returns the same instance from `lib/supabase/client.ts`), storing it per-subscription in `SubscriptionState` is redundant.

**Fix:** Use a single ref for the Supabase client:

```tsx
const supabaseRef = useRef(createClient())

// Then in subscribe:
const channel = supabaseRef.current.channel(channelName)
```

---

## 7. Middleware

**Status: MOSTLY GOOD**

**File:** `middleware.ts`

### What's Done Right

- **Fast-path:** No auth cookie → redirect without any Supabase call (saves ~300-500ms)
- **Prefetch skip:** `isPrefetchRequest()` skips `getUser()` for browser link preloads
- **KV session caching:** Recently validated sessions skip `getUser()` for 5 minutes
- **CSP nonce:** Per-request nonce generation for Content Security Policy
- **Root redirect:** `"/"` rewritten to `/inbox` without round trip

```tsx
// Fast path: No auth cookie → skip all Supabase calls
if (!hasAuthCookie(request)) {
  if (!isPublic) return applyCSP(redirectTo(request, "/login", { redirect: pathname }), cspHeaderValue)
  return applyCSP(NextResponse.next({ request: { headers: requestHeaders } }), cspHeaderValue)
}

// Skip getUser() for prefetch requests
if (isPrefetchRequest(request)) {
  return applyCSP(NextResponse.next({ request: { headers: requestHeaders } }), cspHeaderValue)
}
```

**Next.js docs reference:**
> "Read session data from cookies to perform checks without hitting the database, which is crucial for performance on prefetched routes."

### Minor Issue: Double Auth Validation

The middleware calls both `getSession()` (line 171) AND `getUser()` (line 194) on KV cache miss. Since the middleware already refreshes the session via `getSession()`, and the layout uses `cachedGetUser()` which also calls `getSession()`, the `getUser()` in middleware provides an additional security check but adds ~300-500ms.

```tsx
// Line 171 - fast local cookie read
const { data: { session } } = await supabase.auth.getSession()

// Line 189 - check KV cache
if (sessionUserId && await tryKVSessionCheck(sessionUserId)) {
  return applyCSP(supabaseResponse, cspHeaderValue)
}

// Line 194 - expensive network call (~300-500ms) on KV cache miss
const { data: { user } } = await supabase.auth.getUser()
```

This is an intentional security pattern (the docs recommend `getUser()` for server-side validation). The KV cache prevents this from hitting on most requests. **Acceptable tradeoff.**

---

## 8. Component Composition

**Status: GOOD - No issues**

Pages follow the recommended Next.js pattern correctly:

**Next.js docs reference:**
> "Use Server Components for data fetching and initial rendering, then pass down props or children to Client Components."

```tsx
// Server Component page fetches data
export default async function Page() {
  const { orgId } = await getPageOrganization()
  const projectsPromise = getCachedProjects(orgId)
  const clientsPromise = getCachedClients(orgId)

  return (
    <Suspense fallback={<ProjectsListSkeleton />}>
      <ProjectsListStreamed
        projectsPromise={projectsPromise}
        clientsPromise={clientsPromise}
        orgId={orgId}
      />
    </Suspense>
  )
}

// Async Server Component awaits promises
async function ProjectsListStreamed({ projectsPromise, clientsPromise, orgId }) {
  const [projectsResult, clientsResult] = await Promise.all([projectsPromise, clientsPromise])
  return <ProjectsContent initialProjects={projectsResult.data ?? []} ... />
}
```

**RSC serialization optimization is also correct:**

```tsx
// Map to minimal shapes to reduce RSC serialization payload
const members = (membersResult.data || []).map(m => ({
  id: m.id,
  user_id: m.user_id,
  role: m.role,
  profile: {
    id: m.profile?.id ?? "",
    full_name: m.profile?.full_name ?? null,
    email: m.profile?.email ?? "",
    avatar_url: m.profile?.avatar_url ?? null,
  },
}))
```

**Next.js docs reference:**
> "Pass Server Component as Child to Client Component... This illustrates the interleaving of server and client rendering."

The sidebar uses this pattern correctly with `<SidebarWithData>` as a Suspense-wrapped async Server Component inside the client-side `<SidebarProvider>`.

---

## 9. Bundle Size & Lazy Loading

**Status: GOOD - No issues**

### `optimizePackageImports` (20+ Libraries)

**File:** `next.config.mjs:126-153`

```javascript
experimental: {
  optimizePackageImports: [
    'lucide-react', '@phosphor-icons/react', 'date-fns',
    '@radix-ui/react-icons', 'react-day-picker', 'recharts',
    '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
    '@tiptap/react', '@tiptap/starter-kit',
    '@tiptap/extension-placeholder', '@tiptap/extension-task-item', '@tiptap/extension-task-list',
    'motion/react', 'motion/react-m', 'react-hook-form', 'sonner',
    'class-variance-authority', 'cmdk', 'react-markdown', 'remark-gfm',
    'swr', '@tanstack/react-virtual', 'zod', '@hookform/resolvers',
  ],
}
```

**Next.js docs reference:**
> "This feature helps optimize client-side bundles by automatically removing unused package imports."

### Lazy Loading (Correct Usage)

```tsx
// Analytics wrapper - lazy loaded after hydration
const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false }
)

// Sentry Replay - lazy loaded via requestIdleCallback (~100KB deferred)
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const loadReplay = () => {
    Sentry.lazyLoadIntegration("replayIntegration").then((replay) => {
      Sentry.addIntegration(replay())
    })
  }
  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadReplay)
  } else {
    setTimeout(loadReplay, 3000)
  }
}
```

**Next.js docs reference:**
> "Use `next/dynamic` to lazy load Client Components. It shows immediate loading in a separate bundle, on-demand loading based on state, and client-side-only loading."

### Hover-Based Component Preloading

```tsx
// Sidebar preloads component code on hover
const preloadHandlers: Record<NavItemId, () => void> = {
  inbox: () => { void import("@/components/inbox/InboxContent") },
  "my-tasks": () => { void import("@/components/tasks/MyTasksPage") },
  projects: () => { void import("@/components/projects-content") },
  // ...
}
```

---

## 10. Image Optimization

**Status: GOOD - No issues**

**File:** `next.config.mjs:52-72`

```javascript
images: {
  formats: ['image/avif', 'image/webp'],  // AVIF first (20-50% smaller than WebP)
  minimumCacheTTL: 86400,                  // 24 hours
  remotePatterns: [
    { protocol: 'https', hostname: 'lazhmdyajdqbnxxwyxun.supabase.co', pathname: '/storage/v1/object/public/**' },
    { protocol: 'https', hostname: '*.googleusercontent.com' },
    { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
  ],
}
```

**Next.js docs reference:**
> "Optimize images with the built-in next/image component. This component automatically handles image optimization, such as resizing, format conversion, and lazy loading."

Font loading uses `display: "swap"` for both Geist and Geist_Mono fonts, preventing invisible text during font load.

---

## 11. Security Headers

**Status: GOOD - No issues**

**File:** `next.config.mjs:74-122` and `middleware.ts:57-73`

```javascript
// next.config.mjs - static headers
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
]

// middleware.ts - dynamic CSP with per-request nonce
function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co ...",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co ...",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}
```

**Next.js docs reference:**
> Security headers can be configured using `headers()` in `next.config.js`. For immutable assets, Next.js sets `Cache-Control: public, max-age=31536000, immutable`.

Cache headers are correctly configured:
- `/_next/static` → `immutable` (31536000s)
- `/_next/image` → 24h with stale-while-revalidate
- Auth pages → `no-cache` (allows bfcache)

---

## 12. Priority Fix List

| # | Issue | Severity | File(s) | Impact |
|---|-------|----------|---------|--------|
| 1 | RealtimeProvider context value not memoized | **CRITICAL** | `hooks/realtime-context.tsx` | Re-renders entire app tree on every subscription status change |
| 2 | Sidebar uses standalone `useInboxRealtime` instead of pooled | **CRITICAL** | `components/app-sidebar.tsx` | Duplicate WebSocket system always active on every page |
| 3 | Sidebar realtime subscription added recently | **HIGH** | `components/app-sidebar.tsx` | Persistent WebSocket overhead, compounds issue #1 |
| 4 | `globals.css` has 12 themes inlined (~950 lines of dead CSS) | **HIGH** | `app/globals.css` | Every page parses CSS for 11 unused themes |
| 5 | `getTasks` returns ALL rows without `.limit()` | **HIGH** | `lib/actions/tasks/queries.ts` | Massive payloads for large projects |
| 6 | `SELECT *` in sidebar, projects, tasks, inbox queries | **MEDIUM** | `layout.tsx`, `crud.ts`, `queries.ts`, `inbox.ts` | Over-fetching data in hot paths |
| 7 | SWR `revalidateOnFocus: true` with realtime subscriptions | **MEDIUM** | `components/providers/swr-provider.tsx` | Redundant request bursts on tab switch |
| 8 | `staleTimes.dynamic: 180` is aggressive | **LOW** | `next.config.mjs` | May show stale data for 3 minutes |

### Implementation Order

1. **Fix #1** (RealtimeProvider) — Biggest impact, simplest fix (add `useMemo`)
2. **Fix #2** (Sidebar inbox subscription) — Switch to pooled system
3. **Fix #7** (SWR revalidateOnFocus) — One-line change
4. **Fix #5** (getTasks limit) — Add `.limit(500)`
5. **Fix #6** (SELECT * queries) — Replace with explicit column lists
6. **Fix #4** (CSS themes) — Extract into separate files
7. **Fix #8** (staleTimes) — Reduce to 30s

### What's Already Done Well (No Changes Needed)

- Project structure and routing conventions
- Server/Client component composition
- Suspense streaming with parallel data fetching
- Request-level caching with `React.cache()`
- KV caching with stale-while-revalidate
- Unified cache invalidation helpers
- Bundle optimization with `optimizePackageImports`
- Lazy loading (Sentry Replay, Analytics, SpeedInsights)
- Hover-based component preloading
- Image optimization (AVIF/WebP, remote patterns)
- Security headers and CSP
- Middleware fast-paths (cookie check, prefetch skip, KV session cache)
- Font loading with `display: "swap"`
- `loading.tsx` coverage for all dashboard routes
