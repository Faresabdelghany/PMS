# Spec: Thread Subscriptions + Documents UI
**Authored by:** Product Analyst  
**Date:** 2026-02-24  
**Assigned to:** Omar (Tech Lead) → his team

---

## Overview

Two features to complete the Mission Control system:

1. **Thread Subscriptions** — auto-subscribe agents/users to task threads so they receive notifications on ALL future comments without needing to be @mentioned each time.
2. **Documents UI** — a `/documents` page showing all org documents with view/create via Sheet panels.

---

## Feature 1: Thread Subscriptions

### Goal
When anyone interacts with a task (comments, assigned, @mentioned), they are auto-subscribed to that task thread. Once subscribed, every new comment on that task triggers a notification for ALL subscribers (except the commenter themselves).

### Database Migration

**File:** `supabase/migrations/20260224000002_thread_subscriptions.sql`

```sql
-- Create task_subscriptions table
CREATE TABLE IF NOT EXISTS public.task_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, agent_id)
);

-- Enable RLS
ALTER TABLE public.task_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policy: org members can view/manage subscriptions
CREATE POLICY "org members can manage task_subscriptions"
  ON public.task_subscriptions
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_subscriptions;
```

> ⚠️ **IMPORTANT FOR FARES:** This migration must be applied manually via  
> **Supabase Dashboard → SQL Editor → paste and run the above SQL.**  
> The file at `supabase/migrations/20260224000002_thread_subscriptions.sql` is the source of truth.

### Implementation in `lib/actions/task-messages.ts`

Extend the existing file with:

#### 1. `subscribeToTask(orgId, taskId, agentId)` helper
- Upsert into `task_subscriptions` (ignore conflict on unique constraint)
- Pattern: `(supabase as any).from("task_subscriptions" as any).upsert(..., { onConflict: "task_id,agent_id", ignoreDuplicates: true })`

#### 2. `notifySubscribers(orgId, taskId, messageId, content, excludeAgentId?)` helper
- Query `task_subscriptions` for all subscribers of this task
- Exclude `excludeAgentId` (the commenter)
- Insert into `agent_notifications` for all remaining subscribers
- Format: `"New comment on task you're subscribed to: "${content.slice(0, 200)}"`

#### 3. Modify `createMessage()` (the comment posting action)
**After** inserting the message:
1. Auto-subscribe the commenter (if `fromAgentId` provided)
2. Call `notifySubscribers` for all subscribers (except commenter)
3. Keep existing `handleMentions` call
4. Inside `handleMentions`: after resolving @mentioned agents, also call `subscribeToTask` for each mentioned agent

#### 4. Task assignment subscription
In `lib/actions/tasks/` — find the `updateTask` or equivalent action that sets `assignee_id` (agent assignment). After updating, call `subscribeToTask` for the assigned agent. Check tasks-sprint3.ts too for agent assignment.

### TypeScript Types

```typescript
export interface TaskSubscription {
  id: string
  task_id: string
  agent_id: string
  organization_id: string
  created_at: string
}
```

Use `(supabase as any).from("task_subscriptions" as any)` pattern throughout (table not in generated types).

---

## Feature 2: Documents UI

### Existing Infrastructure
- Table: `agent_documents` — already exists
- Columns: `id, task_id, agent_id, organization_id, title, content, doc_type, created_at, updated_at`
- Actions: `lib/actions/agent-documents.ts` — has `getDocuments(taskId)`, `getDocument(docId)`, `createDocument(orgId, input)` 
- **Note:** The column is `doc_type` (not `type`) — use this throughout

### New Server Action needed

Add to `lib/actions/agent-documents.ts`:

```typescript
export async function getOrgDocuments(
  orgId: string
): Promise<ActionResult<AgentDocument[]>>
```

Fetches all documents for the org with task and agent join:
```sql
SELECT *, agent:agents(id, name), task:tasks(id, title)
FROM agent_documents
WHERE organization_id = orgId
ORDER BY created_at DESC
```

Also update the `AgentDocument` type to include:
```typescript
task?: { id: string; title: string } | null
```

### New Server Action for task list

Need tasks list for the "New Document" form task selector. Use existing `getCachedProjects` pattern or directly query tasks:
```typescript
// In agent-documents.ts or reuse existing
export async function getTasksForSelector(orgId: string): Promise<ActionResult<{id: string; title: string; project?: {name: string}}[]>>
```

### Page: `app/(dashboard)/documents/page.tsx`

Server component:
```typescript
import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getOrgDocuments, getTasksForSelector } from "@/lib/actions/agent-documents"
import { DocumentsContent } from "@/components/documents/DocumentsContent"

export const metadata: Metadata = { title: "Documents - PMS" }

export default async function Page() {
  const { orgId } = await getPageOrganization()
  const [docsResult, tasksResult] = await Promise.all([
    getOrgDocuments(orgId),
    getTasksForSelector(orgId),
  ])
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <DocumentsContent
        initialDocuments={docsResult.data ?? []}
        tasks={tasksResult.data ?? []}
        organizationId={orgId}
      />
    </Suspense>
  )
}
```

### Client Component: `components/documents/DocumentsContent.tsx`

```typescript
"use client"
```

**Page wrapper:**
```tsx
<div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
  <PageHeader title="Documents" actions={<NewDocumentButton />} />
  {/* content */}
</div>
```

**Document list table/grid** showing:
- Title
- `doc_type` badge (color-coded: deliverable=blue, research=purple, protocol=orange, draft=gray, report=green)
- Linked task name (from `task.title`) or "—" if none
- Agent name (from `agent.name`) or "System" if none
- `created_at` formatted as relative date
- Content preview (first 120 chars of content, truncated)
- Click row → open detail Sheet

**Detail Sheet (view mode):**
- Title, type badge, linked task, agent, full date
- Full content rendered (plain text, preserve newlines, or markdown if possible)
- Close button

**"New Document" Sheet (create mode):**
- Form with React Hook Form + Zod
- Fields:
  - `title` (text input, required)
  - `doc_type` (Select: deliverable / research / protocol / draft / report)
  - `task_id` (Select with all tasks listed as "Task title — Project name", optional)
  - `content` (textarea, required, markdown-friendly)
- Submit → calls `createDocument(orgId, { title, docType, taskId, content })`
- On success: toast + add to list state + close Sheet

### Sidebar update: `components/app-sidebar.tsx`

1. Add `"documents"` to `NavItemId` type
2. Add to `navItems` array after `"skills"`:
   ```typescript
   { id: "documents", label: "Documents" },
   ```
3. Add icon import:
   ```typescript
   import { FileText } from "@phosphor-icons/react/dist/ssr/FileText"
   ```
4. Add to `navItemIcons`:
   ```typescript
   documents: FileText,
   ```
5. Add to `preloadHandlers`:
   ```typescript
   documents: () => {},
   ```
6. Add to `getHrefForNavItem`:
   ```typescript
   if (id === "documents") return "/documents"
   ```
7. Add to `isItemActive`:
   ```typescript
   if (id === "documents") return pathname.startsWith("/documents")
   ```

---

## Design System Compliance Checklist

- [ ] `PageHeader` component used (from `components/ui/page-header.tsx`)
- [ ] Page wrapper: `flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0`
- [ ] All colors via CSS variables (`--muted-foreground`, `--border`, etc.)
- [ ] Phosphor icons (FileText from `@phosphor-icons/react/dist/ssr/FileText`)
- [ ] Sheet from `@/components/ui/sheet`
- [ ] React Hook Form + Zod for the New Document form
- [ ] Dark mode works (CSS variables handle it automatically)
- [ ] shadcn/ui components only (Button, Badge, Select, Textarea, Input)
- [ ] `(supabase as any)` for new tables not in generated types

---

## Build Verification

After all code is written, run:
```
pnpm.cmd build
```
from `C:\Users\Fares\Downloads\PMS`

**Required: 0 TypeScript errors.**

---

## File Summary

| File | Action |
|------|--------|
| `supabase/migrations/20260224000002_thread_subscriptions.sql` | NEW — write migration SQL |
| `lib/actions/task-messages.ts` | EXTEND — add subscription helpers + wire into createMessage |
| `lib/actions/agent-documents.ts` | EXTEND — add `getOrgDocuments`, `getTasksForSelector`, update AgentDocument type |
| `app/(dashboard)/documents/page.tsx` | NEW — server component page |
| `components/documents/DocumentsContent.tsx` | NEW — client component with list + sheets |
| `components/app-sidebar.tsx` | EXTEND — add Documents nav item |
| Tasks assignment action(s) | EXTEND — call subscribeToTask when agent assigned |

---

## Notes for Omar

- Use `(supabase as any).from("task_subscriptions" as any)` pattern for the new table
- The migration must NOT be run via code — Fares runs it manually in Supabase Dashboard
- Do NOT rebuild TaskDetailPanel, AppSidebar from scratch — extend only
- `doc_type` is the actual column name (not `type`)
- The existing `agent-documents.ts` uses `requireAuth()` — stay consistent
- Run `pnpm.cmd build` from `C:\Users\Fares\Downloads\PMS` and fix ALL TypeScript errors before reporting back
