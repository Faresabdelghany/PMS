# Regression Fix Brief — Omar (Tech Lead)
**From:** Product Analyst  
**Date:** 2026-02-23  
**Priority:** CRITICAL — Hady QA returned 🔴 FAIL  
**Assignees:** Sara (Fixes 1, 2, 4) · Mostafa (Fix 3)

Read Hady's full QA report first:  
`C:\Users\Fares\Downloads\PMS\docs\reports\hady-qa-report.md`

---

## MANDATORY: Read Before Any Code
Both Sara and Mostafa MUST read before writing a single line:
- `C:\Users\Fares\Downloads\PMS\CLAUDE.md`
- `C:\Users\Fares\Downloads\PMS\docs\design-system.json`

---

## Fix 1 — Restore `/tasks` Page (Sara) · HIGHEST PRIORITY · ~2-3h

### Problem
Sprint 3 replaced the entire `/tasks` route with `TasksBoard.tsx` (Mission Control Kanban).  
`MyTasksPage.tsx` still exists but is unreachable. Fares lost:
- Personal task view (tasks assigned to him)
- Drag-and-drop Kanban (`@dnd-kit`)
- Full `TaskDetailPanel` (comments, reactions, @mentions)
- Multi-view modes (List, Kanban, Week board, Timeline)
- Rich filter system

### Solution: Tab Switcher on `/tasks`
Add two tabs at the top of `app/(dashboard)/tasks/page.tsx`:
- **Tab "My Tasks"** → renders `MyTasksPage` (the original personal view)
- **Tab "Mission Control"** → renders `TasksBoard` (the Sprint 3 org-wide Kanban)

Default tab = "My Tasks" (that's what Fares had before).

### Implementation

**File:** `app/(dashboard)/tasks/page.tsx`

```tsx
import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getOrgTasks, getOrgTaskStats } from "@/lib/actions/tasks-sprint3"
import { getAgentEvents } from "@/lib/actions/agent-events"
import { getAgents } from "@/lib/actions/agents"
import { getProjects } from "@/lib/actions/projects"        // already exists
import { getMyTasks } from "@/lib/actions/tasks"            // already exists
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TasksBoard } from "@/components/tasks/TasksBoard"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = {
  title: "Tasks — PMS",
}

export const revalidate = 30

export default async function TasksPage() {
  const { orgId, user } = await getPageOrganization()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader
        title="Tasks"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks/new">
              <Plus size={14} weight="bold" className="mr-1.5" />
              New Task
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="my-tasks" className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border px-4">
          <TabsList className="h-auto p-0 bg-transparent gap-0 rounded-none">
            <TabsTrigger
              value="my-tasks"
              className="relative -mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground bg-transparent shadow-none"
            >
              My Tasks
            </TabsTrigger>
            <TabsTrigger
              value="mission-control"
              className="relative -mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground bg-transparent shadow-none"
            >
              Mission Control
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-tasks" className="flex-1 mt-0 min-h-0">
          <Suspense fallback={<MyTasksSkeleton />}>
            <MyTasksData orgId={orgId} userId={user.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="mission-control" className="flex-1 mt-0 min-h-0">
          <Suspense fallback={<MissionControlSkeleton />}>
            <MissionControlData orgId={orgId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

> **Check `MyTasksPage` props carefully** — read `components/tasks/MyTasksPage.tsx` fully before writing `MyTasksData`. It expects `tasks`, `projects`, and `userId`. Fetch them in a server async component and pass them down. Look at how the old `app/(dashboard)/tasks/page.tsx` (before Sprint 3) fetched data — check git history or infer from the component's prop types.

`MissionControlData` stays exactly as it is now (copy the existing async component).

> **Rule:** Do NOT touch `MyTasksPage.tsx`, `TaskKanbanBoardView.tsx`, or `TaskDetailPanel.tsx`. EXTEND — never modify existing components.

### Also fix these 3 one-liners in `lib/actions/tasks-sprint3.ts`:
```typescript
// Line ~145 — status enum uses dash not underscore:
"in_progress" → "in-progress"

// Lines ~208, ~234 — wrong revalidation (route groups aren't in URLs):
revalidatePath("/(dashboard)/tasks", "page") → revalidatePath("/tasks")
```

---

## Fix 2 — `reports_to` Field in Agent Forms (Sara) · ~1h

**This is now FULLY COVERED by Fix 4 below** (the new AgentDetailPanel includes `reports_to`).  
Sara should build Fix 4 and Fix 2 is resolved as part of it. See Fix 4.

---

## Fix 3 — Wire Up Real Ping Agent (Mostafa) · ~30min

### Problem
`components/agents/AgentNetworkClient.tsx` — `handlePing()` is a fake toast.  
It does NOT call any server action or create a DB row. Fares thinks pings are being sent — they're not.

### What Mostafa needs to read first:
- `components/agents/AgentNetworkClient.tsx` — find `handlePing` (~line 210)
- `lib/actions/agent-commands.ts` — `pingAgent()` already exists and is ready to use

### Fix:

**File:** `components/agents/AgentNetworkClient.tsx`

Find the `AgentDetailSheet` component (it's a client component, already `"use client"`).

**Step 1** — Add `orgId: string` as a prop to `AgentNetworkClient` and thread it through to `AgentDetailSheet`:
```tsx
// AgentNetworkClient props:
interface AgentNetworkClientProps {
  agents: AgentWithSupervisor[]
  orgId: string              // ← ADD THIS
}

// AgentDetailSheet props:
interface AgentDetailSheetProps {
  agent: AgentWithSupervisor | null
  open: boolean
  onClose: () => void
  orgId: string              // ← ADD THIS
}
```

**Step 2** — Thread `orgId` from the parent server component:

**File:** `app/(dashboard)/agents/communication/page.tsx`  
Find where `<AgentNetworkClient agents={agents} />` is rendered.  
Change to: `<AgentNetworkClient agents={agents} orgId={orgId} />`  
(orgId is already fetched via `getPageOrganization()` in that page)

**Step 3** — Replace the fake `handlePing` with the real one:
```typescript
// At the top of AgentDetailSheet component (inside the function body):
const [pinging, setPinging] = useState(false)

// Replace handlePing entirely:
const handlePing = async () => {
  setPinging(true)
  try {
    const result = await pingAgent(orgId, agent.id, `Ping from Mission Control UI`)
    if (result.error) {
      toast.error(`Ping failed: ${result.error}`)
    } else {
      toast.success(`Ping sent to ${agent.name}`)
    }
  } catch {
    toast.error("Failed to send ping")
  } finally {
    setPinging(false)
  }
}
```

**Step 4** — Add the import at the top of the file:
```typescript
import { pingAgent } from "@/lib/actions/agent-commands"
```

**Step 5** — Update the Ping button to show loading state:
Find the Button that calls `handlePing` and add `disabled={pinging}`:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handlePing}
  disabled={pinging}
  className="..."
>
  {pinging ? "Pinging..." : "Ping Agent"}
</Button>
```

**Note for Mostafa:** `pingAgent` is a `"use server"` action — it can be called directly from a client component. No API route needed.

---

## Fix 4 — Agent Detail/Add/Edit Panel (Sara) · ~3-4h · FARES PRIORITY

This replaces the separate `/agents/new` and `/agents/[id]/edit` pages with a URL-driven Sheet panel, exactly like `TaskDetailPanel`.

### Sara MUST read these files completely before writing a single line:
1. `components/tasks/TaskDetailPanel.tsx` — the exact pattern to follow
2. `components/tasks/TaskDetailHeader.tsx`
3. `components/tasks/TaskDetailFields.tsx`
4. `components/ui/sheet.tsx`
5. `lib/actions/agents.ts` — `createAgent`, `updateAgent`, `getAgent`, `getAgents` all exist

### Step 1 — Create `components/agents/AgentDetailPanel.tsx`

**Pattern:** URL-driven Sheet, exactly like `TaskDetailPanel`.

- Opens when URL has `?agent=<id>` → edit existing agent
- Opens when URL has `?agent=new` → create new agent
- On close → `router.push("/agents")` (strips the query param)
- `"use client"` component (reads search params, uses router)
- Loads agent data: when `agentId !== "new"`, call `getAgent(agentId)` in a `useEffect`

**Full field list (all editable inline):**

| Field | Component | Notes |
|---|---|---|
| Name | `Input` | Required |
| Role | `Input` | Required |
| Description | `Textarea` | Optional |
| Agent Type | `Select` | supreme / lead / specialist / integration |
| Squad | `Select` | engineering / marketing / all |
| Status | `Select` | online / busy / idle / offline |
| AI Provider | `Select` | anthropic / google / openai / other |
| AI Model | `Select` | Filtered by provider (see model map below) |
| Reports To | `Select` | All other agents by name — pass `agents` list as prop |
| Is Active | `Switch` from shadcn | Boolean toggle |

**AI Model map (hardcode this in the component):**
```typescript
const MODEL_MAP: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-opus-4-6",   label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-3-5",  label: "Claude Haiku 3.5" },
  ],
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.5-pro",   label: "Gemini 2.5 Pro" },
  ],
  openai: [
    { value: "gpt-4o",      label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "o1",          label: "o1" },
    { value: "o3-mini",     label: "o3-mini" },
  ],
  other: [
    { value: "custom", label: "Custom / Other" },
  ],
}
```

When provider changes → reset model to first model of new provider.

**Form:** Use React Hook Form + Zod (CLAUDE.md mandatory).

Zod schema (mirror the server-side `createAgentSchema` / `updateAgentSchema` in `lib/actions/agents.ts`):
```typescript
import { z } from "zod"
const agentFormSchema = z.object({
  name:         z.string().trim().min(1, "Name is required").max(200),
  role:         z.string().trim().min(1, "Role is required").max(200),
  description:  z.string().max(2000).optional().nullable(),
  agent_type:   z.enum(["supreme", "lead", "specialist", "integration"]),
  squad:        z.enum(["engineering", "marketing", "all"]),
  status:       z.enum(["online", "busy", "idle", "offline"]),
  ai_provider:  z.string().max(100).optional().nullable(),
  ai_model:     z.string().max(200).optional().nullable(),
  reports_to:   z.string().uuid().optional().nullable(),
  is_active:    z.boolean(),
})
type AgentFormValues = z.infer<typeof agentFormSchema>
```

**Component skeleton:**
```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAgent, createAgent, updateAgent } from "@/lib/actions/agents"
import type { AgentWithSupervisor } from "@/lib/supabase/types"

// ... schema + MODEL_MAP defined above ...

interface AgentDetailPanelProps {
  agents: AgentWithSupervisor[]   // all org agents (for "Reports To" dropdown)
  orgId: string
}

export function AgentDetailPanel({ agents, orgId }: AgentDetailPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentParam = searchParams.get("agent")   // null | "new" | "<uuid>"

  const isOpen = agentParam !== null
  const isNew  = agentParam === "new"

  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "", role: "", description: "",
      agent_type: "specialist", squad: "engineering",
      status: "offline", ai_provider: "anthropic",
      ai_model: "claude-sonnet-4-6", reports_to: null,
      is_active: true,
    },
  })

  const provider = form.watch("ai_provider") ?? "anthropic"

  // Load existing agent data when editing
  useEffect(() => {
    if (!agentParam || agentParam === "new") {
      form.reset({ /* defaults */ })
      return
    }
    setLoading(true)
    getAgent(agentParam).then((result) => {
      if (result.data) {
        const a = result.data
        form.reset({
          name: a.name, role: a.role,
          description: a.description ?? "",
          agent_type: a.agent_type, squad: a.squad,
          status: a.status,
          ai_provider: a.ai_provider ?? "anthropic",
          ai_model: a.ai_model ?? "claude-sonnet-4-6",
          reports_to: a.reports_to ?? null,
          is_active: a.is_active ?? true,
        })
      }
      setLoading(false)
    })
  }, [agentParam])

  const handleClose = () => router.push("/agents")

  const onSubmit = async (values: AgentFormValues) => {
    setSaving(true)
    try {
      const result = isNew
        ? await createAgent(orgId, { ...values, sort_order: 0, capabilities: [], skills: [] })
        : await updateAgent(agentParam!, values)

      if (result.error) { toast.error(result.error); return }
      toast.success(isNew ? "Agent created" : "Agent updated")
      router.push("/agents")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-[440px] sm:w-[500px] overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle>{isNew ? "New Agent" : "Edit Agent"}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 p-6 space-y-4">
            {/* Skeleton placeholders */}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Name */}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl><Input placeholder="Agent name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Role */}
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <FormControl><Input placeholder="e.g. Senior Frontend Engineer" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Description */}
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What does this agent do?" rows={3}
                        {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Agent Type + Squad — 2-col grid */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="agent_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="supreme">Supreme</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="specialist">Specialist</SelectItem>
                          <SelectItem value="integration">Integration</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="squad" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Squad</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="engineering">Engineering</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Status */}
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="idle">Idle</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* AI Provider */}
                <FormField control={form.control} name="ai_provider" render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Provider</FormLabel>
                    <Select value={field.value ?? "anthropic"} onValueChange={(val) => {
                      field.onChange(val)
                      // Reset model to first option for this provider
                      const models = MODEL_MAP[val] ?? MODEL_MAP.anthropic
                      form.setValue("ai_model", models[0].value)
                    }}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* AI Model — filtered by provider */}
                <FormField control={form.control} name="ai_model" render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Model</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(MODEL_MAP[provider] ?? MODEL_MAP.anthropic).map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Reports To */}
                <FormField control={form.control} name="reports_to" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reports To</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="No supervisor" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">— No supervisor</SelectItem>
                        {agents
                          .filter((a) => a.id !== agentParam)   // exclude self when editing
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Is Active */}
                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel className="text-sm font-medium">Active</FormLabel>
                      <p className="text-xs text-muted-foreground">Agent can receive tasks and commands</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />

              </div>

              {/* Footer with Save / Cancel */}
              <div className="border-t border-border p-4 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : isNew ? "Create Agent" : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

### Step 2 — Update `app/(dashboard)/agents/page.tsx`

- Keep as Server Component (already is)
- Fetch `agents` server-side and pass to both `AgentsTable` and `AgentDetailPanel`
- Change "New Agent" button href from `/agents/new` → `?agent=new`
- Mount `<AgentDetailPanel agents={agents} orgId={orgId} />` at bottom of page

```tsx
// In the page, replace the New Agent Link:
<Link href="?agent=new">   // ← was href="/agents/new"

// Add at bottom of page JSX (inside the component, after the table):
<AgentDetailPanel agents={agents} orgId={orgId} />
```

**Important:** `AgentDetailPanel` uses `useSearchParams()` — it must be wrapped in a `Suspense` boundary in the Server Component page:

```tsx
import { Suspense } from "react"
// ...
<Suspense fallback={null}>
  <AgentDetailPanel agents={agents} orgId={orgId} />
</Suspense>
```

### Step 3 — Update `AgentsTable` (row click → URL)

**File:** `components/agents/agents-table.tsx` (or wherever the table rows are rendered)

Each row should navigate to `?agent=<id>` on click instead of a separate page:
```tsx
// Add to each row:
import { useRouter } from "next/navigation"
const router = useRouter()
// On row click:
onClick={() => router.push(`?agent=${agent.id}`)}
// cursor-pointer class on tr
```

Remove any existing `<Link href="/agents/${agent.id}">` wrappers around rows.

### Step 4 — Delete unused pages

After confirming the panel works and build passes:
```
DELETE: app/(dashboard)/agents/new/              (entire folder)
DELETE: app/(dashboard)/agents/[agentId]/edit/   (entire folder)
```

Do NOT delete `app/(dashboard)/agents/[agentId]/` if it exists as a standalone view page.

### Step 5 — Ensure `Switch` component is available

Run: `npx shadcn@latest add switch` if `components/ui/switch.tsx` doesn't exist.
Check first: `ls components/ui/switch.tsx`

### Step 6 — Ensure `Form` components are available

Run: `npx shadcn@latest add form` if `components/ui/form.tsx` doesn't exist.

### Step 7 — Run `pnpm.cmd build`

Zero TypeScript errors before reporting done.

---

## Also Fix: `lib/supabase/service.ts` duplicate (optional but clean)

Hady flagged this as Medium. If time permits:
- `createServiceClient()` in `lib/supabase/service.ts` is identical to `createAdminClient()` in `lib/supabase/admin.ts`
- Update all `createServiceClient()` imports in `lib/actions/agent-events.ts` to use `createAdminClient()` from `@/lib/supabase/admin`
- Delete `lib/supabase/service.ts`

---

## Deliverables & Pipeline

### Sara delivers:
1. `app/(dashboard)/tasks/page.tsx` — tab switcher with My Tasks + Mission Control
2. `components/agents/AgentDetailPanel.tsx` — new file
3. Updated `components/agents/agents-table.tsx` — row click → URL
4. Updated `app/(dashboard)/agents/page.tsx` — mounts panel, "New Agent" → `?agent=new`
5. Deleted `/agents/new/` and `/agents/[agentId]/edit/` pages
6. Fixed `lib/actions/tasks-sprint3.ts` — 3 one-liner bugs
7. `pnpm.cmd build` → 0 TypeScript errors

### Mostafa delivers:
1. Updated `components/agents/AgentNetworkClient.tsx` — real `pingAgent` wired up
2. Updated `app/(dashboard)/agents/communication/page.tsx` — passes `orgId`
3. `pnpm.cmd build` → 0 TypeScript errors

### Omar after both deliver:
1. Run `pnpm.cmd build` — verify 0 errors across combined changes
2. Write sign-off: `docs/reports/omar-regression-fix-signoff.md`
3. Report back to Product Analyst: "Omar sign-off complete: all 4 regression fixes done"

---

## Hady QA (after Omar sign-off):

Hady must update `docs/reports/hady-qa-report.md` with a revision section:
- Verify `/tasks` shows both tabs and `MyTasksPage` is accessible
- Click "My Tasks" tab → `MyTasksPage` renders with personal tasks
- Click "Mission Control" tab → `TasksBoard` renders with org Kanban
- Navigate to `/agents` → clicking a row opens Sheet from the right
- Click "New Agent" button → Sheet opens empty
- Fill in all fields including AI Model + Reports To → save → agent created/updated in DB
- Go to `/agents/communication` → click any agent → click "Ping Agent" → verify row appears in `agent_commands` table
- `pnpm.cmd build` → 0 errors
