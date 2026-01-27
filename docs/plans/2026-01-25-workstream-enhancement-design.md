# Workstream Enhancement Design

## Overview

Enhance the workstream feature to allow users to:
- Create workstreams with title, description, start/end dates, and tags
- Add tasks directly to workstreams
- Edit and delete tasks from workstream view
- Move tasks between workstreams with persistence

## Database Migration

Add new columns to `workstreams` table:

```sql
ALTER TABLE workstreams
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN description TEXT,
ADD COLUMN tag TEXT;
```

**Constraint:** Workstream `end_date` cannot exceed parent project's `end_date`.

Validation enforced at server action level:
- Fetch project's end_date before creating/updating workstream
- Return error if workstream end_date > project end_date

## Create Workstream Modal

**Trigger:** "+ Add Workstream" button at bottom of workstream list

**Fields:**
- Title (required) - Text input
- Description (optional) - Text area
- Start Date (optional) - Date picker, max = project end_date
- End Date (optional) - Date picker, max = project end_date, must be ≥ start_date
- Tags (optional) - Tag input
- Add Tasks (optional) - Multi-select to link existing project tasks

**Component:** `components/projects/CreateWorkstreamModal.tsx`

**Validation:**
- "Name is required"
- "End date cannot be after project end date"
- "End date must be after start date"

## Add Task from Workstream

The "+" button on each workstream header opens `TaskQuickCreateModal` with:
- Project pre-selected (current project)
- Workstream pre-selected (clicked workstream)

No new components needed - wire existing modal with context.

## Task Actions in Workstream View

Add three-dot dropdown menu to each task row with:
- Edit - Opens `TaskQuickCreateModal` in edit mode
- Delete - Shows confirmation dialog

Layout: `[checkbox] Task name ... [due label] [avatar] [⋮ menu] [drag handle]`

## Persist Drag-and-Drop

### Within same workstream
Call existing `reorderTasks(workstreamId, projectId, taskIds)`

### Across workstreams
New action: `moveTaskToWorkstream(taskId, newWorkstreamId, newSortOrder)`

```typescript
export async function moveTaskToWorkstream(
  taskId: string,
  newWorkstreamId: string | null,
  newSortOrder: number
): Promise<ActionResult>
```

Updates task's `workstream_id` and `sort_order`, revalidates cache.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/[timestamp]_add_workstream_fields.sql` | New migration |
| `lib/supabase/types.ts` | Regenerate types |
| `lib/actions/workstreams.ts` | Update createWorkstream, add updateWorkstream |
| `lib/actions/tasks.ts` | Add moveTaskToWorkstream |
| `components/projects/CreateWorkstreamModal.tsx` | New component |
| `components/projects/WorkstreamTab.tsx` | Add task actions, wire up modals, persist DnD |

## Implementation Order

1. Database migration
2. Update server actions (workstreams.ts, tasks.ts)
3. Regenerate TypeScript types
4. Create CreateWorkstreamModal component
5. Update WorkstreamTab with all features
6. Test end-to-end
