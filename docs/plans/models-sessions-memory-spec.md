# Spec: /models, /sessions, /memory Pages

**Author:** Product Analyst  
**Date:** 2025-02-24  
**Sprint:** 4 — Live Connection  

---

## Overview

Three new Mission Control pages to manage AI models, view agent sessions, and inspect agent memory/state.

---

## Page 1: /models — AI Model Configuration

**Route:** `app/(dashboard)/models/page.tsx`  
**Server actions:** `lib/actions/models.ts`

### Data Source
`agents` table — columns: `id, name, role, model, status`

### Server Actions

```typescript
// lib/actions/models.ts
getAgentModels(orgId: string): ActionResult<AgentModel[]>
updateAgentModel(agentId: string, model: string): ActionResult<void>
```

### Available Models
| Model | Provider | Tier |
|-------|----------|------|
| `anthropic/claude-opus-4-6` | Anthropic | Premium |
| `anthropic/claude-sonnet-4-6` | Anthropic | Standard |
| `groq/llama-3.1-8b-instant` | Groq | Free |
| `groq/llama-3.3-70b-versatile` | Groq | Free |
| `google/gemini-2.0-flash` | Google | Standard |
| `google/gemini-2.5-pro` | Google | Standard |
| `openai/gpt-4o` | OpenAI | Premium |
| `openai/gpt-4o-mini` | OpenAI | Standard |

### UI Components
1. **Summary stats bar** — 3 cards: count of agents per tier (Free / Standard / Premium)
2. **Table** — columns: Agent Name, Role, Current Model (with tier badge), Status
3. **Sheet panel** (on row click) — Edit model via dropdown, save button
4. **Tier badges**: Free = green, Standard = blue, Premium = purple/gold

### Sidebar
- ID: `"models"` 
- Label: `"Models"`
- Icon: `Brain` from `@phosphor-icons/react/dist/ssr/Brain`
- Href: `/models`
- isActive: `pathname.startsWith("/models")`

---

## Page 2: /sessions — Agent Session Viewer

**Route:** `app/(dashboard)/sessions/page.tsx`  
**Server actions:** `lib/actions/sessions.ts`

### Data Source
`agent_events` table — derive session activity from events

### Server Actions

```typescript
// lib/actions/sessions.ts
getAgentSessions(orgId: string): ActionResult<AgentSession[]>
// Returns per-agent: { agentId, agentName, role, avatarUrl, lastEventTime, lastEventMessage, status }

getAgentEventHistory(agentId: string, orgId: string, limit?: number): ActionResult<AgentEvent[]>
// Returns last N events for a specific agent
```

### Status Derivation
- **Active**: last event within 15 minutes
- **Idle**: last event within 1 hour
- **Offline**: no event in last hour (or never)

### UI Components
1. **Filter bar** — tabs: All / Active / Idle / Offline (with counts)
2. **Agent list** — card/row per agent: avatar, name, role, status badge, last message, timestamp
3. **Click agent** → Sheet with recent events timeline (last 20 events)
4. **Auto-refresh** — `useEffect` with 30s `setInterval` calling `startTransition` + server action re-fetch

### Sidebar
- ID: `"sessions"`
- Label: `"Sessions"`
- Icon: `Terminal` from `@phosphor-icons/react/dist/ssr/Terminal`
- Href: `/sessions`
- isActive: `pathname.startsWith("/sessions")`

---

## Page 3: /memory — Agent Memory Viewer

**Route:** `app/(dashboard)/memory/page.tsx`  
**Server actions:** Reuse `getAgentEvents` from `lib/actions/agent-events.ts` + new helper

### Data Source
`agent_events` table grouped by agent — last known state per agent

### Server Actions

```typescript
// lib/actions/memory.ts (thin wrapper)
getAgentMemoryCards(orgId: string): ActionResult<AgentMemoryCard[]>
// For each agent: { agentId, name, role, status, avatarUrl, lastEventMessage, lastEventTime }
// Reuses agent_events query grouped by agent
```

### UI Components
1. **Search bar** — filter by agent name
2. **Card grid** — responsive grid of agent cards
   - Each card: avatar, name, role, status badge, last event message (truncated), relative time
3. **Click card** → Sheet with full recent activity (last 20 events, reuse `getAgentEventHistory` from sessions)

### Sidebar
- ID: `"memory"`
- Label: `"Memory"`
- Icon: `Notebook` from `@phosphor-icons/react/dist/ssr/Notebook`
- Href: `/memory`
- isActive: `pathname.startsWith("/memory")`

---

## Sidebar Changes

In `components/app-sidebar.tsx`:

1. Add to `NavItemId` type: `| "models" | "sessions" | "memory"`
2. Add to `navItems` array (after `"skills"`):
   ```
   { id: "models", label: "Models" },
   { id: "sessions", label: "Sessions" },
   { id: "memory", label: "Memory" },
   ```
3. Add icons to `navItemIcons`
4. Add href mappings to `getHrefForNavItem`
5. Add active checks to `isItemActive`
6. Add preload handlers (empty or with component imports)

---

## Design Constraints

- Use `PageHeader` component on all pages
- Page wrapper: `flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0`
- shadcn/ui Sheet for detail panels
- CSS variables only for colors
- Phosphor icons (SSR imports)
- Server actions pattern (no TanStack Query)
- React Hook Form + Zod for the model edit form
- 0 TypeScript errors — `pnpm.cmd build` must pass
- Dark mode compatible

---

## Implementation Order

1. `lib/actions/models.ts` + `lib/actions/sessions.ts` + `lib/actions/memory.ts`
2. `/models` page + components
3. `/sessions` page + components  
4. `/memory` page + components
5. Sidebar updates
6. `pnpm.cmd build` — fix all errors
