# PMS — Project Context for All Agents

**READ THIS FIRST. Before writing a single line of code.**

---

## What We Are Building

PMS is **Mission Control** — a live command center where Fares manages his entire AI team and everything OpenClaw does.

This is NOT a generic project management tool. Every feature, every page, every design decision must serve this goal:

> **Fares opens PMS and from there he can manage EVERYTHING:**
> - All 24 AI agents (status, ping, assign tasks, pause, resume)
> - All tasks — his own + agent tasks — in one unified Kanban board
> - All AI models (which model each agent uses, switch models)
> - All skills (what each agent can do, install/remove)
> - Live activity (what every agent is doing RIGHT NOW)
> - Active sessions (ongoing OpenClaw sessions, chat with agents)
> - Approvals (agents ask permission, Fares approves/rejects)
> - Memory (what agents remember)
> - Gateways (OpenClaw connection health, pause/resume)

**Telegram is temporary.** PMS replaces it. Everything Fares does via Telegram with Ziko today, he should be able to do from PMS.

---

## Design System — NON-NEGOTIABLE

**You MUST follow the existing PMS design. Do NOT invent new patterns.**

### Stack
- Next.js 15 + App Router
- TypeScript (strict mode, 0 errors required)
- Tailwind CSS — no inline styles, no arbitrary values unless necessary
- shadcn/ui components — use what's already installed
- Phosphor icons — NOT Heroicons, NOT Lucide (unless already used)
- Dark mode first

### Before writing any UI, read these files:
```
components/projects-content.tsx       ← gold standard for complex pages
components/project-header.tsx         ← header pattern
components/project-cards-view.tsx     ← card layout
components/project-board-view.tsx     ← Kanban/board pattern
components/ui/page-header.tsx         ← PageHeader component (use this for ALL pages)
app/(dashboard)/projects/page.tsx     ← how pages are structured
app/(dashboard)/clients/page.tsx      ← another reference
```

### Rules
1. **Every page uses `PageHeader`** — title in top bar, action buttons on right, sidebar trigger on left
2. **Kanban boards** follow `project-board-view.tsx` — same card style, same column style
3. **Cards** follow `project-cards-view.tsx` — same spacing, same border, same hover
4. **No custom layouts** — if a layout pattern exists in the codebase, use it
5. **Colors**: use CSS variables (`--foreground`, `--muted-foreground`, `--border`, `--accent`) not hardcoded hex
6. **Spacing**: p-4, p-6, gap-4, gap-6 — consistent with rest of app
7. **Agent squad colors**: blue=engineering, purple=marketing, green=design/product, gold=supreme

### Use these skills before building UI:
- `~/.agents/skills/ui-ux-pro-max/SKILL.md` — read this for any design decisions
- `~/.agents/skills/superdesign/SKILL.md` — for frontend design guidelines

---

## Architecture

### Tech Stack
- Database: Supabase (PostgreSQL + RLS + Realtime)
- Auth: Supabase Auth (cookie-based sessions)
- Hosting: Vercel (auto-deploys from main branch)
- Live URL: https://pms-nine-gold.vercel.app

### Key Patterns
- **Server Components by default** — use `'use client'` only when needed
- **Server Actions** for all mutations (not API routes, not client-side fetch)
- **Supabase Realtime** for live updates (see `hooks/realtime-context.tsx`)
- **`createClient()`** from `lib/supabase/server.ts` for server-side queries
- **`createServiceClient()`** from `lib/supabase/service.ts` for service-role operations
- **New tables** not in generated types: use `.from("tablename" as any)` + `as unknown as T` cast

### Agent Bridge Architecture
```
PMS (Vercel) ──writes──► agent_commands (Supabase) ──► OpenClaw picks up + executes
OpenClaw ────writes──► agent_events (Supabase) ──────► PMS shows live via Realtime
OpenClaw ────calls──► POST /api/agent-events ────────► PMS updates task status
```

### Key Tables
- `agents` — 24 AI agents with hierarchy (reports_to FK)
- `tasks` — unified tasks (user + agent tasks), has `assigned_agent_id`
- `agent_commands` — PMS → OpenClaw channel (command_type: run_task, ping, pause, cancel)
- `agent_events` — OpenClaw → PMS channel (event_type: task_started, progress, completed, etc.)
- `approvals` — human-in-the-loop approval requests from agents
- `gateways` — OpenClaw gateway connections
- `boards` — agent task boards linked to gateways
- `skills` — skills available to agents

---

## What's Built (Do Not Rebuild)

- ✅ Agents CRUD (`/agents`, `/agents/new`, `/agents/[id]/edit`)
- ✅ Agent Network visualization (`/agents/communication`)
- ✅ Approvals (`/approvals`)
- ✅ Gateways CRUD (`/gateways`)
- ✅ Boards + Board Groups + Webhooks + Custom Fields
- ✅ Skills Marketplace (`/skills/marketplace`)
- ✅ Tags, Activity feed
- ✅ Tasks Mission Control (`/tasks`) — Kanban + Live Activity Feed
- ✅ Agent Commands + Events tables (Supabase bridge)
- ✅ POST `/api/agent-events` (OpenClaw → PMS push endpoint)
- ✅ 24 agents seeded in DB with correct hierarchy

---

## What's Missing (Build These Next)

### Sprint 4 — Live Connection
- [ ] Models management page (`/models`) — see/switch which model each agent uses
- [ ] Sessions viewer (`/sessions`) — list active OpenClaw sessions, send messages
- [ ] Agent ping from UI — "Ping Agent" button dispatches a ping command
- [ ] Global pause/resume — pause all agent activity from PMS
- [ ] Memory viewer (`/memory`) — see what agents remember
- [ ] Agent heartbeat — agents ping PMS every 30s so status is live
- [ ] Real dashboard metrics — actual charts (task completion, WIP, velocity)

### Sprint 5 — Complete
- [ ] Skill install/uninstall from UI (calls OpenClaw via agent_commands)
- [ ] Model switching per agent (updates agent record + dispatches model change command)
- [ ] Webhook payload history viewer
- [ ] Agent nudge button (poke stuck agent to continue)
- [ ] Souls directory (searchable agent directory)
- [ ] Board onboarding chat (AI chat to set up boards)

---

## Quality Standards

- **0 TypeScript errors** — always run `pnpm.cmd build` before reporting done
- **No console.log** in production code
- **Error states** — every fetch must handle errors gracefully
- **Loading states** — every async operation needs a loading UI
- **Mobile responsive** — PMS is used on all screen sizes
- **RLS policies** — every new table needs Row Level Security
- **Realtime** — tables that need live updates must be added to `supabase_realtime` publication

---

## Organization Context

- **Fares's org ID**: `9c52b861-abb7-4774-9b5b-3fa55c8392cb`
- **Test user**: `e2e-test@example.com`
- **Supabase project**: `lazhmdyajdqbnxxwyxun.supabase.co`
- **GitHub**: `https://github.com/Faresabdelghany/PMS.git`
- **Vercel**: auto-deploys from `main` branch

---

## Agent Hierarchy (for reference)
```
Fares
  └── Ziko (Main Assistant — orchestrates everything)
        └── Nabil (Supreme Commander)
              ├── Omar (Tech Lead) → Mostafa, Sara, Ali, Yasser, Hady, Farah, Bassem
              ├── Karim (Marketing Lead) → Sami, Maya, Amir, Rami, Tarek, Mariam, Nour, Salma, Ziad
              ├── Design Lead → Design Agent
              └── Product Analyst → Researcher
```

---

**If you are about to build something and you are not sure it matches the existing design — STOP. Read the reference files listed above. Then build.**
