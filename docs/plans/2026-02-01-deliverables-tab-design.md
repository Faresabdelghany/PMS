# Deliverables Tab Design

**Date:** 2026-02-01
**Status:** Approved

## Overview

Add a Deliverables tab to the project details page that allows tracking deliverables with monetary values, completion status, and payment status.

## Requirements

- Each deliverable has: title, monetary value (contract amount), due date, completion status, payment status
- Currency is set at project level (all deliverables use same currency)
- Track both completion (pending/in_progress/completed) and payment (unpaid/invoiced/paid)
- All project members can manage deliverables
- No summary totals needed - just list deliverables

## Data Model

### New Enums
```sql
CREATE TYPE deliverable_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE payment_status AS ENUM ('unpaid', 'invoiced', 'paid');
```

### Projects Table - Add Currency
```sql
ALTER TABLE projects ADD COLUMN currency TEXT DEFAULT 'USD';
```

### Project Deliverables Table - New Fields
```sql
ALTER TABLE project_deliverables
  ADD COLUMN value DECIMAL(12,2),
  ADD COLUMN status deliverable_status DEFAULT 'pending',
  ADD COLUMN payment_status payment_status DEFAULT 'unpaid';
```

## UI Design

### Tab Location
Added as new tab in project details: `[Overview] [Workstream] [Tasks] [Notes] [Assets & Files] [Deliverables]`

### Tab Content
- Header with "Deliverables" title, "Add Deliverable" button, currency indicator
- Table with columns: Title, Value, Due Date, Status, Payment, Actions
- Inline status/payment dropdowns for quick updates
- Edit/Delete action buttons per row

### Add/Edit Dialog
Fields:
- Title (required, text)
- Value (optional, number with currency)
- Due Date (optional, date picker)
- Status (dropdown: Pending, In Progress, Completed)
- Payment Status (dropdown: Unpaid, Invoiced, Paid)

### Empty State
"No deliverables yet. Add your first deliverable to track contract milestones."

## Server Actions

New file `lib/actions/deliverables.ts`:
- `createDeliverable(projectId, data)` - Create new deliverable
- `updateDeliverable(deliverableId, data)` - Update deliverable
- `deleteDeliverable(deliverableId)` - Delete deliverable
- `reorderDeliverables(projectId, ids[])` - Reorder deliverables

Authorization: `requireProjectMember(projectId)` for all actions.

## Files

### New Files
- `supabase/migrations/[timestamp]_add_deliverables_fields.sql`
- `lib/actions/deliverables.ts`
- `components/projects/DeliverableTab.tsx`
- `components/projects/DeliverableDialog.tsx`
- `components/projects/DeliverableRow.tsx`

### Modified Files
- `lib/supabase/database.types.ts` - Regenerate after migration
- `lib/actions/projects.ts` - Add currency field
- `lib/actions/project-details.ts` - Update deliverable type
- `components/projects/ProjectDetailsPage.tsx` - Add tab
- `components/project-wizard/steps/StepOutcome.tsx` - Add value field (optional)
