# Product Analyst Report — Task Orchestration v1

**Date:** 2026-02-27  
**Prepared by:** Product Analyst  
**Handoff to:** Dev

## Summary

Analyzed PMS tasks module to enable full task orchestration: every task from Fares → Ziko, Product Analyst planning, and SpecKit-generated tasks must appear in PMS with subtask hierarchy, correct agent assignment, status tracking, and a unified activity timeline.

## Key Findings

### What Already Exists (Strong Foundation)
- **Tasks table** with agent assignment (`assigned_agent_id`), task type (`task_type`), and dispatch status (`dispatch_status`) — added in Sprint 3
- **Agent Events API** (`POST /api/agent-events`) — OpenClaw already pushes events with service-role auth
- **Task Activities** — audit log for field changes
- **Task Comments** — with reactions and attachments
- **Task Messages** — agent ↔ user messaging per task thread
- **Agent Commands** — PMS → OpenClaw dispatch (run_task, ping, pause, resume, cancel)

### What's Missing (v1 Scope)
1. **Subtask hierarchy** — no `parent_task_id` column
2. **Auto task creation** — agents can't create tasks via the events API
3. **Source tracking** — can't tell if task was manual, agent-created, or SpecKit-generated
4. **Unified timeline** — activities, comments, and agent events exist in separate tables with no merged view

## Key Decisions

1. **Single-level subtasks only** — parent → child, no grandchildren. Keeps queries simple, covers all use cases (SpecKit tasks become subtasks of the planning task).

2. **Extend existing API, don't create new endpoints** — `POST /api/agent-events` gets two new event types (`task_create`, `subtask_create`). This preserves the existing auth model and avoids new attack surface.

3. **Source field, not task_type overload** — Added `source` (manual/agent/speckit/system) separate from existing `task_type` (user/agent/recurring). These are orthogonal dimensions.

4. **Timeline is a query-time merge, not a materialized view** — Merging `task_activities` + `task_comments` + `agent_events` at query time. Volume per task is low enough that this is fine. Avoids migration complexity.

## Open Risks

| Risk | Mitigation |
|------|-----------|
| Agent events CHECK constraint requires migration to add new types | Migration included in Task 3; app-level validation also in place |
| push-event.ps1 needs task creation support for agents to self-create tasks | Task 4 covers this; until deployed, agents can't auto-create |
| RLS on subtask creation — service role bypasses RLS, which is correct for agent API | Documented; no action needed |
| Timeline query performance with many agent_events | Index on `agent_events(task_id, created_at)` already exists |

## Deliverables

| File | Purpose |
|------|---------|
| `specs/task-orchestration-v1/spec.md` | Full specification |
| `specs/task-orchestration-v1/plan.md` | Implementation plan with phases |
| `specs/task-orchestration-v1/tasks.md` | 9 ordered, testable implementation tasks |
| `docs/reports/product-analyst-task-orchestration-v1.md` | This report |

## Dev Handoff Notes

- **Start with Task 1** (migration) — everything depends on it
- **Tasks 2+3 are the critical backend** — once done, agents can create tasks/subtasks
- **Task 5 is independent** — can be done in parallel with Tasks 2-4
- **UI tasks (7-9) are lower priority** — backend value is immediate even without UI
- Follow CONSTITUTION.md: server actions for mutations, Zod validation, revalidatePath after writes
- Migration file should be named `20260227000001_task_orchestration_v1.sql`
