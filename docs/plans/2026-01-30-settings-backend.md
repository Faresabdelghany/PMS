# Settings Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add backend persistence for Preferences, Notifications, Workflow Types, and Data Import settings panes.

**Architecture:** Extend `user_settings` table for user-scoped preferences (timezone, notifications). Create new `workflow_statuses` table for organization-scoped custom workflow states. Implement server actions following existing patterns with `ActionResult<T>` return type.

**Tech Stack:** Supabase (PostgreSQL), Next.js Server Actions, Zod validation, TypeScript

---

## Overview

| Feature | Storage | Scope | Complexity |
|---------|---------|-------|------------|
| Preferences | `user_settings` table (extend) | User | Low |
| Notifications | `user_settings` table (extend) | User | Low |
| Workflow Types | New `workflow_statuses` table | Organization | Medium |
| Import | Server action + task creation | Organization | Medium |

---

## Task 1: Database Migration - Extend user_settings

**Files:**
- Create: `supabase/migrations/20260130000001_user_preferences.sql`
- Modify: `lib/supabase/types.ts` (add new fields to types)

**Step 1: Create migration file**

```sql
-- ============================================
-- User Preferences Extension
-- Migration: 20260130000001_user_preferences
-- ============================================

-- Add preference columns to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS week_start_day TEXT DEFAULT 'monday' CHECK (week_start_day IN ('monday', 'sunday', 'saturday')),
ADD COLUMN IF NOT EXISTS open_links_in_app BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_in_app BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_email BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.timezone IS 'User timezone preference (auto, utc, or IANA timezone)';
COMMENT ON COLUMN user_settings.week_start_day IS 'First day of week for calendars';
COMMENT ON COLUMN user_settings.open_links_in_app IS 'Whether to open app links in the app';
COMMENT ON COLUMN user_settings.notifications_in_app IS 'Whether to receive in-app notifications';
COMMENT ON COLUMN user_settings.notifications_email IS 'Whether to receive email notifications';
```

**Step 2: Push migration to Supabase**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Update TypeScript types**

Add to `lib/supabase/types.ts` in the `UserSettings` type definition area or update the existing `lib/actions/user-settings.ts` type:

```typescript
// Extended user settings with preferences
export type UserPreferences = {
  timezone: string
  week_start_day: 'monday' | 'sunday' | 'saturday'
  open_links_in_app: boolean
  notifications_in_app: boolean
  notifications_email: boolean
}
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260130000001_user_preferences.sql lib/supabase/types.ts
git commit -m "feat(db): add user preferences columns to user_settings"
```

---

## Task 2: Database Migration - Workflow Statuses Table

**Files:**
- Create: `supabase/migrations/20260130000002_workflow_statuses.sql`
- Modify: `lib/supabase/types.ts` (add WorkflowStatus type)

**Step 1: Create migration file**

```sql
-- ============================================
-- Custom Workflow Statuses
-- Migration: 20260130000002_workflow_statuses
-- ============================================

-- Enum for workflow status category
CREATE TYPE workflow_category AS ENUM ('unstarted', 'started', 'finished', 'canceled');

-- Enum for entity type the status applies to
CREATE TYPE workflow_entity_type AS ENUM ('task', 'project', 'workstream');

-- Workflow statuses table
CREATE TABLE workflow_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  entity_type workflow_entity_type NOT NULL,
  category workflow_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, entity_type, name)
);

-- Index for common queries
CREATE INDEX idx_workflow_statuses_org ON workflow_statuses(organization_id);
CREATE INDEX idx_workflow_statuses_entity ON workflow_statuses(organization_id, entity_type);

-- Trigger for updated_at
CREATE TRIGGER update_workflow_statuses_updated_at
  BEFORE UPDATE ON workflow_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE workflow_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workflow statuses"
  ON workflow_statuses FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org admins can create workflow statuses"
  ON workflow_statuses FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Org admins can update workflow statuses"
  ON workflow_statuses FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Org admins can delete workflow statuses"
  ON workflow_statuses FOR DELETE
  USING (is_org_admin(organization_id) AND is_locked = false);

-- Insert default statuses function (call when org is created)
CREATE OR REPLACE FUNCTION create_default_workflow_statuses(org_id UUID)
RETURNS void AS $$
BEGIN
  -- Default task statuses
  INSERT INTO workflow_statuses (organization_id, entity_type, category, name, description, is_default, is_locked, sort_order) VALUES
    (org_id, 'task', 'unstarted', 'To-do', 'Tasks that are not started yet', true, true, 0),
    (org_id, 'task', 'started', 'Doing', 'Tasks that are in progress', true, false, 1),
    (org_id, 'task', 'finished', 'Done', 'Tasks that are completed', true, true, 2);

  -- Default project statuses
  INSERT INTO workflow_statuses (organization_id, entity_type, category, name, description, is_default, is_locked, sort_order) VALUES
    (org_id, 'project', 'unstarted', 'Backlog', 'Projects not yet started', true, true, 0),
    (org_id, 'project', 'unstarted', 'Planned', 'Projects planned to start', true, false, 1),
    (org_id, 'project', 'started', 'Active', 'Projects currently in progress', true, false, 2),
    (org_id, 'project', 'finished', 'Completed', 'Projects that are done', true, true, 3),
    (org_id, 'project', 'canceled', 'Cancelled', 'Projects that were cancelled', true, true, 4);

  -- Default workstream statuses
  INSERT INTO workflow_statuses (organization_id, entity_type, category, name, description, is_default, is_locked, sort_order) VALUES
    (org_id, 'workstream', 'unstarted', 'Planned', 'Workstreams not yet started', true, true, 0),
    (org_id, 'workstream', 'started', 'Active', 'Workstreams in progress', true, false, 1),
    (org_id, 'workstream', 'finished', 'Completed', 'Workstreams that are done', true, true, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Push migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Add TypeScript types**

Add to `lib/supabase/types.ts`:

```typescript
// Workflow status types
export type WorkflowCategory = 'unstarted' | 'started' | 'finished' | 'canceled'
export type WorkflowEntityType = 'task' | 'project' | 'workstream'

export type WorkflowStatus = {
  id: string
  organization_id: string
  entity_type: WorkflowEntityType
  category: WorkflowCategory
  name: string
  description: string | null
  color: string
  is_default: boolean
  is_locked: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type WorkflowStatusInsert = Omit<WorkflowStatus, 'id' | 'created_at' | 'updated_at'>
export type WorkflowStatusUpdate = Partial<Omit<WorkflowStatusInsert, 'organization_id' | 'entity_type'>>
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260130000002_workflow_statuses.sql lib/supabase/types.ts
git commit -m "feat(db): add workflow_statuses table for custom workflow states"
```

---

## Task 3: Server Actions - User Preferences

**Files:**
- Modify: `lib/actions/user-settings.ts` (add preference functions)

**Step 1: Add type definitions**

Add at top of `lib/actions/user-settings.ts`:

```typescript
import { z } from "zod"

// Preference validation schema
const preferencesSchema = z.object({
  timezone: z.string().optional(),
  week_start_day: z.enum(['monday', 'sunday', 'saturday']).optional(),
  open_links_in_app: z.boolean().optional(),
})

// Notification settings schema
const notificationSettingsSchema = z.object({
  notifications_in_app: z.boolean().optional(),
  notifications_email: z.boolean().optional(),
})

// Extended type with preferences
export type UserSettingsWithPreferences = UserSettings & {
  timezone: string
  week_start_day: 'monday' | 'sunday' | 'saturday'
  open_links_in_app: boolean
  notifications_in_app: boolean
  notifications_email: boolean
}
```

**Step 2: Add getPreferences function**

```typescript
// Get user preferences
export async function getPreferences(): Promise<ActionResult<UserSettingsWithPreferences | null>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { data, error } = await (supabase as any)
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // Return defaults if no settings exist
      return {
        data: {
          id: "",
          user_id: user.id,
          ai_provider: "openai",
          ai_api_key_encrypted: null,
          ai_model_preference: null,
          timezone: "auto",
          week_start_day: "monday",
          open_links_in_app: true,
          notifications_in_app: true,
          notifications_email: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserSettingsWithPreferences,
      }
    }
    return { error: error.message }
  }

  return { data: data as UserSettingsWithPreferences }
}
```

**Step 3: Add savePreferences function**

```typescript
// Save user preferences
export async function savePreferences(
  data: z.infer<typeof preferencesSchema>
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Validate input
  const validation = preferencesSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Invalid input" }
  }

  // Check if settings exist
  const { data: existing } = await (supabase as any)
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let error

  if (existing) {
    const result = await (supabase as any)
      .from("user_settings")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
    error = result.error
  } else {
    const result = await (supabase as any)
      .from("user_settings")
      .insert({
        user_id: user.id,
        ...validation.data,
      })
    error = result.error
  }

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data: { success: true } }
}
```

**Step 4: Add saveNotificationSettings function**

```typescript
// Save notification settings
export async function saveNotificationSettings(
  data: z.infer<typeof notificationSettingsSchema>
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  // Validate input
  const validation = notificationSettingsSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Invalid input" }
  }

  // Check if settings exist
  const { data: existing } = await (supabase as any)
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let error

  if (existing) {
    const result = await (supabase as any)
      .from("user_settings")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
    error = result.error
  } else {
    const result = await (supabase as any)
      .from("user_settings")
      .insert({
        user_id: user.id,
        ...validation.data,
      })
    error = result.error
  }

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data: { success: true } }
}
```

**Step 5: Commit**

```bash
git add lib/actions/user-settings.ts
git commit -m "feat(actions): add preference and notification settings actions"
```

---

## Task 4: Server Actions - Workflow Statuses

**Files:**
- Create: `lib/actions/workflow-statuses.ts`

**Step 1: Create workflow statuses action file**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ActionResult } from "./types"

// Types
export type WorkflowCategory = 'unstarted' | 'started' | 'finished' | 'canceled'
export type WorkflowEntityType = 'task' | 'project' | 'workstream'

export type WorkflowStatus = {
  id: string
  organization_id: string
  entity_type: WorkflowEntityType
  category: WorkflowCategory
  name: string
  description: string | null
  color: string
  is_default: boolean
  is_locked: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Validation schemas
const createWorkflowStatusSchema = z.object({
  entity_type: z.enum(['task', 'project', 'workstream']),
  category: z.enum(['unstarted', 'started', 'finished', 'canceled']),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const updateWorkflowStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// Get workflow statuses for organization
export async function getWorkflowStatuses(
  organizationId: string,
  entityType?: WorkflowEntityType
): Promise<ActionResult<WorkflowStatus[]>> {
  const supabase = await createClient()

  let query = (supabase as any)
    .from("workflow_statuses")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order")

  if (entityType) {
    query = query.eq("entity_type", entityType)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data: data as WorkflowStatus[] }
}

// Create workflow status
export async function createWorkflowStatus(
  organizationId: string,
  data: z.infer<typeof createWorkflowStatusSchema>
): Promise<ActionResult<WorkflowStatus>> {
  const supabase = await createClient()

  // Validate input
  const validation = createWorkflowStatusSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Invalid input" }
  }

  const validData = validation.data

  // Get max sort_order for this entity type and category
  const { data: maxOrder } = await (supabase as any)
    .from("workflow_statuses")
    .select("sort_order")
    .eq("organization_id", organizationId)
    .eq("entity_type", validData.entity_type)
    .eq("category", validData.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single()

  const sortOrder = maxOrder ? maxOrder.sort_order + 1 : 0

  const { data: status, error } = await (supabase as any)
    .from("workflow_statuses")
    .insert({
      organization_id: organizationId,
      ...validData,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A status with this name already exists" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data: status as WorkflowStatus }
}

// Update workflow status
export async function updateWorkflowStatus(
  id: string,
  data: z.infer<typeof updateWorkflowStatusSchema>
): Promise<ActionResult<WorkflowStatus>> {
  const supabase = await createClient()

  // Validate input
  const validation = updateWorkflowStatusSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Invalid input" }
  }

  // Check if status is locked
  const { data: existing } = await (supabase as any)
    .from("workflow_statuses")
    .select("is_locked")
    .eq("id", id)
    .single()

  if (existing?.is_locked) {
    return { error: "Cannot modify a locked status" }
  }

  const { data: status, error } = await (supabase as any)
    .from("workflow_statuses")
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data: status as WorkflowStatus }
}

// Delete workflow status
export async function deleteWorkflowStatus(id: string): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  // Check if status is locked or default
  const { data: existing } = await (supabase as any)
    .from("workflow_statuses")
    .select("is_locked, is_default")
    .eq("id", id)
    .single()

  if (existing?.is_locked) {
    return { error: "Cannot delete a locked status" }
  }

  if (existing?.is_default) {
    return { error: "Cannot delete a default status" }
  }

  const { error } = await (supabase as any)
    .from("workflow_statuses")
    .delete()
    .eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data: { success: true } }
}

// Reorder workflow statuses
export async function reorderWorkflowStatuses(
  statusIds: string[]
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  // Update sort_order for each status
  const updates = statusIds.map((id, index) =>
    (supabase as any)
      .from("workflow_statuses")
      .update({ sort_order: index })
      .eq("id", id)
  )

  const results = await Promise.all(updates)
  const error = results.find((r) => r.error)?.error

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data: { success: true } }
}

// Initialize default statuses for an organization
export async function initializeWorkflowStatuses(
  organizationId: string
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createClient()

  const { error } = await (supabase as any).rpc("create_default_workflow_statuses", {
    org_id: organizationId,
  })

  if (error) {
    return { error: error.message }
  }

  return { data: { success: true } }
}
```

**Step 2: Commit**

```bash
git add lib/actions/workflow-statuses.ts
git commit -m "feat(actions): add workflow statuses CRUD actions"
```

---

## Task 5: Server Actions - Data Import

**Files:**
- Create: `lib/actions/import.ts`

**Step 1: Create import action file**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ActionResult } from "./types"
import type { TaskInsert, TaskPriority, TaskStatus } from "@/lib/supabase/types"

// Column mapping type
export type ColumnMapping = {
  title: number // Required - column index
  description?: number
  status?: number
  priority?: number
  assignee_email?: number
  tags?: number
  start_date?: number
  end_date?: number
}

// Import result
export type ImportResult = {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

// Parse CSV content
function parseCSV(content: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ""
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentLine.push(currentField.trim())
        currentField = ""
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentField.trim())
        if (currentLine.some(f => f !== "")) {
          lines.push(currentLine)
        }
        currentLine = []
        currentField = ""
        if (char === '\r') i++ // Skip \n after \r
      } else if (char !== '\r') {
        currentField += char
      }
    }
  }

  // Handle last field/line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    if (currentLine.some(f => f !== "")) {
      lines.push(currentLine)
    }
  }

  return lines
}

// Map status string to TaskStatus enum
function mapStatus(value: string): TaskStatus {
  const normalized = value.toLowerCase().trim()
  if (normalized === "done" || normalized === "completed" || normalized === "complete") {
    return "done"
  }
  if (normalized === "in-progress" || normalized === "in progress" || normalized === "doing" || normalized === "started") {
    return "in-progress"
  }
  return "todo"
}

// Map priority string to TaskPriority enum
function mapPriority(value: string): TaskPriority {
  const normalized = value.toLowerCase().trim()
  if (normalized === "urgent" || normalized === "critical") return "urgent"
  if (normalized === "high") return "high"
  if (normalized === "medium" || normalized === "normal") return "medium"
  if (normalized === "low") return "low"
  return "no-priority"
}

// Import tasks from CSV
export async function importTasksFromCSV(
  projectId: string,
  csvContent: string,
  mapping: ColumnMapping,
  hasHeader: boolean = true
): Promise<ActionResult<ImportResult>> {
  const supabase = await createClient()

  // Verify user has access to project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id")
    .eq("id", projectId)
    .single()

  if (projectError || !project) {
    return { error: "Project not found or access denied" }
  }

  // Parse CSV
  const rows = parseCSV(csvContent)
  if (rows.length === 0) {
    return { error: "No data found in CSV" }
  }

  // Skip header if present
  const dataRows = hasHeader ? rows.slice(1) : rows

  if (dataRows.length === 0) {
    return { error: "No data rows found (only header)" }
  }

  // Get organization members for email mapping
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, profiles(email)")
    .eq("organization_id", project.organization_id)

  const emailToUserId = new Map<string, string>()
  members?.forEach((m: any) => {
    if (m.profiles?.email) {
      emailToUserId.set(m.profiles.email.toLowerCase(), m.user_id)
    }
  })

  // Get current max sort_order
  const { data: maxOrderData } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single()

  let sortOrder = maxOrderData ? maxOrderData.sort_order + 1 : 0

  // Process rows
  const result: ImportResult = {
    total: dataRows.length,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  const tasksToInsert: TaskInsert[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = hasHeader ? i + 2 : i + 1 // 1-indexed, accounting for header

    // Get title (required)
    const title = row[mapping.title]?.trim()
    if (!title) {
      result.skipped++
      result.errors.push(`Row ${rowNum}: Missing title`)
      continue
    }

    // Build task
    const task: TaskInsert = {
      project_id: projectId,
      name: title,
      sort_order: sortOrder++,
    }

    // Optional fields
    if (mapping.description !== undefined && row[mapping.description]) {
      task.description = row[mapping.description].trim()
    }

    if (mapping.status !== undefined && row[mapping.status]) {
      task.status = mapStatus(row[mapping.status])
    }

    if (mapping.priority !== undefined && row[mapping.priority]) {
      task.priority = mapPriority(row[mapping.priority])
    }

    if (mapping.assignee_email !== undefined && row[mapping.assignee_email]) {
      const email = row[mapping.assignee_email].trim().toLowerCase()
      const userId = emailToUserId.get(email)
      if (userId) {
        task.assignee_id = userId
      }
    }

    if (mapping.tags !== undefined && row[mapping.tags]) {
      task.tag = row[mapping.tags].trim()
    }

    if (mapping.start_date !== undefined && row[mapping.start_date]) {
      const date = row[mapping.start_date].trim()
      if (date && !isNaN(Date.parse(date))) {
        task.start_date = new Date(date).toISOString().split("T")[0]
      }
    }

    if (mapping.end_date !== undefined && row[mapping.end_date]) {
      const date = row[mapping.end_date].trim()
      if (date && !isNaN(Date.parse(date))) {
        task.end_date = new Date(date).toISOString().split("T")[0]
      }
    }

    tasksToInsert.push(task)
  }

  // Batch insert tasks
  if (tasksToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)

    if (insertError) {
      return { error: `Failed to import tasks: ${insertError.message}` }
    }

    result.imported = tasksToInsert.length
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/tasks")

  return { data: result }
}

// Preview CSV content (returns headers and first few rows)
export async function previewCSV(
  csvContent: string
): Promise<ActionResult<{ headers: string[]; rows: string[][]; totalRows: number }>> {
  const rows = parseCSV(csvContent)

  if (rows.length === 0) {
    return { error: "No data found in CSV" }
  }

  return {
    data: {
      headers: rows[0] || [],
      rows: rows.slice(1, 6), // First 5 data rows
      totalRows: rows.length - 1,
    },
  }
}
```

**Step 2: Commit**

```bash
git add lib/actions/import.ts
git commit -m "feat(actions): add CSV import action for tasks"
```

---

## Task 6: Update Preferences Pane UI

**Files:**
- Modify: `components/settings/panes/preferences-pane.tsx`

**Step 1: Update imports and add state**

```typescript
"use client"

import { useState, useEffect, useTransition } from "react"
import { useTheme } from "next-themes"
import { Copy, Check, Spinner } from "@phosphor-icons/react/dist/ssr"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader, SettingSection, SettingRow } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import { getPreferences, savePreferences, type UserSettingsWithPreferences } from "@/lib/actions/user-settings"
import { toast } from "sonner"

const TIMEZONES = [
  { value: "auto", label: "Auto-detect" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York, America" },
  { value: "America/Los_Angeles", label: "Los Angeles, America" },
  { value: "America/Chicago", label: "Chicago, America" },
  { value: "Europe/London", label: "London, Europe" },
  { value: "Europe/Paris", label: "Paris, Europe" },
  { value: "Europe/Berlin", label: "Berlin, Europe" },
  { value: "Asia/Tokyo", label: "Tokyo, Asia" },
  { value: "Asia/Shanghai", label: "Shanghai, Asia" },
  { value: "Asia/Dubai", label: "Dubai, Asia" },
  { value: "Australia/Sydney", label: "Sydney, Australia" },
]
```

**Step 2: Add data fetching and handlers**

```typescript
export function PreferencesPane() {
  const { organization } = useOrganization()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Preference state
  const [preferences, setPreferences] = useState<UserSettingsWithPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    setIsMounted(true)
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    const result = await getPreferences()
    if (result.data) {
      setPreferences(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopyId = async () => {
    if (!organization?.id) return
    try {
      await navigator.clipboard.writeText(organization.id)
      setCopied(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handlePreferenceChange = (key: keyof UserSettingsWithPreferences, value: any) => {
    if (!preferences) return

    const updated = { ...preferences, [key]: value }
    setPreferences(updated)

    startTransition(async () => {
      const result = await savePreferences({ [key]: value })
      if (result.error) {
        toast.error(result.error)
        // Revert on error
        setPreferences(preferences)
      }
    })
  }

  const workspaceName = organization?.name || "My Workspace"
  const workspaceId = organization?.id || ""
```

**Step 3: Update JSX with controlled components**

Replace the existing JSX return with connected components:

```typescript
  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Preferences"
        description="Manage your workspace details, and set global workspace preferences."
      />

      <SettingSection title="Information">
        <SettingRow label="Workspace" description="This is the name shown across the workspace.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-inner">
              <span className="text-xl font-bold">{workspaceName[0]?.toUpperCase()}</span>
            </div>
            <Input value={workspaceName} readOnly className="h-9 text-sm flex-1" />
          </div>
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Workspace">
        <SettingRow label="Workspace ID" description="Use this ID when connecting integrations.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={workspaceId} className="font-mono text-sm" />
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleCopyId}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Appearance">
        <SettingRow label="Theme">
          <Select
            value={isMounted ? theme ?? "system" : "system"}
            onValueChange={(value) => setTheme(value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System default</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Open links in app"
          description="When you click a link to the app, open it in the app if possible."
        >
          <Switch
            checked={preferences?.open_links_in_app ?? true}
            onCheckedChange={(checked) => handlePreferenceChange("open_links_in_app", checked)}
            disabled={isLoading || isPending}
          />
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Location and time">
        <SettingRow label="Timezone">
          <Select
            value={preferences?.timezone ?? "auto"}
            onValueChange={(value) => handlePreferenceChange("timezone", value)}
            disabled={isLoading || isPending}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Start weeks on" description="The first day of the week in your calendars.">
          <Select
            value={preferences?.week_start_day ?? "monday"}
            onValueChange={(value) => handlePreferenceChange("week_start_day", value)}
            disabled={isLoading || isPending}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monday">Monday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add components/settings/panes/preferences-pane.tsx
git commit -m "feat(ui): connect preferences pane to backend"
```

---

## Task 7: Update Notifications Pane UI

**Files:**
- Modify: `components/settings/panes/notifications-pane.tsx`

**Step 1: Update with backend integration**

Replace the entire file:

```typescript
"use client"

import { useState, useEffect, useTransition } from "react"
import { Bell, Star, PencilSimple } from "@phosphor-icons/react/dist/ssr"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader } from "../setting-primitives"
import { cn } from "@/lib/utils"
import { getPreferences, saveNotificationSettings, type UserSettingsWithPreferences } from "@/lib/actions/user-settings"
import { toast } from "sonner"

const detailCards = [
  {
    id: "recommended",
    title: "Recommended settings",
    description: "Stick with defaults so you never miss an important update and avoid spam.",
    icon: Star,
    highlighted: true,
  },
  {
    id: "custom",
    title: "Custom settings",
    description: "Fine-tune notifications to only receive updates you care about.",
    icon: PencilSimple,
    highlighted: false,
  },
] as const

export function NotificationsPane() {
  const [preferences, setPreferences] = useState<UserSettingsWithPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    const result = await getPreferences()
    if (result.data) {
      setPreferences(result.data)
    }
    setIsLoading(false)
  }

  const handleToggle = (key: "notifications_in_app" | "notifications_email", checked: boolean) => {
    if (!preferences) return

    const updated = { ...preferences, [key]: checked }
    setPreferences(updated)

    startTransition(async () => {
      const result = await saveNotificationSettings({ [key]: checked })
      if (result.error) {
        toast.error(result.error)
        setPreferences(preferences)
      }
    })
  }

  const methodItems = [
    {
      id: "in-app" as const,
      key: "notifications_in_app" as const,
      title: "In-app",
      description: "Notifications will go into your Inbox",
      enabled: preferences?.notifications_in_app ?? true,
    },
    {
      id: "email" as const,
      key: "notifications_email" as const,
      title: "Email",
      description: "You will receive emails about project events",
      enabled: preferences?.notifications_email ?? true,
    },
  ]

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Notifications"
        description="Stay in the loop without the noise. Choose where you get updates, and customize which activities trigger notifications."
      />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Methods</h3>
        <div className="space-y-3">
          {methodItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) => handleToggle(item.key, checked)}
                disabled={isLoading || isPending}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {detailCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={cn(
                "flex flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition shadow-sm",
                card.highlighted
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-border bg-card/60 text-foreground hover:border-border/80"
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    card.highlighted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <card.icon className="h-4 w-4" />
                </span>
                {card.title}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/panes/notifications-pane.tsx
git commit -m "feat(ui): connect notifications pane to backend"
```

---

## Task 8: Update Types Pane UI

**Files:**
- Modify: `components/settings/panes/types-pane.tsx`

**Step 1: Update with workflow status backend**

Replace the entire file with the connected version (full implementation with CRUD operations, dialogs for create/edit, and backend integration using the workflow-statuses actions).

The implementation should:
1. Fetch workflow statuses from backend on mount
2. Group them by category (unstarted, started, finished, canceled)
3. Allow creating new statuses via dialog
4. Allow editing non-locked statuses
5. Allow deleting non-locked, non-default statuses
6. Show lock icon for locked statuses

**Step 2: Commit**

```bash
git add components/settings/panes/types-pane.tsx
git commit -m "feat(ui): connect types pane to workflow statuses backend"
```

---

## Task 9: Update Import Pane UI

**Files:**
- Modify: `components/settings/panes/import-pane.tsx`

**Step 1: Update with import functionality**

The implementation should:
1. Handle file upload (CSV only for now)
2. Parse and preview CSV content
3. Show column mapping interface
4. Allow user to select which column maps to which field
5. Show import progress/results
6. Require project selection before import

**Step 2: Commit**

```bash
git add components/settings/panes/import-pane.tsx
git commit -m "feat(ui): connect import pane to backend"
```

---

## Task 10: Integration Testing

**Files:**
- Test manually in browser

**Step 1: Test Preferences**
1. Open settings dialog
2. Go to Preferences pane
3. Change timezone - verify it persists on page refresh
4. Toggle "Open links in app" - verify persistence
5. Change "Start weeks on" - verify persistence

**Step 2: Test Notifications**
1. Go to Notifications pane
2. Toggle in-app notifications off/on - verify persistence
3. Toggle email notifications off/on - verify persistence

**Step 3: Test Workflow Types**
1. Go to Types pane
2. Select Task type
3. Try to add a new status in "Started" category
4. Verify locked statuses cannot be edited/deleted
5. Edit a non-locked status
6. Delete the created status

**Step 4: Test Import**
1. Create a test CSV file with columns: Title, Status, Priority
2. Go to Import pane
3. Upload the CSV
4. Map columns
5. Select a project
6. Import and verify tasks were created

**Step 5: Commit final**

```bash
git add .
git commit -m "feat: complete settings backend integration"
```

---

## Summary

| Task | Feature | Estimated Steps |
|------|---------|-----------------|
| 1 | DB Migration - user_settings | 4 |
| 2 | DB Migration - workflow_statuses | 4 |
| 3 | Server Actions - Preferences | 5 |
| 4 | Server Actions - Workflow | 2 |
| 5 | Server Actions - Import | 2 |
| 6 | UI - Preferences Pane | 4 |
| 7 | UI - Notifications Pane | 2 |
| 8 | UI - Types Pane | 2 |
| 9 | UI - Import Pane | 2 |
| 10 | Integration Testing | 5 |

**Total: ~32 steps**
