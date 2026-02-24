# Models / Sessions / Memory — V2 Spec

**Author:** Product Analyst  
**Date:** 2026-02-24  
**Status:** Ready for implementation

---

## Overview

Three features: (1) redesign Settings → Agents into multi-model management, (2) /sessions page, (3) /memory page.

---

## Task 1: Settings → Models Pane

### 1a. Sidebar rename
**File:** `components/settings/settings-sidebar.tsx`
- Change label `"Agents"` → `"Models"` (keep id `"agents"`)
- Change icon from `Robot` → `Brain` (import `@phosphor-icons/react/dist/ssr/Brain`)

### 1b. DB migration
**File:** `supabase/migrations/20260224000003_user_models.sql`

```sql
CREATE TABLE public.user_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  display_name text NOT NULL,
  provider text NOT NULL,
  model_id text NOT NULL,
  api_key_encrypted text,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_models_org ON public.user_models(organization_id);
ALTER TABLE public.user_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.user_models FOR ALL USING (
  organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid())
);
```

**NOTE:** Fares must apply manually via Supabase Dashboard → SQL Editor.

### 1c. Server actions
**File:** `lib/actions/user-models.ts`

| Function | Purpose |
|----------|---------|
| `getUserModels(orgId)` | Fetch all models for org, ordered by `is_default DESC, display_name` |
| `createUserModel(data)` | Insert new model config |
| `updateUserModel(id, data)` | Update existing model config |
| `deleteUserModel(id)` | Delete model config |
| `setDefaultModel(id, orgId)` | Unset all defaults for org, set this one |

Use `requireAuth()` + org membership check. Use `supabase.from("user_models" as any)` since table isn't in generated types yet. Return `ActionResult<T>`.

### 1d. Rewrite agents-pane.tsx
**File:** `components/settings/panes/agents-pane.tsx`

Layout:
- `SettingsPaneHeader` title="Models" description="Manage AI models available to your agents."
- List of saved models as cards. Each shows: display_name, provider badge (muted bg), model_id, masked API key (last 4 chars), default badge (if is_default)
- Each card: Edit (pencil icon), Delete (trash icon), Set Default (star icon) buttons
- Default model card has accent border/highlight
- "Add Model" button opens inline form below the list
- Form fields: display_name (Input), provider (Select from AI_PROVIDERS), model (Select from AI_MODELS filtered by provider), api_key (Input with show/hide Eye toggle), is_default (Checkbox)
- Save + Cancel buttons on form
- Edit mode reuses the same form inline, replacing the card

Keep existing test connection functionality — move it to a "Test" button on each card that has an API key.

### 1e. Update AgentDetailPanel model selector
**File:** `components/agents/AgentDetailPanel.tsx`

Replace hardcoded `MODEL_MAP` with a fetch from `getUserModels(orgId)`. The model picker should show models from user_models table as: `display_name (provider/model_id)`. Fall back to existing MODEL_MAP if no user_models configured.

---

## Task 2: /sessions Page

### 2a. Route
**File:** `app/(dashboard)/sessions/page.tsx`

Server component. Uses `getPageOrganization()`, calls `getAgentSessions(orgId)`, renders `SessionsContent`.

### 2b. Server actions
**File:** `lib/actions/sessions.ts`

| Function | Purpose |
|----------|---------|
| `getAgentSessions(orgId)` | Query agents table joined with latest agent_event per agent. Compute status: Active (event <15min), Idle (<1h), Offline (>1h or no events). Return array of `{agent, lastEvent, status}` |
| `getAgentEventHistory(agentId, orgId, limit=20)` | Get last N events for an agent |

### 2c. Component
**File:** `components/sessions/SessionsContent.tsx`

Client component.
- PageHeader title="Sessions"
- Filter chips: All / Active / Idle / Offline (use Button variant="outline" with active state)
- Card grid (responsive: 1-2-3 cols). Each card:
  - Agent avatar + name + role
  - Status dot: green=Active, yellow=Idle, gray=Offline
  - Last event message (truncated)
  - Relative timestamp
- Click card → open Sheet (from right) with timeline of last 20 events
  - Each event: icon by type, message, timestamp
- Auto-refresh: `useEffect` with `setInterval` 30s calling `router.refresh()`

### 2d. Sidebar
**File:** `components/app-sidebar.tsx`
- Add to `navItems`: `{ id: "sessions", label: "Sessions" }`
- Add to `NavItemId` union type
- Add icon: `Terminal` (already imported)
- Add href: `/sessions`
- Add `isItemActive` case
- Add preload handler (empty)

---

## Task 3: /memory Page

### 3a. Route
**File:** `app/(dashboard)/memory/page.tsx`

Server component. `getPageOrganization()`, calls `getAgentMemoryCards(orgId)`, renders `MemoryContent`.

### 3b. Server actions
**File:** `lib/actions/memory.ts`

| Function | Purpose |
|----------|---------|
| `getAgentMemoryCards(orgId)` | Query agents with current_task joined to tasks.name + latest event. Return `{agent, currentTask, lastEvent}` |

Reuse `getAgentEventHistory` from sessions.ts for the detail sheet.

### 3c. Component
**File:** `components/memory/MemoryContent.tsx`

Client component.
- PageHeader title="Memory"
- Search input (filter by agent name, client-side)
- Card grid. Each card:
  - Agent name + role
  - Current task name (or "No active task")
  - Last event message + timestamp
- Click card → Sheet with last 20 events (reuse same timeline component from sessions)

### 3d. Sidebar
**File:** `components/app-sidebar.tsx`
- Add to `navItems`: `{ id: "memory", label: "Memory" }`
- Add icon: `Notebook` from `@phosphor-icons/react/dist/ssr/Notebook`
- Add href: `/memory`
- Add `isItemActive` case

---

## Shared: Timeline component

**File:** `components/shared/AgentEventTimeline.tsx`

Reusable timeline component used by both Sessions and Memory sheets. Props: `events: AgentEventWithAgent[]`. Renders vertical timeline with event type icon, message, relative time.

---

## Design Notes
- All pages use `PageHeader` component
- Page wrapper: `flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0`
- Dark mode compatible (CSS variables only)
- shadcn/ui components + Phosphor icons
- Server actions pattern, React Hook Form + Zod for forms
- 0 TypeScript errors required (`pnpm.cmd build`)

---

## Files to create
1. `supabase/migrations/20260224000003_user_models.sql`
2. `lib/actions/user-models.ts`
3. `lib/actions/sessions.ts`
4. `lib/actions/memory.ts`
5. `components/sessions/SessionsContent.tsx`
6. `components/memory/MemoryContent.tsx`
7. `components/shared/AgentEventTimeline.tsx`
8. `app/(dashboard)/sessions/page.tsx`
9. `app/(dashboard)/memory/page.tsx`

## Files to modify
1. `components/settings/settings-sidebar.tsx` — label + icon
2. `components/settings/panes/agents-pane.tsx` — full rewrite
3. `components/agents/AgentDetailPanel.tsx` — model selector
4. `components/app-sidebar.tsx` — add Sessions + Memory nav
