# CLAUDE.md — PMS Project Bible

**READ THIS ENTIRE FILE BEFORE TOUCHING ANY CODE.**

---

## The Mission

PMS is being evolved into **Mission Control** — a live command center where Fares manages his entire AI team (24 agents) and everything OpenClaw does, while also being a full project management SaaS.

> **From PMS, Fares manages EVERYTHING:**
> agents, models, tasks (his + agent tasks), skills, live activity, sessions, approvals, memory, gateways

Telegram is temporary. PMS replaces it.

---

## Mandatory Pipeline — NO EXCEPTIONS

```
1. Product Analyst writes PRD / creates tasks → distributes to all squads
2. Agent builds (Frontend: Sara, Backend: Mostafa, etc.)
3. Agent reports back to Product Analyst when done
4. Product Analyst collects all squad outputs → reports to Ziko
5. Ziko reviews → reports to Fares

For code quality:
2a. Omar reviews code after each agent
2b. Hady (QA) tests → writes report to docs/reports/hady-qa-report.md
2c. Omar signs off (only after Hady passes)
3. Product Analyst collects sign-offs from all leads → reports to Ziko
```

**Hady is NOT optional.** No sprint ships without a QA report.
**Product Analyst is the hub.** No squad starts without an approved task from Product Analyst.
**All agents report back to Product Analyst** when their work is done — not to Ziko directly.

---

## Design System — NON-NEGOTIABLE

### What This Project Uses
- **Next.js 16** App Router + React 19 + TypeScript (strict)
- **Tailwind CSS 4.1** — CSS custom properties, no hardcoded hex colors
- **shadcn/ui** "new-york" style — `npx shadcn@latest add <component>` to add new ones
- **Icons: Lucide + Phosphor Icons** — check what's already imported in nearby files; be consistent
- **Forms: React Hook Form + Zod** — all forms use these
- **Drag/drop: @dnd-kit** — for any sortable/draggable UI

### MANDATORY: Read Before Any UI Work
```
docs/design-system.json          ← ALL design tokens (OKLCH colors, spacing, shadows, etc.)
docs/design_concept.json         ← Design philosophy and principles
components/tasks/MyTasksPage.tsx ← Gold standard for complex task UI
components/tasks/TaskKanbanBoardView.tsx ← Existing Kanban (use/extend, DO NOT rebuild)
components/projects-content.tsx  ← Gold standard for page layout
components/project-header.tsx    ← Header pattern
components/ui/page-header.tsx    ← PageHeader component (use on ALL new pages)
app/(dashboard)/projects/page.tsx ← How dashboard pages are structured
app/(dashboard)/tasks/page.tsx   ← How tasks pages are structured
```

### Rules
1. **DO NOT rebuild existing components.** `TaskKanbanBoardView.tsx`, `TaskDetailPanel.tsx`, `MyTasksPage.tsx`, etc. already exist — extend them.
2. **Every new page uses `PageHeader`** — title in top bar, action buttons on right, sidebar trigger on left
3. **Colors** from CSS variables only: `--foreground`, `--muted-foreground`, `--border`, `--accent`, etc.
4. **Icons** — check what existing pages use. DO NOT switch icon libraries mid-codebase.
5. **No custom layouts** — if a layout pattern exists in the codebase, use it.

---

## Architecture

### Project Overview
A modern project & task management SaaS + Mission Control for AI agents.

**GitHub:** https://github.com/Faresabdelghany/PMS
**Supabase:** lazhmdyajdqbnxxwyxun
**Production:** https://pms-nine-gold.vercel.app (auto-deploys from `main`)

### Directory Structure
- `app/(dashboard)/` — Main app routes (projects, clients, tasks, agents, boards, etc.)
- `components/ui/` — shadcn/ui primitives
- `components/tasks/` — All task components (DO NOT duplicate these)
- `components/projects/` — Project components
- `components/agents/` — Agent components
- `lib/actions/` — Server Actions (return `ActionResult<T>` = `{ data?, error? }`)
- `lib/supabase/` — Supabase clients and types
- `lib/server-cache.ts` — ALL cached data-fetching functions (use these, don't bypass)
- `lib/cache/invalidation.ts` — Unified cache invalidation (ALWAYS use `invalidateCache.*`)
- `lib/page-auth.ts` — `getPageOrganization()` — use in every dashboard page
- `hooks/` — Custom hooks including realtime subscriptions

### Key Patterns

**Auth in pages:**
```typescript
const { user, orgId } = await getPageOrganization() // Always use this
```

**Auth in server actions:**
```typescript
const { user, supabase } = await requireAuth()
const ctx = await requireOrgMember(orgId)
```

**Cache invalidation** — ALWAYS use unified helpers, never `revalidatePath()` directly:
```typescript
import { invalidateCache } from "@/lib/cache"
await invalidateCache.task({ taskId, projectId, assigneeId, orgId })
```

**New tables not in generated types:**
```typescript
.from("tablename" as any).select(...)  // then cast: as unknown as MyType[]
```

**Realtime subscriptions** — use pooled realtime from context:
```typescript
import { usePooledRealtime } from "@/hooks/realtime-context"
```

### Supabase Clients
- `lib/supabase/client.ts` — Browser client (Client Components)
- `lib/supabase/server.ts` — Server client with cookies (Server Components/Actions)
- `lib/supabase/admin.ts` — Service role, bypasses RLS (server-only, use sparingly)

---

## What's Built — DO NOT REBUILD

### Original PMS Features (mature, tested, fully working)
- Projects with Kanban, list, card views + realtime
- Tasks with `TaskDetailPanel`, `TaskKanbanBoardView`, `TaskWeekBoardView`, timeline, comments, reactions, @mentions
- Clients management
- AI Chat (`/chat`) with streaming and persistence
- Dashboard with live stats
- Inbox, Settings, Reports, Workstreams
- Full auth (login, signup, OAuth, invitations)
- E2E tests with Playwright

### Mission Control Features (added in our sprints — some may need fixing)
- `/agents` — list agents ✅
- `/agents/new` — create agent ⚠️ needs QA
- `/agents/[id]/edit` — edit agent ⚠️ needs QA
- `/agents/communication` — Agent Network visualization ⚠️ needs QA
- `/approvals`, `/gateways`, `/boards`, `/board-groups`, `/custom-fields` ✅
- `/skills/marketplace`, `/tags`, `/activity` ✅
- `/tasks` — now has Mission Control Kanban (verify it didn't break existing tasks)
- `/tasks/new` — new task with agent assignment ⚠️ needs QA
- DB: `agent_commands`, `agent_events` tables for Supabase bridge ✅
- `POST /api/agent-events` — OpenClaw push endpoint ✅

---

## What's Missing — Build These Next

### Sprint 4 — Live Connection
- [ ] Models management page (`/models`) — see/switch model per agent
- [ ] Sessions viewer (`/sessions`) — list active OpenClaw sessions
- [ ] Agent ping from UI (button dispatches ping command)
- [ ] Global pause/resume all agents
- [ ] Memory viewer (`/memory`)
- [ ] Real dashboard metrics (actual charts)
- [ ] Agent heartbeat (30s ping to keep status live)

### Sprint 5 — Complete
- [ ] Skill install/uninstall from UI
- [ ] Model switching per agent
- [ ] Board onboarding chat
- [ ] Webhook payload history
- [ ] Agent nudge button

---

## Agent Bridge Architecture (Supabase as message bus)
```
PMS (Vercel) ──writes──► agent_commands (Supabase) ──► OpenClaw picks up + executes
OpenClaw ────writes──► agent_events (Supabase) ──────► PMS shows live via Realtime
OpenClaw ────calls──► POST /api/agent-events ────────► PMS updates task status
```

---

## Quality Standards
- **0 TypeScript errors** — always run `pnpm.cmd build` before reporting done
- **No console.log** in production code
- **Error + loading states** on every async operation
- **RLS policies** on every new table
- **Realtime** — new tables needing live updates must be added to `supabase_realtime` publication
- **Cache invalidation** — use `invalidateCache.*` after every mutation

---

## Organization Context
- Fares's org ID: `9c52b861-abb7-4774-9b5b-3fa55c8392cb`
- Test user: `e2e-test@example.com`

## Agent Hierarchy
```
Fares
  └── Ziko (orchestrates, talks to Fares)
        └── Nabil (Supreme Commander)
              ├── Product Analyst (hub — creates PRDs, collects all outputs, reports to Ziko)
              │     └── Researcher
              ├── Omar (Tech Lead) → Mostafa, Sara, Ali, Yasser, Hady, Farah, Bassem
              ├── Karim (Marketing Lead) → Sami, Maya, Amir, Rami, Tarek, Mariam, Nour, Salma, Ziad
              └── Design Lead → Design Agent
```
