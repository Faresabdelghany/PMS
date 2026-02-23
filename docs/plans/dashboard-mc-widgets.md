# Dashboard Mission Control Widgets — Task Spec

**Spec Author:** Product Analyst  
**Date:** 2026-02-23  
**Priority:** High  
**Route:** Omar (Tech Lead) → Sara (Frontend)  
**QA:** Hady  
**File to Modify:** `app/(dashboard)/page.tsx` (EXTEND — do NOT replace)

---

## Overview

Fares wants the dashboard (`/`) to function as a live Mission Control hub — showing agent status, activity, active agent tasks, and quick-links to every MC section. The existing KPI cards, charts, and Mission Control cards must remain untouched; we add **four new sections below the charts**.

---

## Design Contract

- **Framework:** Next.js 16 App Router, React 19, TypeScript strict
- **UI:** shadcn/ui "new-york" (`Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`, `Badge`, `Avatar`, `Skeleton`, `Button`)
- **Icons:** Phosphor Icons (`@phosphor-icons/react/dist/ssr/*`) — follow existing imports in the file
- **Colors:** CSS variables ONLY (`text-muted-foreground`, `bg-muted`, `border`, etc.) — NO hardcoded hex
- **Patterns:** Match the existing `Suspense` + async server-component pattern already in the file
- **Auth:** `const { orgId } = await getPageOrganization()` — already in scope, pass orgId down

---

## What Already Exists (DO NOT TOUCH)

```tsx
// These exist and must remain:
<KPICards />           // 4 KPI cards: Projects, Tasks, Agents, Completed
<MissionControlCards /> // Pending Approvals + Gateway Status
<Charts />             // CompletionsBarChart + StatusAreaChart
```

---

## New Sections to Add

Add the following four sections, in this order, **after the `<Charts />` Suspense block**:

```
[existing content above]
<Charts />         ← already exists, leave as-is

--- NEW BELOW ---
<QuickLinks />
<AgentsStatusSection />
<ActivityAndTasksRow />    ← two-column grid: ActivityFeed | ActiveAgentTasks
```

---

## Section 1 — Mission Control Quick Links

**Purpose:** One-click navigation to every MC section with live count badges.

### Component Name
`MCQuickLinks` (async server component, defined at bottom of `page.tsx`)

### Data Requirements
Fetch counts in parallel using existing actions / Supabase queries:

| Link | Route | Icon | Count Source |
|------|-------|------|-------------|
| Agents | `/agents` | `Robot` | `getAgents(orgId)` → `data.length` |
| Tasks | `/tasks` | `ListChecks` | `getDashboardKPIs(orgId)` → `activeTasks` (already fetched) |
| Boards | `/boards` | `Kanban` | query `boards` table, count by orgId |
| Gateways | `/gateways` | `PlugsConnected` | query `gateways` table, count by orgId |
| Approvals | `/approvals?status=pending` | `ClipboardText` | `getPendingApprovalsCount(orgId)` (already fetched) |
| Skills | `/skills/marketplace` | `Wrench` | query `agent_skills` table, count by orgId |

> **Note:** For counts that are already fetched (agents, approvals), reuse the existing promises passed as props. For boards/gateways/skills — add a simple parallel fetch using `supabase.from("...").select("id", { count: "exact", head: true }).eq("organization_id", orgId)`.

### Layout
```
<div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
  {links.map(link => (
    <Link href={link.href}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer">
        <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
          <link.Icon className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">{link.label}</span>
          <Badge variant="secondary" className="text-xs">{link.count}</Badge>
        </CardContent>
      </Card>
    </Link>
  ))}
</div>
```

### Skeleton Fallback
Six `Skeleton` boxes in the same grid, each `h-[96px]`.

---

## Section 2 — Agents Status Section

**Purpose:** Instant visibility into which agents are online/busy/offline.

### Component Name
`AgentsStatusSection` (async server component)

### Data Source
```typescript
import { getAgents } from "@/lib/actions/agents"
const result = await getAgents(orgId)
const agents = result.data ?? []
```

### Layout Structure

```
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Agents Status</CardTitle>
    <Link href="/agents">
      <Button variant="ghost" size="sm">View All <ArrowRight /></Button>
    </Link>
  </CardHeader>
  <CardContent className="space-y-4">

    {/* Status summary pills */}
    <div className="flex gap-3">
      <StatusPill color="emerald" label="Online"  count={onlineCount}  />
      <StatusPill color="amber"   label="Busy"    count={busyCount}    />
      <StatusPill color="muted"   label="Offline" count={offlineCount} />
    </div>

    {/* Mini agent list — only online + busy agents, max 6 */}
    <div className="divide-y divide-border">
      {activeAgents.map(agent => (
        <div key={agent.id} className="flex items-center gap-3 py-2.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={agent.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{agent.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
          </div>
          <StatusDot status={agent.status} />
        </div>
      ))}
      {activeAgents.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No agents online right now
        </p>
      )}
    </div>

  </CardContent>
</Card>
```

### StatusPill helper (inline in file, not a separate file)
```tsx
function StatusPill({ color, label, count }: { color: "emerald" | "amber" | "muted"; label: string; count: number }) {
  const colorMap = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    muted:   "bg-muted text-muted-foreground",
  }
  return (
    <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", colorMap[color])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", { "bg-emerald-500": color === "emerald", "bg-amber-400": color === "amber", "bg-border": color === "muted" })} />
      {count} {label}
    </div>
  )
}
```

### StatusDot helper (inline)
```tsx
function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    online:  "bg-emerald-500",
    busy:    "bg-amber-400",
    offline: "bg-muted-foreground/30",
    idle:    "bg-blue-400",
  }
  return <span className={cn("h-2 w-2 rounded-full shrink-0", map[status] ?? "bg-muted-foreground/30")} />
}
```

### Skeleton Fallback
`Card` with `CardHeader` skeleton + 4 row skeletons (avatar + two lines).

---

## Section 3 — Recent Agent Activity Feed

**Purpose:** Live pulse of what agents are doing, last 10 events.

### Component Name
`RecentActivityFeed` (async server component)

### Data Source
```typescript
import { getAgentEvents } from "@/lib/actions/agent-events"
const result = await getAgentEvents(orgId, 10)
const events = result.data ?? []
```

### Layout
```
<Card className="flex flex-col">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
    <Link href="/activity">
      <Button variant="ghost" size="sm">View All <ArrowRight /></Button>
    </Link>
  </CardHeader>
  <CardContent className="flex-1 overflow-y-auto max-h-[320px]">
    {events.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Robot className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Dispatch a task to see live updates</p>
      </div>
    ) : (
      <div className="divide-y divide-border">
        {events.map(event => (
          <div key={event.id} className="flex items-start gap-3 py-2.5">
            <Avatar className="h-6 w-6 mt-0.5 shrink-0">
              <AvatarImage src={event.agent?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{event.agent?.name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{event.agent?.name ?? "System"}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{event.message}</p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formatTimeAgo(event.created_at)}
            </span>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

### `formatTimeAgo` helper (inline utility in file)
```typescript
function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
```

---

## Section 4 — Active Agent Tasks

**Purpose:** Tasks currently being executed by agents (assigned + in-progress).

### Component Name
`ActiveAgentTasks` (async server component)

### Data Source
```typescript
import { getOrgTasks } from "@/lib/actions/tasks-sprint3"
const result = await getOrgTasks(orgId, { status: "in_progress" })
// filter client-side: tasks where assigned_agent_id is not null
const agentTasks = (result.data ?? []).filter(t => t.assigned_agent_id != null).slice(0, 8)
```

> **Why client-side filter:** `getOrgTasks` accepts `agentId` filter but not "has agent" — filter the returned array. Keep it to max 8 items.

### Layout
```
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Active Agent Tasks</CardTitle>
    <Link href="/tasks">
      <Button variant="ghost" size="sm">View All <ArrowRight /></Button>
    </Link>
  </CardHeader>
  <CardContent>
    {agentTasks.length === 0 ? (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No agent tasks in progress
      </p>
    ) : (
      <div className="divide-y divide-border">
        {agentTasks.map(task => (
          <div key={task.id} className="flex items-center gap-3 py-2.5">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={task.agent?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{task.agent?.name?.[0] ?? "A"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.name}</p>
              <p className="text-xs text-muted-foreground truncate">{task.agent?.name ?? "Unknown agent"}</p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">in progress</Badge>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

---

## Two-Column Grid for Sections 3 & 4

Wrap `RecentActivityFeed` and `ActiveAgentTasks` in:
```tsx
<div className="grid gap-4 lg:grid-cols-2">
  <Suspense fallback={<ActivityFeedSkeleton />}>
    <RecentActivityFeed orgId={orgId} />
  </Suspense>
  <Suspense fallback={<ActiveTasksSkeleton />}>
    <ActiveAgentTasks orgId={orgId} />
  </Suspense>
</div>
```

---

## Final Page Structure (after changes)

```tsx
export default async function Page() {
  const { orgId } = await getPageOrganization()

  const kpisPromise = getDashboardKPIs(orgId)
  const completionsPromise = getDailyCompletions(orgId)
  const distributionPromise = getTaskStatusDistribution(orgId)
  const pendingApprovalsPromise = getPendingApprovalsCount(orgId).catch(() => ({ data: 0 }))

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header — unchanged */}
      {/* KPI Cards — unchanged */}
      <Suspense ...><KPICards /></Suspense>

      {/* Mission Control Cards — unchanged */}
      <Suspense ...><MissionControlCards /></Suspense>

      {/* Charts — unchanged */}
      <Suspense ...><Charts /></Suspense>

      {/* ── NEW SECTIONS ── */}

      {/* Quick Links */}
      <Suspense fallback={<QuickLinksSkeleton />}>
        <MCQuickLinks orgId={orgId} pendingCount={pendingApprovalsPromise} />
      </Suspense>

      {/* Agents Status */}
      <Suspense fallback={<AgentsStatusSkeleton />}>
        <AgentsStatusSection orgId={orgId} />
      </Suspense>

      {/* Activity Feed + Active Tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ActivityFeedSkeleton />}>
          <RecentActivityFeed orgId={orgId} />
        </Suspense>
        <Suspense fallback={<ActiveTasksSkeleton />}>
          <ActiveAgentTasks orgId={orgId} />
        </Suspense>
      </div>

    </div>
  )
}
```

---

## Required Imports to Add

```typescript
import { getAgents } from "@/lib/actions/agents"
import { getAgentEvents } from "@/lib/actions/agent-events"
import { getOrgTasks } from "@/lib/actions/tasks-sprint3"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
// New Phosphor icons (check if already imported; if not, add):
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"
import { Kanban } from "@phosphor-icons/react/dist/ssr/Kanban"
import { Wrench } from "@phosphor-icons/react/dist/ssr/Wrench"
// Already imported: Robot, ListChecks, ClipboardText, PlugsConnected
```

---

## Skeleton Components Required

Define these inline in `page.tsx`:

```tsx
function QuickLinksSkeleton() {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
    </div>
  )
}

function AgentsStatusSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ActivityFeedSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
      <CardContent className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-3 w-10 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ActiveTasksSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
      <CardContent className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

---

## Quality Checklist (Sara must verify before reporting done)

- [ ] `pnpm.cmd build` passes with 0 TypeScript errors
- [ ] No `console.log` in production code
- [ ] All colors are CSS variables only
- [ ] Dark mode works (check with `.dark` class)
- [ ] Loading states: every `Suspense` has a skeleton fallback
- [ ] Empty states: all three data sections have empty-state messages
- [ ] No hardcoded org IDs or user IDs
- [ ] No new server actions created (use existing ones)
- [ ] Existing sections (KPIs, Charts, MissionControlCards) are visually unchanged
- [ ] Mobile responsive: quick links stack to 2 columns on small screens

---

## Notes for Sara

1. **Keep all new async components at the bottom of `page.tsx`** after the existing `KPICards`, `Charts`, and `MissionControlCards` components.
2. **Pass `orgId` as a prop** to each new async component — do not call `getPageOrganization()` again inside them.
3. **The `MCQuickLinks` board/gateway/skills counts** can be fetched with a minimal Supabase query:
   ```typescript
   const supabase = await createClient()
   const { count: boardCount } = await supabase
     .from("boards")
     .select("id", { count: "exact", head: true })
     .eq("organization_id", orgId)
   ```
4. **Import `createClient` from `@/lib/supabase/server`** for any direct Supabase queries inside server components.
5. **`getAgentEvents` uses `requireAuth()` internally** — no extra auth needed when calling from a server component.
6. **The `ArrowRight` icon** is in Phosphor: `@phosphor-icons/react/dist/ssr/ArrowRight`.

---

## Reporting

When done, Sara reports to Omar → Omar reviews → Omar hands to Hady for QA → Hady writes report to `docs/reports/hady-qa-report.md` → Omar signs off → Product Analyst collects sign-off.
