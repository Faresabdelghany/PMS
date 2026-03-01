# Product Analysis: My Tasks — Agent-Owned Workflow Support

**Date:** 2026-03-01  
**Author:** Product Analyst (AI)  
**Status:** Ready for Review

## Problem Statement

The "My Tasks" view (`/tasks?view=my`) only queries `assignee_id = user.id`. Tasks that are **agent-assigned** (`assigned_agent_id IS NOT NULL`) but still relevant to the current user are invisible in My Tasks. This means:

1. Tasks an agent is working on behalf of the user don't appear in "My Tasks"
2. Users lose visibility into agent-delegated work
3. The only way to see agent-owned tasks is through "All Tasks" or project views

## Current Architecture

### Database Schema
- `tasks.assignee_id` — UUID FK to `profiles`, the human assignee
- `tasks.assigned_agent_id` — UUID FK to `agents`, the agent working the task
- Both columns are nullable and independent

### Query Behavior
| View | Filter | Result |
|------|--------|--------|
| My Tasks | `assignee_id = currentUser` | Only human-assigned tasks |
| All Tasks | `project.organization_id = orgId` | Everything in org |

### UI Mapping (`toUITask`)
- Maps `assignee` from `profiles` join only
- No `assigned_agent_id` / agent info exposed to UI

## Key Findings

1. **`assigned_agent_id` exists but is unused in My Tasks query** — the column and index (`idx_tasks_assigned_agent_id`) already exist
2. **`TaskWithRelations` type already has `assigned_agent_id`** in subtask shape but not at top level
3. **Agent data is already fetched** — `MyTasksData` calls `getAgents(orgId)` and passes `agents` to `MyTasksPage`
4. **No deduplication concern today** — a task can have both `assignee_id` and `assigned_agent_id` set simultaneously, but the UI only shows the human assignee

## Recommendation

Expand "My Tasks" to include tasks where the user is the assignee OR where an agent is assigned (agent-owned tasks within the user's org). Display agent-owned tasks with clear visual distinction. See spec for details.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Duplicate tasks (both assignee + agent set) | Medium | Dedupe by task ID in query with `UNION` / `.or()` |
| Performance regression | Low | Index already exists; query adds one OR clause |
| User confusion (whose task is it?) | Medium | Badge/avatar treatment distinguishes agent vs human |
| Breaking existing filters | Low | Agent tasks inherit same filter fields (status, priority, etc.) |
