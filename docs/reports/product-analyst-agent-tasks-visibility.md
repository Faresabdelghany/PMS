# Product Analysis: Agent-Assigned Tasks Not Visible on Tasks Page

**Date:** 2026-02-27  
**Reporter:** Fares  
**Analyst:** Product Analyst Agent  

## Problem Statement

When a task has `assigned_agent_id` set (e.g., assigned to Ziko), the Tasks page (`/tasks`) shows **"No tasks assigned to you"** because it only queries `assignee_id = current_user.id`. Agent-assigned tasks are invisible to the human user who created or manages them.

## Root Cause Analysis

### Data Flow
1. **`app/(dashboard)/tasks/page.tsx`** calls `getMyTasks(orgId)` which queries tasks where `assignee_id = user.id`.
2. **`lib/actions/tasks/queries.ts` → `getMyTasks()`** hardcodes `.eq("assignee_id", user.id)` — only human-assigned tasks.
3. **Realtime subscription** in `MyTasksPage.tsx` also filters on `assignee_id=eq.${userId}` and the `buildTaskWithRelations` callback explicitly skips tasks where `task.assignee_id !== userId`.
4. **`assigned_agent_id`** (added in migration `20260223000004_sprint3_tasks_bridge.sql`) is never queried or displayed on the Tasks page.

### Impact
- Tasks delegated to AI agents vanish from the user's task view.
- Users lose oversight of agent work unless they navigate to the specific project.
- No way to track agent task progress from a single dashboard.

## Existing Architecture

| Component | File | Role |
|---|---|---|
| Page server component | `app/(dashboard)/tasks/page.tsx` | Fetches data, passes to client |
| Client component | `components/tasks/MyTasksPage.tsx` | Renders task list, filters, realtime |
| Query function | `lib/actions/tasks/queries.ts` | `getMyTasks()` — Supabase query |
| DB column | `tasks.assigned_agent_id` | FK to agents table (nullable) |
| DB column | `tasks.assignee_id` | FK to profiles (human user, nullable) |
| Agent data | Already passed as `agents` prop to `MyTasksPage` | Available but unused for filtering |

## Recommendation

Add an **"Agent Tasks"** tab/section to the Tasks page showing tasks where `assigned_agent_id IS NOT NULL` within the user's org. This is safer than merging into "My Tasks" because:
- No risk of breaking existing "My Tasks" behavior
- Clear mental model: "my tasks" vs "agent tasks"  
- Agent tasks have different semantics (user monitors, not executes)

See `specs/agent-tasks-visibility/spec.md` for full specification.
