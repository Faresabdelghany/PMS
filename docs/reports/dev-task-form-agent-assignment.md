# Dev Report: Task Form Agent Assignment

**Date:** 2026-03-01
**Spec:** `specs/task-form-agent-assignment/spec.md`

## What was implemented

### 1) DB integrity constraint
- Added migration: `supabase/migrations/20260301000002_task_single_assignee_check.sql`
- Adds `chk_single_assignee` CHECK constraint:
  - prevents `assignee_id` and `assigned_agent_id` from both being non-null
- Includes pre-check that raises if violating rows already exist.

### 2) Server actions mutual exclusivity

#### `lib/actions/tasks/mutations.ts`
- `createTask()` now normalizes payload so if `assignee_id` is set, `assigned_agent_id` is forced to null.
- `updateTask()` now normalizes member assignment updates:
  - when `assignee_id` is set → also sets:
    - `assigned_agent_id = null`
    - `task_type = 'user'`
    - `dispatch_status = 'pending'`
  - when `assignee_id` is explicitly cleared and no agent update is provided:
    - `task_type = 'user'`
    - `dispatch_status = 'pending'`

#### `lib/actions/tasks-sprint3.ts`
- `assignAgentToTask()` now enforces mutual exclusivity and state reset:
  - sets `assignee_id = null`
  - sets `task_type` to `agent`/`user` based on `agentId`
  - resets `dispatch_status = 'pending'` when agent assignment changes

### 3) Quick create / edit modal UX

#### `components/tasks/TaskQuickCreateModal.tsx`
- Added member/agent segmented toggle (`Team Member` / `AI Agent`) when active agents exist.
- Agent list filtered to active agents (`is_active !== false`).
- Switching tabs clears current selection.
- Submit mapping behavior:
  - member selection → task created/updated with `assignee_id` only
  - agent selection → task created/updated then `assignAgentToTask()` called
- Removed quick-create auto-dispatch behavior (assignment only, no dispatch).

### 4) Task detail edit form (sidebar) UX

#### `components/tasks/TaskDetailFields.tsx`
- Added optional `agents` prop.
- Added new **Agent** field with popover picker:
  - active agent options only
  - “No agent” option to clear assignment
  - shows inactive assigned agent as `(inactive)`
- Mutual exclusivity in UI interactions:
  - selecting member clears `assigned_agent_id`
  - selecting agent clears `assignee_id`

#### `components/tasks/TaskDetailPanel.tsx`
- Added optional `agents` prop.
- Routes `assigned_agent_id` updates through `assignAgentToTask()`.
- Keeps existing updates through `updateTask()` for other fields.
- Passes normalized agent data into `TaskDetailFields`.

#### `components/tasks/MyTasksPage.tsx`
- Passes `agents` into `TaskDetailPanel`.

## Acceptance criteria coverage

- **AC1/AC2/AC6/AC7**: Quick-create toggle + conditional visibility + active-only agent list ✅
- **AC3/AC4/AC5**: create mapping member/agent/unassigned ✅
- **AC8/AC9/AC12/AC13/AC14**: task detail agent field + picker + clear option + inactive display ✅
- **AC10/AC11**: mutual exclusivity in UI + action layer ✅
- **AC15**: DB CHECK constraint added ✅
- **AC16/AC17**: dispatch/task_type reset on assignment transitions ✅

## Validation / checks run

- `npx tsc --noEmit` ✅
- `npm run build` ✅

## Notes

- No auto-dispatch from TaskQuickCreateModal (aligned with spec).
- Existing surfaces that do not pass agents into `TaskDetailPanel` continue to work; agent field appears where agents are provided.
