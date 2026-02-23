# QA Report — Hady (Updated)
**Date:** 2026-02-23 (Rev 2 — Fares Priority Issues)  
**QA Engineer:** Hady  
**Reports to:** Omar (Tech Lead)  
**Scope:** Fares's 5 flagged areas + full Mission Control code review  
**Method:** Static analysis, schema validation, design system audit, TypeScript build check

---

## Build Status

```
pnpm build → ✅ Compiled successfully (Turbopack, 0 TypeScript errors)
All 49 routes generated. Sentry warning is pre-existing, unrelated to our work.
```

---

# PART 1 — FARES'S 5 FLAGGED AREAS (Priority)

---

## 1. `/agents/new` — Does the Add Agent form work?

### Verdict: ⚠️ WORKS BUT HAS CRITICAL DESIGN VIOLATIONS

**Does it save to DB?** Yes — `createAgent(organization.id, {...})` is called correctly.  
**Is validation present?** Partially — name and role have `required` on the input, and the submit button is `disabled` when `!name || !role`. No other validations.

### Bug: Silent failure if org context is null

**File:** `app/(dashboard)/agents/new/page.tsx`, line 59  
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!organization?.id) return  // ← silent return, NO error shown to user
```
`useOrganization()` can return `{ organization: null }` if the context hasn't populated yet. If the user somehow triggers submit before org loads, the form silently does nothing — no toast, no error message.  
**Fix:** Show an error toast: `if (!organization?.id) { toast.error("Organization not loaded. Please refresh."); return }`

### Architecture violation: Should be a Server Component

CLAUDE.md says pages should be Server Components using `getPageOrganization()`. This page is `"use client"` using `useOrganization()` — the wrong pattern. The existing dashboard pages (projects, clients, etc.) are all Server Components.

### Architecture violation: Forms must use React Hook Form + Zod

CLAUDE.md mandates: **"Forms: React Hook Form + Zod — all forms use these."**  
This form uses plain `useState` for every field. No React Hook Form, no Zod validation schema.

### Missing field: `reports_to` (supervisor)

The Agent Network tree is built entirely from `reports_to` relationships. But the Create Agent form has **no field for selecting a supervisor**. New agents created via `/agents/new` will always appear as **root nodes** in the Agent Network tree — floating detached from the hierarchy. This breaks the org chart as new agents are added.  
**Severity: High for the Agent Network feature.**

### Hardcoded AI models

```typescript
const AI_MODELS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
]
```
Only 3 models available. No `gpt-4o`, no `claude-3.5-haiku`, etc. Not driven from DB. Defined twice (both create and edit have the same hardcoded list).

---

## 2. `/agents/[id]/edit` — Does the Edit form load existing data? Does saving work?

### Verdict: ⚠️ WORKS WITH DATA LOADING ISSUES

**Does it load existing data?** Yes — `useEffect` calls `getAgent(agentId)` and populates state.  
**Does saving work?** Yes — `updateAgent(agentId, {...})` called correctly. Toast on success.

### Issue: Client-side data load causes UI flash

The page starts with `loading = true` → shows `<PageSkeleton />`. Then the `useEffect` fires, calls `getAgent`, and the form renders. This adds a network round-trip after hydration.  
If this were a Server Component (like it should be per CLAUDE.md), the data would be available on first render with no flash.

### Issue: `getAgent` called from client without org ID context

`getAgent(agentId)` is called without an org ID. The function relies on RLS to scope access. This works but is inconsistent with the pattern elsewhere. A Server Component approach (using `getAgentById(id)` in the page server function) would be cleaner and safer.

### Issue: Edit form will show BLANK model selector for unknown models

If an agent's `ai_model` in the DB is anything other than `claude-opus-4-6`, `claude-sonnet-4-6`, or `gemini-2.5-flash`, the Select will render empty (no option matches). For the 24 seeded agents this is fine since they all use these 3 models. But any agent created via API with a different model name (e.g., `gpt-4o`) will have a broken edit form.

### Bug: Same violations as `/agents/new` 
- `"use client"` when it should be a Server Component  
- `useState` instead of React Hook Form + Zod  
- **Missing `reports_to` field** — can't change an agent's supervisor via the UI

### Architecture issue: Duplicate `params` handling
```typescript
export default function EditAgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)  // ← React 19 `use()` in client component
```
This works in React 19 / Next.js 16, but is unusual. In a Server Component the params would be awaited normally.

---

## 3. `/agents/communication` — Is the Agent Network rendering correctly?

### Verdict: ✅ RENDERS CORRECTLY — one functional issue

**Tree renders?** ✅ Yes — hierarchy built from `reports_to` map, `HumanRootNode` (Fares) at top  
**All 24 agents visible?** ✅ Yes — no pagination/limit on the `getAgents(orgId)` call  
**Click → Sheet opens?** ✅ Yes — `setSelectedAgent(agent)` triggers Sheet with full agent details  
**Status badges?** ✅ Correct colors (emerald=online, amber=busy/idle, muted=offline)  
**Squad colors?** ✅ Correct (blue=engineering, purple=marketing, emerald=all, yellow=supreme)  

### Bug: Ping Agent button is a no-op

**File:** `components/agents/AgentNetworkClient.tsx`, lines 210-212  
```typescript
const handlePing = () => {
  toast.success(`Ping sent to ${agent.name}`)  // ← ONLY shows a toast. Nothing happens.
}
```
The button shows a green success toast ("Ping sent to Omar") but does NOT:
- Call `pingAgent()` server action  
- Create an `agent_commands` row in the DB  
- Actually send anything to OpenClaw  

This is **deceptive** — Fares will think the ping was sent when it wasn't. Noted in CLAUDE.md Sprint 4 backlog: "Agent ping from UI (button dispatches ping command)".

### Issue: New agents created without `reports_to` will appear as disconnected roots

If Fares creates a new agent via `/agents/new` and doesn't set a supervisor (because there's no field for it), that agent will appear as a separate root node beside Fares in the tree — floating outside the hierarchy. The tree will look broken.

### Issue: Tree layout can break with many root nodes

Currently 2 root nodes (`Ziko`, `Nabil`). If many unconnected root agents accumulate, the horizontal layout will get very wide and the connector bar math (`inset-x-14`) will be incorrect because it uses hardcoded half-width of node cards.

---

## 4. `/tasks` — Did Sprint 3 BREAK the existing tasks?

### Verdict: 🔴 CRITICAL — MyTasksPage.tsx IS GONE, TaskKanbanBoardView.tsx NOT USED

This is the most serious finding. **Sprint 3 violated CLAUDE.md's #1 rule:**

> ❌ **"DO NOT rebuild existing components."**  
> `TaskKanbanBoardView.tsx`, `TaskDetailPanel.tsx`, `MyTasksPage.tsx` — **extend them.**

### What happened:

| Before Sprint 3 | After Sprint 3 |
|---|---|
| `/tasks` showed `MyTasksPage.tsx` — personal task view, user's own tasks, with filters, views, KV-backed realtime | `/tasks` shows new `TasksBoard.tsx` — ALL org tasks, Mission Control Kanban |
| Used `TaskKanbanBoardView.tsx` with `@dnd-kit` drag-and-drop | New `TasksBoard.tsx` built from scratch — **no drag-and-drop** |
| Used `TaskDetailPanel.tsx` (full-featured, with comments, reactions, @mentions) | New `TaskDetail.tsx` (minimal — only agent assignment + dispatch status) |
| Used `invalidateCache.task(...)` for proper 2-layer cache invalidation | Uses `revalidatePath("/(dashboard)/tasks")` — **broken path, wrong pattern** |

### Components still exist but are orphaned:

```
✅ components/tasks/MyTasksPage.tsx         — still exists, NOT used by any route
✅ components/tasks/TaskKanbanBoardView.tsx  — still exists, NOT used by /tasks  
✅ components/tasks/TaskDetailPanel.tsx      — still exists, NOT used by /tasks
✅ components/tasks/TaskBoardCard.tsx        — still exists, NOT used by /tasks
```

### What Fares lost when Sprint 3 replaced `/tasks`:

1. **Personal task view** — "My Tasks" (tasks assigned to Fares specifically) is **gone**
2. **Drag-and-drop** between Kanban columns — `@dnd-kit` completely missing from new board
3. **Full task detail panel** — comments, reactions, @mentions, full edit form are **gone**
4. **Multiple view modes** — List, Kanban, Week board, Timeline views **gone** (new board = Kanban only)
5. **Filter system** — the rich filter popover with chips, priority, date filters **gone**
6. **Task quick-create modal** — `TaskQuickCreateModal` with all fields **gone**, replaced with a full new page

### What Sprint 3 added (that should be ADDITIVE, not replacing):

The Mission Control Kanban should have been a NEW route (e.g., `/mission-control` or `/tasks/all`) **alongside** the existing `/tasks` page, not a replacement for it.

### Critical cache invalidation bug in Sprint 3 tasks:

**File:** `lib/actions/tasks-sprint3.ts`, lines 208 and 234  
```typescript
// ❌ Wrong: (dashboard) is a route group, doesn't appear in URLs
revalidatePath("/(dashboard)/tasks", "page")
```
**Also wrong:** Should use `invalidateCache.task(...)` (2-layer: Next.js tags + KV), not `revalidatePath()`.  
The existing project task mutations use `invalidateCache.task()`. Sprint 3 bypasses this.

### Critical status string mismatch:

**File:** `lib/actions/tasks-sprint3.ts`, line 145  
```typescript
// ❌ Wrong: task_status enum is 'in-progress' (dash), not 'in_progress' (underscore)
const inProgress = tasks.filter((t) => t.status === "in_progress").length
```
Stats bar "In Progress" count will **always show 0**.

### Duplicate Supabase client:

Sprint 3 created `lib/supabase/service.ts` — but `lib/supabase/admin.ts` **already exists** with identical functionality (`createAdminClient()` vs `createServiceClient()`). Two files doing the same thing, inconsistent naming throughout the codebase.

---

## 5. Design Consistency — Do new MC pages match the design system?

### Verdict: ⚠️ PARTIALLY CONSISTENT — core violations found

### ✅ What's correct:

- **CSS variables used correctly** — No hardcoded hex colors in Sprint 3 components
- **`PageHeader` on every page** — All new MC pages use `PageHeader` ✅
- **Spacing tokens** — `p-4`, `p-6`, `px-4 py-3`, `gap-4/6` — all standard
- **shadcn/ui components** — `Sheet`, `Dialog`, `Card`, `Badge`, `Button`, `Select`, `Tabs` — all shadcn ✅
- **Icon library** — Phosphor Icons used consistently (matches existing pages like `/activity`)
- **`border-border`** token used for all borders ✅
- **`bg-muted`** for column backgrounds in Kanban ✅
- **`rounded-xl`** for cards, matching `project-board-view.tsx` ✅
- **`text-foreground` / `text-muted-foreground`** for all text ✅

### ❌ What violates CLAUDE.md / design system:

**1. Forms don't use React Hook Form + Zod (CLAUDE.md mandatory)**  
`/agents/new`, `/agents/[id]/edit` use raw `useState`. Every other form in the codebase uses React Hook Form. This is not a "style preference" — it's a stated project requirement.

**2. Sprint 3 Task Kanban doesn't use `TaskKanbanBoardView.tsx`**  
The existing Kanban has drag-and-drop via `@dnd-kit`. The new `TasksBoard.tsx` has none. CLAUDE.md says "extend them" — this is a rebuild.

**3. Missing `@dnd-kit` drag and drop in new Kanban**  
The design_concept.json says task boards should allow reordering via drag. The new Mission Control board has no DnD at all. Clicking "Add task" at the bottom of each column navigates to `/tasks/new` — but the existing system uses `TaskQuickCreateModal` in-place.

**4. New pages are Client Components when they should be Server Components**  
CLAUDE.md: "Server Components by default; use `client` only when needed."  
`/agents/new` and `/agents/[id]/edit` are fully Client Components. All existing dashboard pages (projects, clients, tasks, boards) are Server Components.

**5. `TaskDetail.tsx` (Sprint 3) is minimal vs `TaskDetailPanel.tsx` (original)**  
The original `TaskDetailPanel.tsx` includes comments, reactions, @mentions, full edit fields. The new minimal `TaskDetail.tsx` only shows dispatch status and agent assignment. Feature regression.

**6. `lib/supabase/service.ts` duplicates `lib/supabase/admin.ts`**  
These are identical. The codebase now has:  
- `createAdminClient()` in `admin.ts` — original  
- `createServiceClient()` in `service.ts` — Sprint 3 addition  
Both use the service role key. CLAUDE.md says use the existing client.

**7. Cache invalidation bypasses the project pattern**  
The project uses a 2-layer cache system (`invalidateCache.*` for both Next.js tags + KV).  
Sprint 3 mutations call `revalidatePath()` directly — wrong path, skips KV layer entirely.

---

# PART 2 — COMPLETE BUG LIST (All Severity Levels)

## 🔴 Critical Bugs

| # | Bug | File | Line | Impact |
|---|-----|------|------|--------|
| C1 | `"in_progress"` vs `"in-progress"` status mismatch | `tasks-sprint3.ts` | 145 | Stats bar always shows 0 In Progress |
| C2 | `revalidatePath("/(dashboard)/tasks")` — wrong path | `tasks-sprint3.ts` | 208, 234 | Cache NEVER invalidated after task mutations |
| C3 | Sprint 3 replaced `/tasks` entirely — `MyTasksPage` gone | `tasks/page.tsx` | whole file | Personal tasks, DnD, full panel, multi-view all lost |
| C4 | New agent form missing `reports_to` field | `agents/new/page.tsx` | — | New agents always disconnected from hierarchy tree |
| C5 | Ping Agent button is fake — no actual command sent | `AgentNetworkClient.tsx` | 210-212 | Fares thinks ping sent; nothing happens in OpenClaw |

## 🟠 High Bugs

| # | Bug | File | Impact |
|---|-----|------|--------|
| H1 | Silent failure when org context null in Create/Edit forms | `agents/new/page.tsx`, `edit/page.tsx` | Form submit silently does nothing, no feedback |
| H2 | `TaskDetail` stale `selectedAgentId` when switching tasks | `TaskDetail.tsx` line 59 | Wrong agent shown/dispatched when opening different tasks |
| H3 | Edit form model selector blank if model not in hardcoded list | `edit/page.tsx` | Agent's model appears unset for any non-standard model |
| H4 | Cache invalidation uses `revalidatePath()` not `invalidateCache.*` | `agents.ts`, `tasks-sprint3.ts` | KV layer not invalidated; stale data on repeated visits |

## 🟡 Medium Issues

| # | Issue | File | Impact |
|---|-------|------|--------|
| M1 | Forms use `useState` not React Hook Form + Zod (CLAUDE.md violation) | `agents/new`, `agents/edit`, `tasks/NewTaskForm` | Pattern inconsistency, missing field-level validation |
| M2 | Edit/New agent pages are Client Components (CLAUDE.md violation) | Both agent form pages | Extra network round-trip, flashing skeleton, wrong pattern |
| M3 | Realtime events in Live Feed missing agent/task join data | `LiveActivityFeed.tsx` | New live events show "System" instead of agent name |
| M4 | Agent filter chips limited to 6 of 24 agents | `TasksBoard.tsx` | 18 agents can't be filtered by chip |
| M5 | `service.ts` duplicates `admin.ts` | `lib/supabase/service.ts` | Two clients doing same thing; inconsistent naming |
| M6 | New task form has no empty-projects warning | `NewTaskForm.tsx` | Silent failure — project dropdown empty, no explanation |

## 🔵 Low / Non-critical

| # | Issue | File |
|---|-------|------|
| L1 | Hardcoded AI models list defined twice (create + edit) | Both agent pages |
| L2 | `checkGatewayHealth` server action is dead code | `gateways.ts` |
| L3 | Approvals page wraps already-fetched data in `<Suspense>` | `approvals/page.tsx` |
| L4 | Board approvals filters all org approvals client-side | `boards/[boardId]/approvals/page.tsx` |
| L5 | Non-SSR Phosphor icon imports in `NewTaskForm.tsx` | Inconsistent with rest of codebase |

---

# PART 3 — WHAT WORKS CORRECTLY

### Sprint 1+2 MC Core
- `/agents` list — filters, hierarchy, correct data ✅
- `/approvals` — filter tabs, confirm dialog, optimistic UI ✅
- `/gateways` — live health polling, CRUD ✅
- `/boards` + `/boards/new` + board detail/webhooks/approvals ✅
- `/board-groups` — inline CRUD ✅
- `/custom-fields` — all field types ✅
- `/skills/marketplace` — DB persistence, category filter ✅
- `/tags` — correct `mc_tags` table ✅
- `/activity` — timeline, agent filter, `Link` tags (not `<a>`) ✅
- `GET /api/health` — structured response, no caching ✅

### Sprint 3 Components (what works within the new system)
- `POST /api/agent-events` — auth, validation, all 8 event types, task status updates ✅
- `agent_commands` table — RLS policies, Zod validation in action ✅
- `agent_events` table — RLS, Realtime enabled ✅
- TaskDetail sheet — dispatch flow, canDispatch logic, error handling ✅
- New Task form — creates task, dispatches to agent if selected ✅

---

# PART 4 — RECOMMENDED FIX PRIORITY

### Must Fix Before Any Demo to Fares

**1. Restore `/tasks` to coexist with Mission Control** (2-4h)  
The `/tasks` route should keep `MyTasksPage.tsx` (rename to `/tasks/my` or similar) and put Mission Control at `/tasks` OR add a tab switcher. Do NOT leave `MyTasksPage` unreachable.

**2. Fix the 3 one-liners in `tasks-sprint3.ts`** (10 min):
```typescript
// Line 145:
"in_progress" → "in-progress"

// Lines 208, 234:
revalidatePath("/(dashboard)/tasks", "page") → revalidatePath("/tasks")
```

**3. Wire up Ping Agent button** (30 min):
```typescript
// AgentNetworkClient.tsx handlePing():
import { pingAgent } from "@/lib/actions/agent-commands"
const handlePing = async () => {
  const result = await pingAgent(orgId, agent.id, "Ping from Mission Control")
  if (result.error) { toast.error(result.error); return }
  toast.success(`Ping sent to ${agent.name}`)
}
```

**4. Add `reports_to` field to Create/Edit agent forms** (1h)  
Without this, every agent Fares creates goes to root of the tree — the hierarchy breaks permanently.

**5. Add loading guard with toast in agent forms** (10 min):
```typescript
if (!organization?.id) { toast.error("Organization not loaded. Please try again."); return }
```

### Should Fix Before Sprint 4

**6. Convert agent forms to Server Components with React Hook Form + Zod** (3-4h)  
Follow the pattern of `boards/new`, `gateways/new` which load data server-side.

**7. Replace `service.ts` with `admin.ts`** (30 min):  
Update all `createServiceClient()` references to use `createAdminClient()` from `admin.ts`.

**8. Fix `TaskDetail` stale agent selector** (15 min):  
Add `useEffect(() => { setSelectedAgentId(task?.assigned_agent_id ?? "") }, [task?.id])`

**9. Fix Realtime agent data in Live Feed** (1h):  
After receiving a Realtime event, look up agent from the `agents` prop map.

---

## Verdict: 🔴 FAIL — Must fix before Fares review

The core architecture works and most features function. However:
- **The original `/tasks` `MyTasksPage` is inaccessible** — that's a regression, not an addition
- **Sprint 3 violated CLAUDE.md's fundamental rule** about not rebuilding existing components
- **3 one-line bugs** in `tasks-sprint3.ts` cause incorrect stats and stale cache
- **Ping Agent is fake** — will mislead Fares into thinking commands are being sent

The build passes (0 TS errors) and the new features work. But the replacement of `MyTasksPage` and the architecture violations need to be addressed before this ships.

---

— Hady, QA Engineer  
*Report updated: 2026-02-23 (Revision 2 — Priority issues per Fares)*
