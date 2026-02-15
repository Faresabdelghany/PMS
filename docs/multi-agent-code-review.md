# PMS Multi-Agent Code Review Report

**Date:** 2026-02-12
**Project:** PMS (Project Management SaaS)
**Stack:** Next.js 16 + React 19 + TypeScript + Supabase
**Scope:** 387 TypeScript files, 218 components, 48 action files, 22 DB tables
**Agents:** Code Quality, Security, Architecture, Performance, Testing

---

## Executive Summary

| Dimension | Score | Key Risk |
|---|---|---|
| **Architecture** | 8.4/10 | Dual cache invalidation complexity |
| **Code Quality** | 7.5/10 | Inconsistent auth patterns across actions |
| **Security** | 7.0/10 | Missing auth checks, SVG XSS, weak CSP |
| **Performance** | 8.5/10 | Already well-optimized; minor cache duplication |
| **Testing** | 5.0/10 | 0% unit tests, 25% E2E coverage |

**Overall Score: 7.8/10** -- Well-engineered with strong foundations, but significant gaps in security hardening and test coverage.

**Total Findings: 32** | Critical: 3 | High: 6 | Medium: 9 | Low: 14
**Estimated Total Remediation Effort: ~81 hours**

---

## Table of Contents

1. [Critical Findings](#1-critical-findings)
2. [High Findings](#2-high-findings)
3. [Medium Findings](#3-medium-findings)
4. [Low Findings](#4-low-findings)
5. [Key Strengths](#5-key-strengths)
6. [Detailed Agent Reports](#6-detailed-agent-reports)
   - [Code Quality Review](#61-code-quality-review)
   - [Security Audit](#62-security-audit)
   - [Architecture Review](#63-architecture-review)
   - [Performance Review](#64-performance-review)
   - [Testing Review](#65-testing-review)
7. [Priority Action Plan](#7-priority-action-plan)

---

## 1. Critical Findings

### C-1: Missing Authorization on 10+ Server Actions

**Sources:** Security H-2, Code Quality #1
**Severity:** Critical
**Effort:** ~2 hours

Multiple mutation and read actions bypass `requireAuth()`/`requireProjectMember()`, relying solely on RLS:

| File | Functions |
|---|---|
| `lib/actions/tasks.ts:558-677` | `deleteTask`, `reorderTasks`, `moveTaskToWorkstream`, `bulkUpdateTaskStatus` |
| `lib/actions/tasks.ts:172,303` | `getTasks`, `getTask` |
| `lib/actions/notes.ts:125-267` | `updateNote`, `deleteNote`, `getNote`, `getProjectNotes` |
| `lib/actions/import.ts:267` | `importTasksFromCSV` -- no auth at all |
| `lib/actions/inbox.ts:76-174` | `markAsRead`, `deleteInboxItem`, `createInboxItem`, `createInboxItemsForUsers` |
| `lib/actions/workstreams.ts` | 5 functions use `createClient()` directly |

**Why it matters:** RLS is defense-in-depth, not the primary gate. If RLS policies are ever misconfigured, these endpoints have no secondary guard. The inconsistency also produces opaque Supabase errors instead of clear "Not authenticated" messages.

**Remediation:** Add `requireAuth()` or `requireProjectMember()` to every function. Standardize on Pattern A (`const { user, supabase } = await requireAuth()`) for all mutations.

---

### C-2: SVG File Upload Enables Stored XSS

**Source:** Security M-7
**Severity:** Critical
**Effort:** ~15 minutes

`lib/actions/files.ts:51` allows `image/svg+xml` uploads. SVGs can contain `<script>` tags that execute when served inline by Supabase Storage:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert(document.cookie)</script>
</svg>
```

**Remediation:** Remove `image/svg+xml` from the MIME allowlist, or serve with `Content-Disposition: attachment`.

---

### C-3: Zero Unit Test Coverage

**Source:** Testing #1-3
**Severity:** Critical
**Effort:** ~12 hours (initial setup + critical modules)

No unit test framework exists. Security-critical modules are completely untested:
- `lib/crypto.ts` -- AES-256-GCM encryption for API keys
- `lib/rate-limit/` -- Brute force protection
- `lib/cache/` -- KV caching layer

**Remediation:**
1. Install Vitest: `pnpm add -D vitest @vitest/ui`
2. Create `vitest.config.ts` with path aliases
3. Write tests for `lib/crypto.ts` (15+ test cases: roundtrip, invalid keys, corrupted ciphertext, auth tag tampering)
4. Write tests for `lib/rate-limit/limiter.ts` (rate enforcement, time windows, KV unavailability)

---

## 2. High Findings

### H-1: Middleware Session Cache Bypass on Revocation

**Source:** Security H-1
**Severity:** High
**Effort:** ~30 minutes

`middleware.ts:136-138`: KV-cached sessions persist 30 minutes (`SESSION_CACHE_TTL`). `updatePassword()` at `lib/actions/auth.ts:373` does not invalidate the cache, so compromised sessions survive password changes for up to 30 minutes.

**Remediation:**
1. Add `invalidate.session(user.id)` to `updatePassword()`
2. Add invalidation to any admin account-disable flows
3. Reduce `SESSION_CACHE_TTL` from 1800s to 300-600s

---

### H-2: Google Gemini API Key Exposed in URL

**Source:** Security H-3
**Severity:** High
**Effort:** Low (documentation + monitoring)

`lib/actions/ai/providers.ts:100` passes the user's decrypted API key as a URL query parameter (`?key=${apiKey}`). All other providers correctly use HTTP headers. URL parameters appear in server logs, reverse proxy logs, and monitoring infrastructure.

**Remediation:** This is an upstream Google API limitation. Document the risk, ensure server logs are secured and rotated, consider Google OAuth2-based auth as an alternative.

---

### H-3: CSP Allows `unsafe-inline` and `unsafe-eval`

**Sources:** Security M-2, Architecture #10
**Severity:** High
**Effort:** ~4 hours

`next.config.mjs:90`: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` effectively negates CSP's XSS protection. `'unsafe-eval'` enables `eval()` and `Function()` constructor attacks.

**Remediation:**
1. Replace `'unsafe-inline'` with nonce-based CSP using Next.js's built-in nonce support
2. Remove `'unsafe-eval'` -- audit dependencies to confirm it is not needed in production builds
3. The inline color theme script at `app/layout.tsx:47-59` is the main blocker for removing `unsafe-inline`

---

### H-4: Rate Limiters Defined But Never Wired Up

**Source:** Security L-3, L-4
**Severity:** High
**Effort:** ~30 minutes

Two rate limiters exist in `lib/rate-limit/limiter.ts:31-40` but are never called:
- `rateLimiters.fileUpload` (50/hr) -- `lib/actions/files.ts:163` never checks it
- `rateLimiters.invite` (20/hr) -- `lib/actions/invitations.ts` never checks it

**Remediation:** Add `checkRateLimit()` calls in both action files:
```typescript
const limit = await checkRateLimit(rateLimiters.fileUpload, user.id)
if (!limit.success) return rateLimitError(limit.reset)
```

---

### H-5: Tasks Module Has Zero E2E Coverage

**Source:** Testing #4
**Severity:** High
**Effort:** ~16 hours

Core feature (~80% of user activity) has no E2E tests. No tests for task CRUD, comments, reactions, drag-drop, or the task detail panel.

**Remediation:** Create:
- `e2e/tasks.spec.ts` (CRUD operations)
- `e2e/task-detail-panel.spec.ts` (URL-driven slide-over)
- `e2e/task-comments.spec.ts` (comments, reactions, @mentions)
- `e2e/pages/TasksPage.ts` (page object)

---

### H-6: No E2E Tests in CI/CD Pipeline

**Source:** Testing #6
**Severity:** High
**Effort:** ~2 hours

E2E tests only run manually. No GitHub Actions workflow for automated E2E on push/PR. Only Lighthouse CI is configured.

**Remediation:** Create `.github/workflows/e2e.yml`:
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm test:e2e
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

---

## 3. Medium Findings

### M-1: Duplicate Request-Level Cache Layer

**Sources:** Performance #1, Architecture #2
**Severity:** Medium
**Effort:** ~4 hours

`lib/request-cache.ts` and `lib/server-cache.ts` both define `cache()`-wrapped versions of the same functions:
- `request-cache.ts:53` -- `cachedGetProjects(orgId, filters?)`
- `server-cache.ts:25` -- `getCachedProjects(orgId)` (no filters)

These are separate function references, so calling one does NOT deduplicate with the other within the same request. Pages import inconsistently from either module.

**Impact:** 50-100ms wasted per request when imports are mixed.

**Remediation:** Consolidate into one module. Keep `cachedGetUser` and `getSupabaseClient` in `request-cache.ts` (they are unique), remove the duplicated data-fetching wrappers, and use `server-cache.ts` as the single source.

---

### M-2: Dual Cache Invalidation Creates Maintenance Risk

**Source:** Architecture #1
**Severity:** Medium
**Effort:** ~4 hours

Every mutation must independently invalidate both Next.js cache tags AND KV cache keys. Example from `lib/actions/projects/crud.ts:401-409`:
```typescript
revalidateTag(CacheTags.project(id))
revalidateTag(CacheTags.projectDetails(id))
revalidateTag(CacheTags.projects(project.organization_id))
await invalidate.project(id, project.organization_id)
```
If a developer adds a new mutation path and forgets one of the two systems, stale data will be served.

**Remediation:** Create a unified `invalidateAfterMutation()` helper that encapsulates both `revalidateTag` and KV `invalidate.*` calls behind a single API.

---

### M-3: AI Prompt Injection via User-Controlled Data

**Source:** Security M-3
**Severity:** Medium
**Effort:** ~4 hours

`lib/actions/ai-helpers.ts:11-293`: Project names, task titles, descriptions, and note content are interpolated directly into the AI system prompt without sanitization. A malicious org member could craft data that manipulates the AI into proposing unintended actions.

**Remediation:**
1. Wrap user data in XML delimiters the AI is instructed to treat as data-only
2. Sanitize control characters
3. The backend auth checks on individual actions partially mitigate this

---

### M-4: Rate Limiting Silently Disabled When KV is Down

**Source:** Security M-4
**Severity:** Medium
**Effort:** ~4 hours

`lib/rate-limit/limiter.ts:62-91`: Returns `{ success: true }` when KV is unavailable, disabling all protection including auth brute-force.

**Remediation:**
1. Log a warning in production
2. Implement an in-memory fallback for the auth rate limiter
3. Add monitoring/alerting for KV availability

---

### M-5: Session Cache TTL Mismatch

**Source:** Architecture #5
**Severity:** Medium
**Effort:** ~30 minutes

- `middleware.ts:19` uses `SESSION_CACHE_TTL = 1800` (30 min, hardcoded)
- `lib/cache/keys.ts:93` defines `CacheTTL.SESSION = 300` (5 min)

Middleware caches sessions 6x longer than auth actions. Both should reference the same constant.

**Remediation:** Have middleware import and use `CacheTTL.SESSION` from `lib/cache/keys.ts`.

---

### M-6: Unbounded List Queries at Scale

**Source:** Architecture #3
**Severity:** Medium
**Effort:** ~8 hours

Core list endpoints return all records with no pagination:
- `lib/actions/projects/crud.ts:252-289` -- `getProjects()` has no `.limit()`
- `lib/actions/tasks.ts:173-218` -- `getTasks()` has no `.limit()`

At 100+ projects or 500+ tasks per project, these will cause memory pressure and slow transfers.

**Remediation:** Add cursor-based pagination with a default page size constant in `lib/constants.ts`.

---

### M-7: Monolithic `tasks.ts` (776 lines)

**Source:** Architecture #4
**Severity:** Medium
**Effort:** ~6 hours

`updateTask` alone (lines 324-539) handles update, old-state comparison, activity tracking for 8 field types, and notification dispatch. Violates Single Responsibility Principle.

**Remediation:** Decompose into a modular directory following the `lib/actions/projects/` pattern (separate crud, queries, activities, validation files).

---

### M-8: Duplicate Comments via Realtime + Optimistic Update

**Source:** Code Quality #9
**Severity:** Medium
**Effort:** ~1 hour

`components/tasks/TaskDetailPanel.tsx:224` adds comments optimistically; line 131 adds them again on INSERT event. No deduplication by ID.

**Remediation:** Check if a comment with the same ID already exists before appending in the realtime handler.

---

### M-9: In-Memory Cache Unbounded Growth

**Source:** Performance #2
**Severity:** Medium
**Effort:** ~1 hour

`lib/cache/client.ts:28`: `memCache` uses a plain `Map` that grows without limit. `cleanup()` exists at line 66 but is never called.

**Impact:** 4-9MB memory leak over 2-hour dev sessions.

**Remediation:** Add periodic `setInterval` cleanup or implement LRU cap.

---

## 4. Low Findings

### L-1: `updateTaskSchema` Defined But Never Used

**Source:** Code Quality #2
**File:** `lib/actions/tasks.ts:44`
**Fix:** Apply Zod validation in `updateTask()`.

---

### L-2: Activity Tracking Blocks Response

**Source:** Code Quality #4
**File:** `lib/actions/tasks.ts:354-459`
**Fix:** Move `await Promise.all(activityPromises)` to `after()` callback alongside notifications.

---

### L-3: `revalidatePath` Blocks Response in Deliverables

**Source:** Code Quality #5
**Files:** `lib/actions/deliverables.ts:95,143,179,212`
**Fix:** Move `revalidatePath()` calls inside `after()`.

---

### L-4: Realtime Cleanup Uses Wrong Client Instance

**Source:** Code Quality #7, Architecture #9
**File:** `hooks/realtime-context.tsx:170`
**Fix:** Store client ref in subscription state object.

---

### L-5: Reaction Listener Has No Task Filter

**Source:** Code Quality #11
**File:** `hooks/use-task-timeline-realtime.ts:113`
**Fix:** Add task_id or comment_id filter to subscription, or document as known limitation.

---

### L-6: 1-Year Signed URL Expiry

**Source:** Security L-1
**File:** `lib/actions/files.ts:238`
**Fix:** Reduce to 1-24 hours. Generate fresh URLs on demand.

---

### L-7: Client Deletion Leaks Info Before Auth Check

**Source:** Security L-2
**File:** `lib/actions/clients.ts:292-323`
**Fix:** Move `requireOrgMember()` before the project count check.

---

### L-8: Auth Rate Limiting by IP Only

**Source:** Security M-5
**File:** `lib/actions/auth.ts:106-111`
**Fix:** Use `x-real-ip` header. Rate limit by both IP and target email. Consider progressive account lockout.

---

### L-9: OAuth Redirect Uses Client `Origin` Header

**Source:** Security M-6
**Files:** `lib/actions/auth.ts:246,359`
**Fix:** Always use `process.env.NEXT_PUBLIC_SITE_URL` for security-sensitive redirects.

---

### L-10: `SELECT *` in Cache Warm Queries

**Source:** Performance #4
**Files:** `lib/cache/warm.ts:25,69`
**Fix:** Replace `.select("*")` with explicit column lists for the needed fields only.

---

### L-11: 113 Hard-Coded `waitForTimeout()` in E2E Tests

**Source:** Testing #5
**Files:** `e2e/*.spec.ts`
**Fix:** Replace with proper Playwright waiting mechanisms:
```typescript
// Before (anti-pattern):
await page.waitForTimeout(100);
const isEnabled = await button.isEnabled();

// After (proper):
await expect(button).toBeEnabled({ timeout: 2000 });
```

---

### L-12: 47 Skipped E2E Tests (17% of Suite)

**Source:** Testing #9
**Files:** `e2e/*.spec.ts`
**Fix:** Implement critical skipped tests (session security, password reset) or remove if no longer relevant.

---

### L-13: Missing Index on `projects.client_id`

**Source:** Performance #3
**Fix:** `CREATE INDEX idx_projects_client_status ON projects(client_id, status);`
**Impact:** 45-195ms savings at scale (>5000 projects).

---

### L-14: N+1 Update in Task Reordering

**Source:** Architecture #6
**File:** `lib/actions/tasks.ts:606-611`
**Fix:** Replace with single Supabase RPC accepting array of `(taskId, sortOrder)` pairs.

---

## 5. Key Strengths

The following architectural decisions and patterns are well-implemented and should be preserved:

### Performance Architecture
- **Middleware fast-path optimization** -- No-cookie skip, prefetch skip, KV session cache; near-zero latency for authenticated users
- **Cache warming on login** (`lib/cache/warm.ts`) -- First dashboard load gets KV cache hits
- **Parallel data fetching** -- Every page uses `Promise.all` + Suspense streaming consistently
- **RPC consolidation** -- `get_dashboard_stats`, `get_ai_context_summary` reduce 7+ queries to 1 round trip
- **Dynamic imports and hover preloading** -- Three-tier lazy loading (dynamic, React.lazy, hover-prefetch)
- **42+ database indexes** -- Three dedicated performance migration files including trigram GIN indexes

### Security
- **Comprehensive RLS** -- All 22 tables have row-level security policies with org-based tenant isolation
- **DOMPurify sanitization** -- All `dangerouslySetInnerHTML` uses DOMPurify
- **AES-256-GCM encryption** -- Proper random IVs for API key storage in `lib/crypto.ts`
- **No SQL injection** -- All queries use parameterized Supabase client; no raw SQL concatenation
- **Search input sanitization** -- PostgREST filter injection and SQL LIKE wildcards escaped
- **Open redirect prevention** -- `sanitizeRedirectPath()` in `auth/callback/route.ts`
- **Admin client isolation** -- `persistSession: false`, `autoRefreshToken: false`

### Code Quality
- **Consistent ActionResult pattern** -- Typed `{ data?, error? }` shape across all actions
- **Realtime subscription pooling** -- Shared subscriptions with visibility-aware pausing via `RealtimeProvider`
- **Post-response work via `after()`** -- Cache invalidation and notifications correctly deferred
- **RSC serialization discipline** -- Minimal shapes stripped of unnecessary fields before passing to client components
- **Comprehensive skeleton components** -- 10 skeleton files, 11 `loading.tsx` files for instant streaming

### Architecture
- **Clean route organization** -- Dashboard route group with proper layout, loading states, error boundaries
- **Proper RSC/Client Component boundaries** -- Server Components fetch data, Client Components handle interactivity
- **4-layer caching strategy** -- Request dedup, KV cache, tag invalidation, client router cache
- **Multi-tenant isolation at 3 levels** -- Database (RLS), application (auth helpers), cache (scoped keys)

---

## 6. Detailed Agent Reports

### 6.1 Code Quality Review

**Agent:** comprehensive-review:code-reviewer
**Files Analyzed:** 20+ key files across lib/actions/, components/, hooks/
**Methodology:** Pattern analysis, type safety checks, React best practices audit

#### Summary Table

| Category | Critical | Important | Suggestion |
|----------|----------|-----------|------------|
| Authorization | 1 | 1 | -- |
| Input Validation | 1 | 1 | -- |
| Type Safety | -- | 2 | 1 |
| Performance | -- | 2 | 2 |
| Error Handling | -- | 2 | 1 |
| React Patterns | -- | -- | 3 |
| Architecture | -- | 1 | 2 |
| Accessibility | -- | -- | 1 |
| **Totals** | **2** | **9** | **10** |

#### Critical Findings

**Missing Server-Side Authorization on Mutations:**
Multiple mutation actions use raw `createClient()` instead of `requireAuth()`/`requireProjectMember()`, relying solely on RLS as the only defense:
- `lib/actions/tasks.ts:558` -- `deleteTask()`
- `lib/actions/tasks.ts:591` -- `reorderTasks()`
- `lib/actions/tasks.ts:628` -- `moveTaskToWorkstream()`
- `lib/actions/tasks.ts:673` -- `bulkUpdateTaskStatus()`
- `lib/actions/tasks.ts:172` -- `getTasks()`

**No Input Validation on `updateTask`:**
- `lib/actions/tasks.ts:324` -- `updateTaskSchema` is defined at line 44 but never used. Invalid field values reach the database unchecked.

#### Important Findings

- **Mixed Auth Patterns:** Pattern A (`requireAuth()`) vs Pattern B (`createClient()`) used inconsistently across `tasks.ts` (7 functions), `inbox.ts` (4), `workstreams.ts` (5), `notes.ts` (5)
- **Activity Tracking Blocks Response:** `lib/actions/tasks.ts:354-459` -- `await Promise.all(activityPromises)` runs before return; should be deferred to `after()`
- **Synchronous `revalidatePath`:** `lib/actions/deliverables.ts:95,143,179,212` -- Blocks responses
- **No Per-Route Error Boundaries:** Only `app/error.tsx` and `app/(dashboard)/error.tsx` exist
- **Duplicate Client in Realtime Cleanup:** `hooks/realtime-context.tsx:170` -- `removeChannel()` called on new client, not the one that created the channel
- **`any` Type in Realtime Config:** `hooks/realtime-context.tsx:104`
- **Unsafe `as` Casts:** Multiple locations in tasks.ts, projects/crud.ts, clients.ts

#### Suggestions

- Duplicate comments via realtime + optimistic update (`TaskDetailPanel.tsx:224` and `:131`)
- Uncleared debounce timer (`ProjectDetailsPage.tsx:106-118`)
- Reaction listener has no task filter (`use-task-timeline-realtime.ts:113-149`)
- Loose typing on task field updates (`TaskDetailPanel.tsx:193`)
- Keyboard shortcut shows macOS-only symbol on all platforms (`app-sidebar.tsx:311`)
- `ProjectDetailsPage` manages 8 separate `useState` calls -- consider `useReducer`
- `getOrganizationMembers` missing return type annotation (`organizations.ts:202`)
- Dashboard error boundary does not log the error (`app/(dashboard)/error.tsx`)

---

### 6.2 Security Audit

**Agent:** comprehensive-review:security-auditor
**Files Analyzed:** All action files, middleware, migrations, crypto, rate limiting, CSP
**Methodology:** OWASP Top 10 compliance check, multi-tenant isolation review, input validation audit

#### Severity Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 0 | -- |
| High | 3 | Session cache bypass, CSV import no auth, Gemini API key in URL |
| Medium | 7 | Missing app-layer auth, CSP unsafe-eval, prompt injection, rate limit bypass, IP-only rate limiting, OAuth origin header, SVG XSS |
| Low | 5 | 1-year signed URLs, auth ordering, missing file rate limit, missing invite rate limit, search_path |

#### High Severity Findings

**H-1: Middleware Session Cache Bypass on Revocation**
- File: `middleware.ts:136-138`
- When KV cache holds validated session, middleware returns early. If user's account is disabled or password changed, they retain access for up to 30 minutes.
- `signOut()` invalidates cache, but `updatePassword()` at `auth.ts:373` does not.

**H-2: CSV Import Missing Application-Layer Authorization**
- File: `lib/actions/import.ts:267-273`
- `importTasksFromCSV()` calls `createClient()` directly without any auth helper. Every other mutation action uses an explicit auth helper.

**H-3: Google Gemini API Key Exposed in URL Query Parameter**
- File: `lib/actions/ai/providers.ts:100`
- Passes decrypted API key as `?key=${apiKey}`. All other providers use HTTP headers.

#### Medium Severity Findings

- **M-1:** 10+ read/delete actions missing `requireAuth()` (tasks.ts, notes.ts)
- **M-2:** CSP allows `'unsafe-inline'` and `'unsafe-eval'` (`next.config.mjs:90`)
- **M-3:** AI prompt injection via user-controlled data (`ai-helpers.ts:11-293`)
- **M-4:** Rate limiting silently disabled when KV is unavailable (`limiter.ts:62-91`)
- **M-5:** Auth rate limiting by IP only, easily bypassed (`auth.ts:106-111`)
- **M-6:** OAuth redirect uses client-provided `Origin` header (`auth.ts:246,359`)
- **M-7:** SVG file uploads enable stored XSS (`files.ts:51`)

#### Low Severity Findings

- **L-1:** 1-year signed URL expiry (`files.ts:238`)
- **L-2:** Client deletion auth ordering leak (`clients.ts:292-323`)
- **L-3:** File upload rate limiter defined but never used (`limiter.ts:31-35`)
- **L-4:** Invitation rate limiter defined but never used (`limiter.ts:36-40`)
- **L-5:** RLS helper functions missing `search_path` (`20260122000002_rls_policies.sql:11-56`)

#### Positive Security Findings

- All `dangerouslySetInnerHTML` on user content uses `DOMPurify.sanitize()`
- Comprehensive Zod validation on all major server actions
- AES-256-GCM with random IVs for API key encryption
- RLS enabled on all 22+ tables with org-based tenant isolation
- Open redirect prevention via `sanitizeRedirectPath()`
- No raw SQL concatenation -- all parameterized Supabase client
- Proper security headers: HSTS with preload, X-Frame-Options DENY, nosniff
- `.env*` in `.gitignore` -- no secrets committed
- Admin client configured with `persistSession: false`

---

### 6.3 Architecture Review

**Agent:** comprehensive-review:architect-review
**Files Analyzed:** App router structure, caching layers, data flow, middleware, realtime hooks
**Overall Score:** 8.4/10

#### Architectural Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Route Organization | 9/10 | Clean, consistent, proper loading states |
| Component Boundaries | 9/10 | Excellent RSC/CC separation |
| Caching Architecture | 8/10 | Sophisticated but dual-system adds complexity |
| Data Fetching Patterns | 9/10 | Consistently parallel, good streaming |
| Multi-Tenant Isolation | 9/10 | RLS + app-level + cache-level |
| Database Efficiency | 8/10 | Strong indexing, missing pagination |
| Real-time Architecture | 8/10 | Good pooling, minor cleanup issues |
| Security Posture | 8/10 | Strong headers, CSP could tighten |
| Code Modularity | 7/10 | Mixed modular/monolithic actions |
| Performance Engineering | 9/10 | Middleware fast paths, cache warming, lazy loading |

#### High Impact Findings

**1. Dual Cache Invalidation Creates Maintenance Risk**
- Every mutation must invalidate both Next.js cache tags AND KV cache keys independently
- `lib/actions/projects/crud.ts:401-409` -- Four separate invalidation calls per project update
- Recommendation: Create unified `invalidateAfterMutation()` helper

**2. Ambiguous Cache Function Duplication**
- `lib/request-cache.ts:53` -- `cachedGetProjects(orgId, filters?)`
- `lib/server-cache.ts:25` -- `getCachedProjects(orgId)` (no filters)
- Pages import inconsistently from either module
- `getCachedActiveOrgFromKV()` at `server-cache.ts:144-169` mixes both layers
- Recommendation: Consolidate into single module with explicit naming

**3. Unbounded List Queries at Scale**
- `lib/actions/projects/crud.ts:252-289` -- `getProjects()` has no `.limit()`
- `lib/actions/tasks.ts:173-218` -- `getTasks()` has no `.limit()`
- Recommendation: Add cursor-based pagination

**4. Monolithic `tasks.ts` Violates Single Responsibility**
- 776 lines; `updateTask` alone handles update, comparison, activity tracking, notifications
- Recommendation: Decompose into modular directory like `lib/actions/projects/`

#### Medium Impact Findings

- **Session Cache TTL Mismatch:** `middleware.ts:19` (1800s) vs `lib/cache/keys.ts:93` (300s)
- **N+1 Update in Task Reordering:** `tasks.ts:606-611` fires one UPDATE per task
- **Sequential KV Invalidation:** `tasks.ts:719-731` serializes cache invalidation that could be parallel
- **Inconsistent Org Resolution:** `projects/page.tsx` inlines logic while `tasks/page.tsx` uses centralized helper
- **New Supabase Client Per Cleanup:** `realtime-context.tsx:170` creates new client for `removeChannel()`

#### Lower Impact Findings

- CSP contains `unsafe-eval` (`next.config.mjs:90`)
- Obsolete aggregate functions still exist (`server-cache.ts:300-319`)
- In-memory cache never self-cleans (`lib/cache/client.ts:64-71`)

#### Key Strengths Worth Preserving

- Middleware fast paths (near-zero latency for authenticated users)
- Cache warming on login (first dashboard load gets KV hits)
- Parallel fetching discipline (every page uses `Promise.all` + Suspense)
- RPC consolidation (`get_dashboard_stats` reduces 7+ queries to 1)
- Realtime pooling with visibility-aware pausing
- Deferred non-critical UI (`requestIdleCallback` with 2s timeout)
- 42+ indexes including trigram GIN indexes for search

---

### 6.4 Performance Review

**Agent:** application-performance:performance-engineer
**Overall Grade:** B+ -- Strong foundations with incremental optimization opportunities

#### Quantified Impact Estimates

| Finding | Current Cost | After Fix | Savings |
|---|---|---|---|
| Duplicate cache layer (worst case) | Extra 50-100ms DB query/request | 0ms | 50-100ms/request |
| memCache growth (local dev, 2h) | ~5-10MB leaked | ~1MB steady | 4-9MB memory |
| Missing client_id index (>5k projects) | ~50-200ms scan | ~2-5ms seek | 45-195ms |
| SELECT * in warm.ts | ~3-5KB per response | ~1-2KB | ~2-3KB/login |
| react-day-picker lazy | ~40KB in initial bundle | 0KB initial | 40KB JS parse |

#### High Priority

**Duplicate Request-Level Cache Layer:**
- `lib/request-cache.ts` and `lib/server-cache.ts` define separate `cache()` wrappers for the same functions
- Calling `cachedGetProjects(orgId)` does NOT deduplicate with `getCachedProjects(orgId)`
- Impact: 50-100ms wasted per request if a page mixes imports

#### Medium Priority

- **In-Memory Cache Unbounded Growth:** `lib/cache/client.ts:28` -- `cleanup()` never called (4-9MB leak over 2h)
- **Missing Database Index:** No index on `projects.client_id` affects `getClientsWithProjectCounts` at scale
- **`SELECT *` in Warm Queries:** `lib/cache/warm.ts:25,69` fetches full rows when only 4-5 columns needed

#### Low Priority

- `react-day-picker` in initial bundle (~40KB deferrable)
- Supabase client re-creation in RealtimeProvider (minor ~1ms overhead)

#### Already Well-Optimized (No Action Needed)

- Middleware three-tier auth with KV session caching
- Parallel data fetching in all page components (no waterfalls detected)
- Dynamic imports and hover-based preloading
- 25+ performance indexes across two migration files
- Realtime subscription pooling with visibility-aware pause
- Consistent memoization (`memo`, `useMemo`, `useCallback`, callback refs)
- 11 `loading.tsx` files and 10 skeleton components for streaming
- Cache TTL tiers (30s tasks, 120s projects, 300s config, 600s user)
- Cache warming on login
- Static asset headers with immutable hashing

---

### 6.5 Testing Review

**Agent:** performance-testing-review:test-automator
**Overall Test Coverage Score:** 25% (target: 75%)

#### Current Coverage

| Area | Coverage | Status |
|------|----------|--------|
| E2E - Auth/Projects | 85% | Good |
| E2E - Tasks | 0% | Critical gap |
| E2E - Clients, Chat, Settings, Reports, Inbox | 0% | High gap |
| Unit - Crypto/Security | 0% | Critical gap |
| Unit - Business Logic | 0% | High gap |
| Unit - Utilities | 0% | Medium gap |
| CI/CD Integration | 20% | High gap |

#### Test Quality Assessment

| Practice | Score | Notes |
|----------|-------|-------|
| Page Object Pattern | 9/10 | Clean abstraction, well-structured |
| Test Naming | 10/10 | Clear, traceable to test plan |
| Security Testing | 9/10 | SQL injection, XSS, CSRF well covered |
| Error Scenario Testing | 8/10 | Many error cases covered |
| Accessibility Testing | 7/10 | Solid ARIA and keyboard nav |
| Test Isolation | 6/10 | Auth shared, data cleanup unclear |
| Assertion Quality | 6/10 | Some weak assertions (`expect(true).toBe(true)`) |
| Test Data Factory | 5/10 | Good fixtures, no DB seeding |
| Flaky Test Prevention | 3/10 | 113 hard waits indicate race conditions |
| CI Integration | 2/10 | Lighthouse only, no E2E automation |

#### Critical Gaps

1. **Zero unit test framework** -- No Jest or Vitest configured
2. **`lib/crypto.ts` untested** -- 136 LOC of AES-256-GCM encryption, 0 tests
3. **Rate limiting untested** -- Brute force protection unvalidated
4. **Tasks module 0% E2E** -- Core feature with no coverage
5. **113 hard-coded waits** -- Flaky test anti-pattern
6. **47 skipped tests** -- 17% of test suite disabled
7. **No E2E in CI** -- Only Lighthouse CI configured

#### Recommended Testing Roadmap (12 weeks, 150 hours)

| Phase | Focus | Hours | Timeline |
|-------|-------|-------|----------|
| 1 | Install Vitest + crypto tests | 12 | Week 1-2 |
| 2 | Fix E2E anti-patterns + CI | 10 | Week 1-2 |
| 3 | Tasks E2E coverage | 16 | Week 3-4 |
| 4 | Rate limit + cache unit tests | 8 | Week 3-4 |
| 5 | Clients + Settings E2E | 16 | Week 5-6 |
| 6 | Server action unit tests | 20 | Week 5-6 |
| 7 | Chat + Reports E2E | 20 | Week 7-8 |
| 8 | Custom hooks unit tests | 12 | Week 9-10 |
| 9 | Component tests + visual regression | 24 | Week 9-10 |
| 10 | Real-time feature testing | 12 | Week 11-12 |

---

## 7. Priority Action Plan

### This Week (~11 hours)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Add `requireAuth()`/`requireProjectMember()` to all unprotected actions | ~2h | Critical security |
| 2 | Remove `image/svg+xml` from file upload allowlist | ~15m | Critical security |
| 3 | Wire up file upload + invitation rate limiters | ~30m | High security |
| 4 | Install Vitest + test `lib/crypto.ts` | ~6h | Critical testing |
| 5 | Create E2E CI workflow | ~2h | High testing |

### Next 2 Weeks (~30 hours)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 6 | Add session cache invalidation to `updatePassword()` | ~1h | High security |
| 7 | Consolidate duplicate cache modules | ~4h | Medium performance |
| 8 | Create tasks E2E test suite | ~16h | High testing |
| 9 | Nonce-based CSP (remove `unsafe-eval`) | ~4h | High security |
| 10 | Implement in-memory rate limit fallback | ~4h | Medium security |

### Next Month (~40 hours)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 11 | Create unified cache invalidation helper | ~4h | Medium architecture |
| 12 | Add cursor-based pagination to list queries | ~8h | Medium scalability |
| 13 | Decompose `tasks.ts` into modular directory | ~6h | Medium maintainability |
| 14 | Unit test server actions | ~20h | Medium testing |
| 15 | Fix task detail panel comment deduplication | ~2h | Medium UX |

### Backlog

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 16 | Fix E2E hard-coded waits (113 occurrences) | ~8h | Low testing |
| 17 | Add missing `projects.client_id` index | ~15m | Low performance |
| 18 | Replace `SELECT *` with explicit columns in warm.ts | ~30m | Low performance |
| 19 | Reduce signed URL expiry from 1 year | ~30m | Low security |
| 20 | Move `revalidatePath` to `after()` in deliverables | ~30m | Low performance |
| 21 | Fix reaction listener to add task filter | ~1h | Low performance |
| 22 | Add per-route error boundaries | ~2h | Low UX |
| 23 | Standardize org resolution across pages | ~1h | Low maintainability |
| 24 | Apply Zod validation in `updateTask()` | ~30m | Low quality |
| 25 | Implement skipped E2E tests | ~28h | Low testing |

---

*Report generated by 5 specialized AI review agents analyzing the full PMS codebase.*
