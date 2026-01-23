# Guided Wizard Data Persistence Fix

## Problem Statement

The guided wizard (5-step project creation flow) collected detailed project data but did not save it to Supabase. The "Create project" button on Step 5 only called `onCreate?.()` callback without persisting any data.

## Solution

Extended the existing `createProject` server action to handle both Quick Create and Guided Wizard flows with full data persistence.

## Implementation Details

### 1. Extended Types (`lib/supabase/types.ts`)

Added new enum types for guided wizard fields:
- `ProjectIntent`: "delivery" | "experiment" | "internal"
- `SuccessType`: "deliverable" | "metric" | "undefined"
- `DeadlineType`: "none" | "target" | "fixed"
- `WorkStructure`: "linear" | "milestones" | "multistream"

Updated `Project` types to include:
- `intent`, `success_type`, `deadline_type`, `deadline_date`, `work_structure`
- Additional metadata fields: `duration_label`, `location`, `group_label`, `label_badge`

### 2. Extended Server Action (`lib/actions/projects.ts`)

Created `GuidedProjectInput` type that supports:
- Base project fields (name, description, status, priority, dates, etc.)
- Guided wizard fields (intent, success_type, deadline_type, work_structure)
- Related data (deliverables[], metrics[])
- Project members (owner_id, contributor_ids[], stakeholder_ids[])

Updated `createProject` to:
1. Insert project with all fields
2. Insert deliverables to `project_deliverables` table
3. Insert metrics to `project_metrics` table
4. Add owner (specified or current user) with 'owner' role
5. Add contributors with 'member' role
6. Add stakeholders with 'viewer' role

**Error Handling**: If any related insert fails, the project is deleted (rollback).

### 3. Updated Wizard Types (`components/project-wizard/types.ts`)

Added `name` field to `ProjectData` interface for explicit project naming.

### 4. Updated StepReview (`components/project-wizard/steps/StepReview.tsx`)

- Added project name input field
- Defaults to first deliverable title if no name provided
- Accepts `updateData` prop for inline editing

### 5. Updated ProjectWizard (`components/project-wizard/ProjectWizard.tsx`)

- Passes `updateData` to StepReview
- "Create project" button now calls `createProject` with full data
- Shows loading state during creation
- Proper error handling with toast notifications

## Database Tables Used

| Table | Purpose |
|-------|---------|
| `projects` | Core project data with guided wizard fields |
| `project_deliverables` | Deliverables from wizard |
| `project_metrics` | Metrics from wizard |
| `project_members` | Owner, contributors, stakeholders |

## Data Flow

```
StepReview (edit name)
    -> Create Project Button clicked
    -> createProject(orgId, guidedData)
        -> Validate input (name required, filter empty items)
        -> Validate member IDs belong to organization
        -> Insert project
        -> Add owner FIRST (required for RLS policies)
        -> Insert deliverables (RLS passes - user is now member)
        -> Insert metrics
        -> Add contributors (validated org members only)
        -> Add stakeholders (validated org members only)
        -> If error: delete project (rollback)
    -> Success toast + close wizard
```

## Code Review Fixes Applied

### Critical Fix: RLS Policy Race Condition
The original implementation tried to insert deliverables/metrics before adding the user as a project member. RLS policies require `is_project_member(project_id)` for INSERT operations on these tables. **Fixed by reordering**: owner is now added immediately after project creation, before any related data inserts.

### Important Fixes:
1. **Input Validation**: Added validation for required project name, filters empty deliverables/metrics
2. **User ID Validation**: Contributor/stakeholder IDs are validated against organization_members table before insertion
3. **Data Sanitization**: All text fields are trimmed before insertion

## Files Modified

1. `lib/supabase/types.ts` - Added enum types and updated Project types
2. `lib/actions/projects.ts` - Extended createProject with GuidedProjectInput, input validation, and proper operation ordering
3. `components/project-wizard/types.ts` - Added name field
4. `components/project-wizard/steps/StepReview.tsx` - Added name input
5. `components/project-wizard/ProjectWizard.tsx` - Full data persistence on create
