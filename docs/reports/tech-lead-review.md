# Tech Lead Review: Mission Control Integration
**Reviewer:** Omar (Tech Lead / CTO)  
**Date:** 2026-02-23  
**Project:** PMS  
**Scope:** Backend + Frontend Mission Control integration built by subagents

---

## Executive Summary

The integration is **functionally solid with a clean build**. The backend is well-architected and the core frontend flows (approvals, gateways, dashboard) are production-ready. However, there are **3 bugs that need immediate fixes** before launch (wrong revalidation paths, wrong table on Tags page, non-persistent Skills UI), plus several missing features from the mission-control reference that should be tracked as follow-up work.

**Verdict: ✅ Approved for staging — with the 3 bugs fixed before production**

---

## Build Status

```
pnpm build → ✅ CLEAN
```

- Turbopack compiled in 30.3s with no TypeScript errors
- All 38 routes generated successfully
- No missing imports, no broken references
- Sentry authToken warning is pre-existing and unrelated

---

## ✅ What Looks Good

### Backend

1. **Migration SQL (`supabase/migrations/20260223000001_mission_control.sql`)**
   - All 5 tables correctly defined: `approvals`, `gateways`, `skills`, `boards`, `mc_tags`
   - `IF NOT EXISTS` guards on all tables, indexes, triggers — safe to re-run
   - RLS policies follow the established `organization_members` pattern consistently
   - Proper indexes on org_id, status, and FK columns
   - `updated_at` triggers via `DO $$ ... IF NOT EXISTS` pattern (no duplicate trigger error)
   - The `agents.model` column patch is correctly written
   - One note: `mc_tags` DELETE policy allows all org members (not admin-only), which differs from other tables. This is correct per the SQL as written and intentional since tags are lightweight.

2. **Server Actions — Overall Architecture**
   - All 5 action files follow the established project pattern (`"use server"`, `requireOrgMember`, `ActionResult<T>`, `after(() => revalidatePath(...))`)
   - `approvals.ts`: Complete with `getPendingApprovalsCount` for badge — nice touch
   - `gateways.ts`: `checkGatewayHealth` with AbortController timeout, clean CRUD
   - `boards.ts`: Clean CRUD, proper org membership verification on updates
   - `skills.ts`: `upsertSkill` with duplicate detection, `seedDefaultSkills` for new orgs
   - `mc-tags.ts`: Hex color validation, duplicate name handling via `error.code === "23505"`

3. **Gateway Proxy (`app/api/gateway/route.ts`)**
   - AbortController timeout (3s) correctly implemented
   - Handles both JSON and text/plain gateway responses
   - CORS OPTIONS handler for local dev
   - Returns structured error with `{ error, status, reason }` on failure
   - `User-Agent` header set — good practice

4. **Dashboard (`app/(dashboard)/page.tsx`)**
   - ✅ Gateway Status Card present and functional
   - ✅ Pending Approvals Card present with clickable link to `/approvals?status=pending`
   - `pendingApprovalsPromise` wrapped in `.catch(() => ({ data: 0 }))` — graceful degradation if table doesn't exist yet
   - Both cards wrapped in Suspense with skeleton fallback

5. **Sidebar (`components/app-sidebar.tsx`)**
   - All 6 new nav items registered: `activity`, `boards`, `approvals`, `gateways`, `skills`, `tags`
   - Correct routes: `skills` → `/skills/marketplace`, all others match their page paths
   - `isItemActive` correctly handles all new paths (including prefix-matching for `/skills`)
   - Approvals badge renders amber-colored count from server-rendered `initialPendingApprovalsCount`
   - Layout correctly fetches `pendingApprovalsCount` in parallel with other sidebar data (no waterfall)

6. **Approvals Page — Full-Featured**
   - Tab filter (all/pending/approved/rejected) with URL sync
   - Confirm dialog with optional reason text before approve/reject
   - Optimistic UI updates via `setLocalApprovals` + `router.refresh()`
   - Collapsible payload viewer with JSON pretty-print
   - Proper `useTransition` for non-blocking updates

7. **Gateways — Complete CRUD**
   - List page with status badges and last-seen timestamps
   - Detail page with Test Connection button (uses gateway proxy)
   - New/Edit pages with auth mode toggle (shows token field only when needed)
   - Delete with AlertDialog confirmation, mentions board impact
   - `GatewayStatusCard` checks local gateway on dashboard mount

8. **Agent New/Edit Pages**
   - Full form: name, role, description, type, squad, AI model, status
   - AI provider auto-derived from model name (smart)
   - Edit page fetches agent data server-side via `getAgent`
   - Both pages navigate to agent detail after success

9. **Activity Page**
   - Timeline view with date separators
   - Agent filter badges
   - Empty state with descriptive message

10. **Boards Page**
    - Card grid view with status badges
    - Empty state with CTA
    - Create form loads agents + gateways for selection dropdowns

---

## ❌ Issues Found (Bugs — Fix Before Production)

### BUG 1: Wrong `revalidatePath` in `approvals.ts` and `skills.ts`
**Severity: Medium** — Cache not invalidated on correct path, stale data after mutations

**File:** `lib/actions/approvals.ts`, lines ~85 and ~115
```typescript
// ❌ Wrong — route is /approvals not /mission-control/approvals
after(() => revalidatePath("/mission-control/approvals"))
```
**Fix:**
```typescript
after(() => revalidatePath("/approvals"))
```

**File:** `lib/actions/skills.ts`, lines ~120, ~145, ~170
```typescript
// ❌ Wrong — route is /skills/marketplace
after(() => revalidatePath("/mission-control/skills"))
```
**Fix:**
```typescript
after(() => revalidatePath("/skills/marketplace"))
after(() => revalidatePath("/skills"))
```

---

### BUG 2: Tags page uses wrong table (organization_tags instead of mc_tags)
**Severity: Medium** — The `mc_tags` table built by the backend is never used by any frontend page

**File:** `app/(dashboard)/tags/page.tsx` — imports `getTags` from `lib/actions/tags`  
**File:** `app/(dashboard)/tags/tags-client.tsx` — imports `createTag`, `updateTag`, `deleteTag` from `lib/actions/tags`

The Tags page currently manages `organization_tags` (the existing per-project tags system). The new `mc_tags` table (mission-control specific tags) has no UI at all.

**Decision needed:** Two options:
- **Option A (Preferred):** Make `/tags` manage `mc_tags`. Update page to import from `lib/actions/mc-tags`. Note: `OrganizationTag` type has a `description` field and `is_system` flag; `MCTag` does not. Minor UI adjustment needed.
- **Option B:** Keep `/tags` for org tags, add a separate `/mc-tags` route for MC tags (and update sidebar)

---

### BUG 3: Skills Marketplace has no DB persistence
**Severity: Medium** — Install/uninstall actions are in-memory only; cleared on refresh

**File:** `app/(dashboard)/skills/marketplace/page.tsx`

The page is a `"use client"` component with a hardcoded `SKILLS` array. The `installed` state lives in `useState` only. On page refresh, all changes are lost. The `getSkills`, `upsertSkill`, and `updateSkill` actions in `lib/actions/skills.ts` are never called from any page.

**Fix:** The page should:
1. Be a Server Component that fetches `getSkills(orgId)` (seeding defaults if empty)
2. Pass skills to a client component that calls `updateSkill(id, { installed: !current })` on toggle
3. Or at minimum: load from DB on mount via `useEffect`

---

## ⚠️ Minor Issues (Non-blocking but should be tracked)

### MINOR 1: Activity page uses `<a>` tags instead of `<Link>`
**File:** `app/(dashboard)/activity/page.tsx`, lines ~63–69

```typescript
// ❌ Causes full page reload
<a href="/activity">...</a>
<a href={`/activity?agentId=${agent.id}`}>...</a>
```
**Fix:** Replace with `<Link href="...">` from `next/link` for client-side navigation

---

### MINOR 2: Skills marketplace `?category=` URL param is ignored
**File:** `app/(dashboard)/skills/page.tsx` links to `/skills/marketplace?category=engineering`  
**File:** `app/(dashboard)/skills/marketplace/page.tsx` uses `useState` for category — doesn't read `searchParams`

The linking from the overview page to marketplace with a pre-selected category does nothing. Either read the `searchParams` prop in marketplace, or change the link to not include the category param.

---

### MINOR 3: Board detail page shows raw UUIDs instead of resolved names
**File:** `app/(dashboard)/boards/[boardId]/page.tsx`

```typescript
// ❌ Poor UX — shows UUID not agent name
<span className="text-sm font-medium font-mono">{board.agent_id}</span>
```

The board detail fetches only the `boards` table. It should join (or do a secondary fetch) for agent name and gateway name. The SQL query in `getBoard` does a `select("*")` — would need `select("*, agents(name), gateways(name)")` after adding FK relationships, or a secondary fetch in the page.

---

### MINOR 4: `checkGatewayHealth` function is unused
**File:** `lib/actions/gateways.ts`

`checkGatewayHealth` is a server action but it's never called from any page. The gateway proxy API route (`/api/gateway`) and `GatewayTestButton` correctly bypass this. The function could be useful server-side for scheduled health checks, but as-is it's dead code. Either use it or remove it to keep the codebase clean.

---

### MINOR 5: `deleteMCTag` doesn't require admin role (inconsistency)
**File:** `lib/actions/mc-tags.ts`

`deleteMCTag` calls `requireOrgMember(orgId)` (any member). All other delete operations (`deleteGateway`, `deleteBoard`, `deleteSkill`) call `requireOrgMember(orgId, true)` (admin only). This is consistent with the SQL RLS policy for mc_tags but inconsistent with the other entities' patterns. Decide if tags should be admin-only delete and update accordingly.

---

## ⚠️ Features in Mission-Control Not Yet Built in PMS

Comparing against `C:\Users\Fares\Downloads\openclaw-mission-control\frontend\src\app\`:

| Feature | MC Has | PMS Has | Gap |
|---------|--------|---------|-----|
| `/boards/[boardId]/edit` | ✅ | ❌ | No edit UI for boards |
| `/boards/[boardId]/approvals` | ✅ | ❌ | Board-scoped approvals sub-view |
| `/boards/[boardId]/webhooks` | ✅ | ❌ | Webhook management per board |
| Board custom fields | ✅ | ❌ | `custom-field-utils.tsx`, `TaskCustomFieldsEditor` |
| `/board-groups` | ✅ | ❌ | Entire board grouping feature |
| `/custom-fields` | ✅ | ❌ | Global custom fields management |
| Skills DB persistence | ✅ | ❌ | Currently hardcoded + in-memory |
| MC Tags UI | ✅ | ❌ | mc_tags table exists, no UI uses it |
| Real-time gateway health polling | ✅ (polling) | ⚠️ | Only checked once on mount |

---

## 📋 Recommended Next Steps

### Immediate (before production):
1. **Fix revalidatePath** in `approvals.ts` and `skills.ts` (30 min)
2. **Fix Tags page** — decide org_tags vs mc_tags, update imports (1-2h)
3. **Connect Skills marketplace to DB** — fetch from `skills` table, persist installs (2-3h)
4. **Apply the DB migration** manually via Supabase dashboard (15 min)

### Short-term (next sprint):
5. Replace `<a>` tags with `<Link>` in activity page (15 min)
6. Read `?category=` searchParam in skills marketplace (30 min)
7. Resolve agent + gateway names in board detail page (1h)
8. Add board edit page `/boards/[boardId]/edit` (2h)
9. Seed default skills on org creation (call `seedDefaultSkills` in onboarding flow)

### Medium-term:
10. Board webhooks management
11. Board-scoped approvals sub-view
12. Gateway health polling (periodic refresh, not just on mount)
13. Custom fields system

---

## File Checklist

| File | Status | Notes |
|------|--------|-------|
| `supabase/migrations/20260223000001_mission_control.sql` | ✅ Ready | Needs manual DB push |
| `lib/actions/approvals.ts` | ⚠️ Bug | Wrong revalidatePath |
| `lib/actions/gateways.ts` | ✅ Good | `checkGatewayHealth` unused |
| `lib/actions/boards.ts` | ✅ Good | Clean |
| `lib/actions/skills.ts` | ⚠️ Bug | Wrong revalidatePath; never called from UI |
| `lib/actions/mc-tags.ts` | ✅ Good | No UI uses it yet |
| `app/api/gateway/route.ts` | ✅ Good | Solid proxy implementation |
| `components/app-sidebar.tsx` | ✅ Good | All routes correct |
| `app/(dashboard)/page.tsx` | ✅ Good | Both MC cards present |
| `app/(dashboard)/activity/page.tsx` | ⚠️ Minor | Uses `<a>` not `<Link>` |
| `app/(dashboard)/agents/new/page.tsx` | ✅ Good | Full form |
| `app/(dashboard)/agents/[agentId]/edit/page.tsx` | ✅ Good | Full form |
| `app/(dashboard)/approvals/page.tsx` | ✅ Good | Server-fetched |
| `app/(dashboard)/approvals/approvals-client.tsx` | ✅ Good | Full-featured |
| `app/(dashboard)/gateways/page.tsx` | ✅ Good | |
| `app/(dashboard)/gateways/gateways-list-client.tsx` | ✅ Good | |
| `app/(dashboard)/gateways/new/page.tsx` | ✅ Good | |
| `app/(dashboard)/gateways/[gatewayId]/page.tsx` | ✅ Good | |
| `app/(dashboard)/gateways/[gatewayId]/edit/page.tsx` | ✅ Good | |
| `app/(dashboard)/gateways/[gatewayId]/gateway-test-button.tsx` | ✅ Good | |
| `app/(dashboard)/boards/page.tsx` | ✅ Good | |
| `app/(dashboard)/boards/new/page.tsx` | ✅ Good | |
| `app/(dashboard)/boards/[boardId]/page.tsx` | ⚠️ Minor | Shows raw UUIDs |
| `app/(dashboard)/skills/page.tsx` | ✅ Good | Category overview |
| `app/(dashboard)/skills/marketplace/page.tsx` | ❌ Bug | Hardcoded, no DB |
| `app/(dashboard)/tags/page.tsx` | ❌ Bug | Uses org_tags not mc_tags |
| `app/(dashboard)/tags/tags-client.tsx` | ❌ Bug | Uses org_tags actions |
| `components/dashboard/gateway-status-card.tsx` | ✅ Good | |

---

*Review complete. 3 bugs to fix, 5 minor improvements, 9 missing features to track.*
