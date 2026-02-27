# Dev Report — Task Orchestration v1

**Date:** 2026-02-27

## Implemented

Delivered v1 task orchestration incrementally on top of existing tasks module:

1. **DB schema + constraints**
   - Added `tasks.parent_task_id` (self-FK, cascade delete)
   - Added `tasks.source` (`manual|agent|speckit|system`, default `manual`)
   - Added subtask index + trigger guard for:
     - same project parent/child
     - one-level nesting max
   - Extended `agent_events` check constraint with `task_create` / `subtask_create`

2. **Agent events API (`/api/agent-events`)**
   - Added `task_create` and `subtask_create` support
   - Added validation for required payload fields
   - Creates task/subtask in `tasks` and returns `task_id`
   - Keeps existing event logging + gateway heartbeat updates
   - Status sync wiring:
     - `task_started` → `dispatch_status=running`, `status=in-progress`
     - `task_completed` → `dispatch_status=completed`, `status=done`
     - `task_failed` → `dispatch_status=failed`

3. **Tasks actions/types/subtask flow**
   - Updated task schema validation to accept `parent_task_id` and `source`
   - Updated `TaskWithRelations` with parent/source/subtask counters
   - Updated list queries to return only top-level tasks by default
   - Added subtask counters (`done/total`) to task list data
   - Added `getSubtasks(parentTaskId)` action
   - Updated `createTask` sort ordering to scope by sibling set

4. **Unified timeline**
   - Extended `getTaskTimeline` to merge:
     - `task_comments`
     - `task_activities`
     - `agent_events`
   - Returns chronologically sorted union with `type` discriminator
   - Extended realtime hook + UI rendering for `agent_event` timeline items

5. **UI updates (v1 scope)**
   - Added subtask progress badge (`done/total`) in task list rows
   - Added Subtasks section in task detail panel:
     - list child tasks
     - inline add-subtask form
     - subtask navigation via panel routing

6. **push-event script**
   - Added `scripts/push-event.ps1` with `task_create` / `subtask_create` payload support
   - Supports `TaskName`, `TaskDescription`, `ProjectId`, `ParentTaskId`, `Source`, etc.
   - Prints created `task_id` when returned by API

## Migrations Added

- `supabase/migrations/20260227000001_task_orchestration_v1.sql`
- `supabase/migrations/20260227000002_agent_events_task_create_types.sql`

## Verification

- Ran full build + typecheck via:
  - `cmd /c pnpm build`
- Result: **PASS**

## Notes / Risks

- `task_activities.actor_id` currently requires a profile user, so API-side agent-originated status writes are represented through `agent_events` + task row status sync (not direct `task_activities` inserts).
- `lib/supabase/types.ts` was updated manually (not regenerated from Supabase CLI), so it should be regenerated after migrations are applied in target env.
- Subtask UI creation currently sets source as `manual` for inline user-created subtasks in panel; agent-created subtasks are still correctly marked via API events (`source=agent|speckit`).
