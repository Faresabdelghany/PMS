# Tags & Labels Management Design

## Overview

Add organization-level Tags and Labels management to the Settings page. Tags are unified across projects and tasks. Labels are category-based (Type, Duration, Group, Badge) for project classification.

## Database Schema

### organization_tags

Unified tags for projects and tasks.

```sql
CREATE TABLE organization_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_org_tags_org ON organization_tags(organization_id);
```

### organization_labels

Category-based labels for projects.

```sql
CREATE TABLE organization_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('type', 'duration', 'group', 'badge')),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, category, name)
);

CREATE INDEX idx_org_labels_org ON organization_labels(organization_id);
CREATE INDEX idx_org_labels_category ON organization_labels(organization_id, category);
```

### RLS Policies

All organization members can manage tags and labels.

```sql
-- organization_tags policies
ALTER TABLE organization_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view tags"
  ON organization_tags FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can create tags"
  ON organization_tags FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update tags"
  ON organization_tags FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete tags"
  ON organization_tags FOR DELETE
  USING (is_org_member(organization_id));

-- organization_labels policies (same pattern)
ALTER TABLE organization_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view labels"
  ON organization_labels FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can create labels"
  ON organization_labels FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update labels"
  ON organization_labels FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete labels"
  ON organization_labels FOR DELETE
  USING (is_org_member(organization_id));
```

## Color Palette

16 preset colors for visual consistency:

| Name | Hex |
|------|-----|
| Red | #ef4444 |
| Orange | #f97316 |
| Amber | #f59e0b |
| Yellow | #eab308 |
| Lime | #84cc16 |
| Green | #22c55e |
| Emerald | #10b981 |
| Teal | #14b8a6 |
| Cyan | #06b6d4 |
| Sky | #0ea5e9 |
| Blue | #3b82f6 |
| Indigo | #6366f1 |
| Violet | #8b5cf6 |
| Purple | #a855f7 |
| Pink | #ec4899 |
| Gray | #6b7280 |

## Settings Page Structure

Two new tabs added to Settings:

1. **Tags Tab** - Manage unified tags
2. **Labels Tab** - Manage category-based labels with sub-tabs (Type, Duration, Group, Badge)

### UI Layout

GitHub-style list with:
- Color swatch
- Name (bold)
- Description (muted)
- Edit/Delete actions via dropdown menu

### Add/Edit Form

- Name input (required, max 50 chars)
- Description input (optional, max 200 chars)
- Color grid (16 preset swatches)

## File Structure

### New Files

```
lib/actions/tags.ts
lib/actions/labels.ts
components/settings/tags-settings.tsx
components/settings/labels-settings.tsx
components/ui/color-picker.tsx
supabase/migrations/XXXXXX_add_tags_labels.sql
lib/supabase/database.types.ts (regenerate)
```

### Modified Files

```
app/(dashboard)/settings/page.tsx        # Add Tags/Labels tabs
components/projects/project-form.tsx     # Tag/label dropdowns
components/tasks/task-form.tsx           # Tag dropdown
components/projects/project-card.tsx     # Colored badges
components/tasks/task-card.tsx           # Colored badge
```

## Server Actions

### lib/actions/tags.ts

```typescript
export async function getTags(orgId: string): Promise<ActionResult<Tag[]>>
export async function createTag(orgId: string, data: TagInput): Promise<ActionResult<Tag>>
export async function updateTag(tagId: string, data: TagInput): Promise<ActionResult<Tag>>
export async function deleteTag(tagId: string): Promise<ActionResult>
```

### lib/actions/labels.ts

```typescript
export async function getLabels(orgId: string, category?: LabelCategory): Promise<ActionResult<Label[]>>
export async function createLabel(orgId: string, data: LabelInput): Promise<ActionResult<Label>>
export async function updateLabel(labelId: string, data: LabelInput): Promise<ActionResult<Label>>
export async function deleteLabel(labelId: string): Promise<ActionResult>
```

## Types

```typescript
type LabelCategory = 'type' | 'duration' | 'group' | 'badge'

interface Tag {
  id: string
  organization_id: string
  name: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

interface Label extends Tag {
  category: LabelCategory
}

interface TagInput {
  name: string
  description?: string
  color: string
}

interface LabelInput extends TagInput {
  category: LabelCategory
}
```

## Integration

### Projects

- Tags field: Multi-select dropdown from organization_tags
- Label fields: Single-select dropdowns from organization_labels by category
- Display: Colored badges on cards and detail views

### Tasks

- Tag field: Single-select dropdown from organization_tags
- Display: Colored badge on task cards

### Backward Compatibility

- Existing text values continue to display
- New selections store name string (not ID) for simplicity
- No data migration required
