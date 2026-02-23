# Omar Sign-off — Design Fix + Agent Network

**Date:** 2026-02-23  
**Sprint:** Post-Sprint 3 Design Remediation  
**Status:** ✅ Complete — `pnpm build` passes, 0 TypeScript errors

---

## Design System Compliance

Before writing a single line of code, Sara (this run) read:
- `docs/design-system.json` — all tokens: OKLCH colors, typography, spacing, shadows, border-radius, animations
- `docs/design_concept.json` — philosophy, hierarchy, whitespace, feedback principles
- `components/project-board-view.tsx` — Kanban column gold standard
- `components/projects-content.tsx` — page structure gold standard
- `components/project-header.tsx` — header pattern
- `components/ui/page-header.tsx` — PageHeader component
- `app/(dashboard)/projects/page.tsx` + `clients/page.tsx` — reference pages
- `~/.agents/skills/ui-ux-pro-max/SKILL.md` — design intelligence

All decisions come from the design system. No invented patterns.

---

## Issue 1: Tasks Board Design Mismatch — FIXED

### What was wrong
The Tasks board (`components/tasks/TasksBoard.tsx`) had:
- ❌ Column background: `bg-accent/20 border border-border/40` — wrong, looked like a different app
- ❌ Column status indicators: colored dots — inconsistent with project-board-view.tsx which uses Phosphor icons
- ❌ "New Task" button in header: hardcoded `bg-purple-600 hover:bg-purple-700` — violates "no hardcoded colors" rule
- ❌ Page wrapper (`tasks/page.tsx`): `flex flex-col h-full` — missing the `bg-background mx-2 my-2 border border-border rounded-lg` envelope that Projects/Clients use
- ❌ Stats bar + filter bar borders: `border-border/40` — should be `border-border`

### What was fixed
**`app/(dashboard)/tasks/page.tsx`:**
- Outer wrapper changed to `flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0` — matches Projects exactly
- "New Task" button changed to `variant="ghost" size="sm"` — matches "Add Project" in project-header.tsx
- Skeleton updated to match grid layout

**`components/tasks/TasksBoard.tsx`:**
- Outer wrapper removed (page now provides it), replaced with `flex flex-col flex-1 min-h-0`
- **Kanban columns**: `rounded-xl bg-muted` — exactly matches `project-board-view.tsx:167`
- **Column header**: Phosphor icons per column type (`Circle`, `CircleNotch`, `CheckCircle`, `ArrowsClockwise`) — matches project-board-view pattern
- **Column count badge**: plain `text-xs text-muted-foreground` — no box
- **Column action buttons**: `Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"` — exact match
- **Add task button**: `Button variant="ghost" size="sm"` with Plus icon — matches project-board-view
- **Filter chips**: `bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground` inactive / `bg-accent text-foreground` active — CSS variables only
- **Stats bar**: `border-b border-border` — correct
- **Live Activity panel**: `border-l border-border` — correct
- All icon imports: `/dist/ssr/` variants (SSR-safe)
- All colors: CSS custom properties only — zero hardcoded hex values

---

## Issue 2: Agent Network Visualization — BUILT

### What was built
**`app/(dashboard)/agents/communication/page.tsx`:**
- Server Component fetching agents via `getAgents(orgId)` + Suspense with skeleton
- Outer wrapper: `flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0` — matches Projects/Clients
- `PageHeader` with title "Agent Network" — per CLAUDE.md rule "every page uses PageHeader"

**`components/agents/AgentNetworkClient.tsx`:**
- Client Component — interactive tree with sheet detail panel
- **Tree layout**: top-down, recursive, built from `reports_to` FK field
- **Fixed-width nodes** (`w-28` = 112px): ensures connector math is exact — horizontal bar uses `inset-x-14` (56px = w-28/2), aligning precisely with child centers regardless of gap size
- **Fares node**: gold avatar, "Human Operator", synthetic root above all agents
- **Agent nodes**: avatar circle (initials) + name + role + status dot
- **Squad colors** (per CLAUDE.md spec): engineering=`bg-blue-500`, marketing=`bg-purple-500`, all/design=`bg-emerald-500`, supreme=`bg-yellow-500`
- **Status dots**: online=`bg-emerald-500`, busy/idle=`bg-amber-500`, offline=`bg-muted-foreground/60`
- **Connecting lines**: `w-px h-4 bg-border` vertical + `absolute inset-x-14 h-px bg-border` horizontal bar
- **Click → Sheet**: shadcn `Sheet` from right showing name, role, squad, status, description, model, capabilities, supervisor, "Ping Agent" button (fires toast)
- **Legend**: squad colors + status dots — `text-xs text-muted-foreground` per design system
- **Empty state**: `bg-muted rounded-lg` icon box + copy — matches project empty states
- All typography: from design-system.json scale (`text-sm font-medium`, `text-xs`, `text-[10px]`)
- All spacing: from design-system.json semantic tokens (`p-3`, `p-6`, `gap-1.5`, `gap-4`, `gap-6`)
- All transitions: `transition-colors` at 200ms
- Focus states: `focus-visible:ring-[3px] focus-visible:ring-ring/50`

**`components/app-sidebar.tsx`:**
- Added `GitFork` icon import (`/dist/ssr/`)
- Added `"agent-network"` to `NavItemId` type
- Added `{ id: "agent-network", label: "Agent Network" }` to `navItems` (after Agents)
- Added icon mapping: `"agent-network": GitFork`
- Added preload handler (imports `AgentNetworkClient`)
- Added href: `/agents/communication`
- Updated `isItemActive`: Agents only active on `/agents/*` (excluding `/agents/communication`); Agent Network active on `/agents/communication`

---

## Build Result

```
✓ Compiled successfully in 57s
✓ Generating static pages (35/35)

Route (app)
├ ƒ /agents/communication    ← NEW
├ ƒ /tasks                   ← FIXED
```

**TypeScript errors: 0**  
**Runtime warnings: Sentry auth token (pre-existing, unrelated to our changes)**

---

## Files Changed

| File | Change |
|------|--------|
| `app/(dashboard)/tasks/page.tsx` | Wrapper + button style |
| `components/tasks/TasksBoard.tsx` | Full design rewrite |
| `app/(dashboard)/agents/communication/page.tsx` | NEW |
| `components/agents/AgentNetworkClient.tsx` | NEW |
| `components/app-sidebar.tsx` | Agent Network nav item |

— **Omar**, Tech Lead
