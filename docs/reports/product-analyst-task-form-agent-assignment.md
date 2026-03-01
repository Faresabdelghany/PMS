# Product Analysis: Task Form Agent Assignment

**Date:** 2026-03-01
**Feature:** Allow assigning tasks to AI agents from create/edit task form
**Status:** Analysis Complete — Ready for spec review

---

## Executive Summary

The PMS already supports agent assignment in two places:
1. **NewTaskForm** (`/tasks/new`) — full-page create form with member/agent toggle
2. **TaskDetail** (Mission Control sheet) — agent dropdown + dispatch button

However, the **TaskQuickCreateModal** (the most-used creation path) and **TaskDetailFields** (the standard edit sidebar) **do not support agent assignment**. This creates a fragmented experience where users must navigate to specific surfaces to assign agents.

This analysis covers closing that gap: making agent assignment available everywhere tasks are created or edited.

## Current State Audit

### Data Layer (Complete ✅)
- `tasks.assigned_agent_id` UUID FK → `agents(id)` — already exists
- `tasks.task_type` enum (`user` | `agent` | `recurring`) — already exists
- `tasks.dispatch_status` enum (`pending` | `dispatched` | `running` | `completed` | `failed`) — already exists
- `agents` table scoped to `organization_id` with RLS — already exists
- Server actions `assignAgentToTask()` and `dispatchTaskToAgent()` — already exist
- Index on `tasks(assigned_agent_id)` — already exists

### UI Layer (Gaps)

| Surface | Member assign | Agent assign | Dispatch |
|---|---|---|---|
| NewTaskForm (`/tasks/new`) | ✅ | ✅ | ✅ (auto on create) |
| TaskQuickCreateModal | ✅ | ❌ **gap** | ❌ |
| TaskDetailFields (edit sidebar) | ✅ | ❌ **gap** | ❌ |
| TaskDetail (MC sheet) | ❌ | ✅ | ✅ |

### Key Findings

1. **No new DB migration needed** — all columns and actions exist.
2. **NewTaskForm is the reference implementation** — toggle UX between member/agent is already proven.
3. **TaskDetailFields only knows about `organizationMembers`** — needs agent list prop.
4. **TaskQuickCreateModal has `AgentOption` type defined but agent picker is partially wired** — the type exists, the picker needs the toggle UX.
5. **Mutual exclusivity** is enforced at the action layer: `assignAgentToTask` sets `task_type` to `agent` and nulls `assignee_id` implicitly (should be made explicit).

## Recommendations

1. **Add member/agent toggle to TaskQuickCreateModal** — mirror NewTaskForm's toggle pattern.
2. **Add agent assignment to TaskDetailFields** — add agent picker below assignee field, with visual indicator when agent is assigned.
3. **Enforce mutual exclusivity in the DB** — add a CHECK constraint: `NOT (assignee_id IS NOT NULL AND assigned_agent_id IS NOT NULL)`.
4. **Normalize the "unassign" flow** — clearing agent should reset `task_type` to `user` and `dispatch_status` to `pending`.
5. **No dispatch from quick-create** — keep dispatch as a deliberate action (existing in TaskDetail/NewTaskForm). Quick-create assigns without dispatching.

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| User assigns agent + member simultaneously | Medium | DB CHECK constraint + UI mutual exclusivity |
| Agent list empty (no agents configured) | Low | Hide agent tab when `agents.length === 0` |
| Stale agent status shown in picker | Low | Agent status is informational only; no blocking logic |
| Dispatch from edit view confusion | Medium | Only show dispatch button when agent is assigned AND not yet dispatched |

## Out of Scope

- Agent auto-suggestion / recommendation
- Bulk agent assignment
- Agent workload balancing
- Webhook/notification on agent assignment change
