# Dev Report — Task Visibility Fix

## Scope
Implemented the task visibility fix in `app/api/agent-events/route.ts` so tasks created via `task_create` / `subtask_create` immediately show in `/tasks` and avoid duplicate creation from identical event payloads.

## Changes Implemented

### 1) Correct assignee mapping + explicit status
For `task_create` / `subtask_create`:
- Reads `payload.assignee_id` and writes it to `tasks.assignee_id`.
- Fallbacks to org primary admin (`organization_members.role = "admin"`) when `assignee_id` is missing.
- Sets `status` explicitly using `payload.status` when valid, otherwise defaults to `"todo"`.
- Keeps existing `assigned_agent_id` behavior intact (`payload.assigned_agent_id` fallback to `agent_id`).

### 2) Project ownership validation
Before task insert:
- Loads project by `payload.project_id`.
- Verifies `project.organization_id === org_id`.
- Rejects with `400` on mismatch.

### 3) Immediate cache invalidation/revalidation
After successful task creation:
- `revalidatePath("/tasks")`
- `revalidatePath(`/projects/${projectId}`)`
- `await invalidateCache.task({ taskId, projectId, assigneeId, orgId })`

### 4) Duplicate prevention for same payload
Before creating a task for `task_create`/`subtask_create`:
- Checks for prior `agent_events` row with same `organization_id`, `agent_id` (or null), `event_type`, `message`, and `payload`, where `task_id` is already set.
- If found, returns existing `task_id` and skips new task insertion.
- Also logs the duplicate event tied to the existing `task_id`.

Additionally:
- Newly inserted `agent_events` row is updated with created `task_id` after successful task creation, enabling future idempotent dedupe.

## Validation

### Build / Typecheck
- Ran: `cmd /c npm run build`
- Result: ✅ Success (compile + TypeScript + static generation passed)

### Task list query path verification
Code-level verification against `/tasks` path behavior:
- `/tasks` uses `getMyTasks` path that filters by `assignee_id`.
- This fix now writes `assignee_id` on agent-created tasks, so new tasks are eligible for `/tasks` results immediately.
- Cache invalidation (`revalidatePath` + `invalidateCache.task`) ensures stale task list cache is cleared right after creation.

## Files Changed
- `app/api/agent-events/route.ts`
- `docs/reports/dev-task-visibility-fix.md`
