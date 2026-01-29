# Tags & Labels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add organization-level Tags and Labels management to Settings, with unified tags for projects/tasks and category-based labels (Type, Duration, Group, Badge).

**Architecture:** Two new database tables with RLS, server actions following existing patterns, settings UI with GitHub-style management, and integration with project/task forms.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js Server Actions, React, Tailwind CSS, shadcn/ui components

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260129000001_organization_tags_labels.sql`

**Step 1: Create the migration file**

```sql
-- Organization Tags table (unified for projects and tasks)
CREATE TABLE organization_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT organization_tags_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  CONSTRAINT organization_tags_description_length CHECK (description IS NULL OR char_length(description) <= 200),
  UNIQUE(organization_id, name)
);

-- Organization Labels table (category-based for projects)
CREATE TABLE organization_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('type', 'duration', 'group', 'badge')),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT organization_labels_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  CONSTRAINT organization_labels_description_length CHECK (description IS NULL OR char_length(description) <= 200),
  UNIQUE(organization_id, category, name)
);

-- Indexes
CREATE INDEX idx_org_tags_org ON organization_tags(organization_id);
CREATE INDEX idx_org_labels_org ON organization_labels(organization_id);
CREATE INDEX idx_org_labels_category ON organization_labels(organization_id, category);

-- Enable RLS
ALTER TABLE organization_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_tags
CREATE POLICY "Org members can view tags"
  ON organization_tags FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can create tags"
  ON organization_tags FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update tags"
  ON organization_tags FOR UPDATE
  TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can delete tags"
  ON organization_tags FOR DELETE
  TO authenticated
  USING (is_org_member(organization_id));

-- RLS Policies for organization_labels
CREATE POLICY "Org members can view labels"
  ON organization_labels FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can create labels"
  ON organization_labels FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update labels"
  ON organization_labels FOR UPDATE
  TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can delete labels"
  ON organization_labels FOR DELETE
  TO authenticated
  USING (is_org_member(organization_id));

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_organization_tags_updated_at
  BEFORE UPDATE ON organization_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_labels_updated_at
  BEFORE UPDATE ON organization_labels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Step 2: Push migration to Supabase**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000001_organization_tags_labels.sql
git commit -m "feat(db): add organization_tags and organization_labels tables"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `lib/supabase/types.ts`

**Step 1: Add LabelCategory type after line 25**

Add after `InboxItemType` type:

```typescript
export type LabelCategory = "type" | "duration" | "group" | "badge"
```

**Step 2: Add organization_tags table types in Database interface (after inbox_items)**

```typescript
      organization_tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_labels: {
        Row: {
          id: string
          organization_id: string
          category: LabelCategory
          name: string
          description: string | null
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category: LabelCategory
          name: string
          description?: string | null
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category?: LabelCategory
          name?: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
```

**Step 3: Add helper types at end of file (after InboxItemWithRelations)**

```typescript
// Organization Tags & Labels
export type OrganizationTag = Database["public"]["Tables"]["organization_tags"]["Row"]
export type OrganizationTagInsert = Database["public"]["Tables"]["organization_tags"]["Insert"]
export type OrganizationTagUpdate = Database["public"]["Tables"]["organization_tags"]["Update"]

export type OrganizationLabel = Database["public"]["Tables"]["organization_labels"]["Row"]
export type OrganizationLabelInsert = Database["public"]["Tables"]["organization_labels"]["Insert"]
export type OrganizationLabelUpdate = Database["public"]["Tables"]["organization_labels"]["Update"]
```

**Step 4: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat(types): add OrganizationTag and OrganizationLabel types"
```

---

## Task 3: Create Tags Server Actions

**Files:**
- Create: `lib/actions/tags.ts`

**Step 1: Create the tags server actions file**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { OrganizationTag, OrganizationTagInsert, OrganizationTagUpdate } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Color palette for tags/labels
export const TAG_COLORS = [
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Gray", hex: "#6b7280" },
] as const

// Get all tags for an organization
export async function getTags(orgId: string): Promise<ActionResult<OrganizationTag[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("organization_tags")
    .select("*")
    .eq("organization_id", orgId)
    .order("name")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Create a new tag
export async function createTag(
  orgId: string,
  input: { name: string; description?: string; color: string }
): Promise<ActionResult<OrganizationTag>> {
  const supabase = await createClient()

  const name = input.name?.trim()
  const description = input.description?.trim() || null
  const color = input.color

  if (!name || name.length < 1 || name.length > 50) {
    return { error: "Tag name must be between 1 and 50 characters" }
  }

  if (description && description.length > 200) {
    return { error: "Description must be less than 200 characters" }
  }

  if (!color || !color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: "Invalid color format" }
  }

  const { data, error } = await supabase
    .from("organization_tags")
    .insert({
      organization_id: orgId,
      name,
      description,
      color,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A tag with this name already exists" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Update a tag
export async function updateTag(
  tagId: string,
  input: { name?: string; description?: string; color?: string }
): Promise<ActionResult<OrganizationTag>> {
  const supabase = await createClient()

  const updates: OrganizationTagUpdate = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 1 || name.length > 50) {
      return { error: "Tag name must be between 1 and 50 characters" }
    }
    updates.name = name
  }

  if (input.description !== undefined) {
    const description = input.description.trim()
    if (description.length > 200) {
      return { error: "Description must be less than 200 characters" }
    }
    updates.description = description || null
  }

  if (input.color !== undefined) {
    if (!input.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Invalid color format" }
    }
    updates.color = input.color
  }

  const { data, error } = await supabase
    .from("organization_tags")
    .update(updates)
    .eq("id", tagId)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A tag with this name already exists" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Delete a tag
export async function deleteTag(tagId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_tags")
    .delete()
    .eq("id", tagId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return {}
}
```

**Step 2: Commit**

```bash
git add lib/actions/tags.ts
git commit -m "feat(actions): add tags CRUD server actions"
```

---

## Task 4: Create Labels Server Actions

**Files:**
- Create: `lib/actions/labels.ts`

**Step 1: Create the labels server actions file**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { OrganizationLabel, OrganizationLabelUpdate, LabelCategory } from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// Get all labels for an organization, optionally filtered by category
export async function getLabels(
  orgId: string,
  category?: LabelCategory
): Promise<ActionResult<OrganizationLabel[]>> {
  const supabase = await createClient()

  let query = supabase
    .from("organization_labels")
    .select("*")
    .eq("organization_id", orgId)

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query.order("name")

  if (error) {
    return { error: error.message }
  }

  return { data }
}

// Create a new label
export async function createLabel(
  orgId: string,
  input: { category: LabelCategory; name: string; description?: string; color: string }
): Promise<ActionResult<OrganizationLabel>> {
  const supabase = await createClient()

  const name = input.name?.trim()
  const description = input.description?.trim() || null
  const color = input.color
  const category = input.category

  if (!["type", "duration", "group", "badge"].includes(category)) {
    return { error: "Invalid label category" }
  }

  if (!name || name.length < 1 || name.length > 50) {
    return { error: "Label name must be between 1 and 50 characters" }
  }

  if (description && description.length > 200) {
    return { error: "Description must be less than 200 characters" }
  }

  if (!color || !color.match(/^#[0-9a-fA-F]{6}$/)) {
    return { error: "Invalid color format" }
  }

  const { data, error } = await supabase
    .from("organization_labels")
    .insert({
      organization_id: orgId,
      category,
      name,
      description,
      color,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A label with this name already exists in this category" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Update a label
export async function updateLabel(
  labelId: string,
  input: { name?: string; description?: string; color?: string }
): Promise<ActionResult<OrganizationLabel>> {
  const supabase = await createClient()

  const updates: OrganizationLabelUpdate = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 1 || name.length > 50) {
      return { error: "Label name must be between 1 and 50 characters" }
    }
    updates.name = name
  }

  if (input.description !== undefined) {
    const description = input.description.trim()
    if (description.length > 200) {
      return { error: "Description must be less than 200 characters" }
    }
    updates.description = description || null
  }

  if (input.color !== undefined) {
    if (!input.color.match(/^#[0-9a-fA-F]{6}$/)) {
      return { error: "Invalid color format" }
    }
    updates.color = input.color
  }

  const { data, error } = await supabase
    .from("organization_labels")
    .update(updates)
    .eq("id", labelId)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "A label with this name already exists in this category" }
    }
    return { error: error.message }
  }

  revalidatePath("/settings")
  return { data }
}

// Delete a label
export async function deleteLabel(labelId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("organization_labels")
    .delete()
    .eq("id", labelId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/settings")
  return {}
}
```

**Step 2: Commit**

```bash
git add lib/actions/labels.ts
git commit -m "feat(actions): add labels CRUD server actions"
```

---

## Task 5: Create Color Picker Component

**Files:**
- Create: `components/ui/color-picker.tsx`

**Step 1: Create the color picker component**

```typescript
"use client"

import { cn } from "@/lib/utils"
import { TAG_COLORS } from "@/lib/actions/tags"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("grid grid-cols-8 gap-2", className)}>
      {TAG_COLORS.map((color) => (
        <button
          key={color.hex}
          type="button"
          className={cn(
            "h-6 w-6 rounded-md border-2 transition-all hover:scale-110",
            value === color.hex
              ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
              : "border-transparent"
          )}
          style={{ backgroundColor: color.hex }}
          onClick={() => onChange(color.hex)}
          title={color.name}
        />
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/ui/color-picker.tsx
git commit -m "feat(ui): add ColorPicker component"
```

---

## Task 6: Create Tags Settings Component

**Files:**
- Create: `components/settings/tags-settings.tsx`

**Step 1: Create the tags settings component**

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, MoreHorizontal, Pencil, Trash2, Search } from "lucide-react"
import { useOrganization } from "@/hooks/use-organization"
import { getTags, createTag, updateTag, deleteTag, TAG_COLORS } from "@/lib/actions/tags"
import { ColorPicker } from "@/components/ui/color-picker"
import type { OrganizationTag } from "@/lib/supabase/types"

export function TagsSettings() {
  const { organization } = useOrganization()
  const [tags, setTags] = useState<OrganizationTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<OrganizationTag | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(TAG_COLORS[10].hex) // Default to blue
  const [isSaving, setIsSaving] = useState(false)

  const loadTags = useCallback(async () => {
    if (!organization) return
    setIsLoading(true)
    const result = await getTags(organization.id)
    if (result.data) {
      setTags(result.data)
    }
    setIsLoading(false)
  }, [organization])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  const resetForm = () => {
    setName("")
    setDescription("")
    setColor(TAG_COLORS[10].hex)
    setError(null)
  }

  const handleCreate = async () => {
    if (!organization) return
    setIsSaving(true)
    setError(null)

    const result = await createTag(organization.id, { name, description, color })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsCreateOpen(false)
    resetForm()
    await loadTags()
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedTag) return
    setIsSaving(true)
    setError(null)

    const result = await updateTag(selectedTag.id, { name, description, color })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsEditOpen(false)
    setSelectedTag(null)
    resetForm()
    await loadTags()
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedTag) return

    const result = await deleteTag(selectedTag.id)

    if (result.error) {
      setError(result.error)
      return
    }

    setIsDeleteOpen(false)
    setSelectedTag(null)
    await loadTags()
  }

  const openEditDialog = (tag: OrganizationTag) => {
    setSelectedTag(tag)
    setName(tag.name)
    setDescription(tag.description || "")
    setColor(tag.color)
    setError(null)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (tag: OrganizationTag) => {
    setSelectedTag(tag)
    setIsDeleteOpen(true)
  }

  const filteredTags = tags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Create and manage tags to categorize your projects and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header with search and add button */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Tag</DialogTitle>
                  <DialogDescription>
                    Add a new tag to organize your projects and tasks.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Urgent, Backend, Design"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional description"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <ColorPicker value={color} onChange={setColor} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-md"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">{name || "Preview"}</span>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!name.trim() || isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Tag
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tags List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No tags match your search" : "No tags yet. Create your first tag!"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div>
                      <p className="font-medium">{tag.name}</p>
                      {tag.description && (
                        <p className="text-sm text-muted-foreground">{tag.description}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(tag)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(tag)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open)
        if (!open) {
          setSelectedTag(null)
          resetForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-md"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{name || "Preview"}</span>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{selectedTag?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/tags-settings.tsx
git commit -m "feat(settings): add TagsSettings component"
```

---

## Task 7: Create Labels Settings Component

**Files:**
- Create: `components/settings/labels-settings.tsx`

**Step 1: Create the labels settings component**

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useOrganization } from "@/hooks/use-organization"
import { getLabels, createLabel, updateLabel, deleteLabel } from "@/lib/actions/labels"
import { TAG_COLORS } from "@/lib/actions/tags"
import { ColorPicker } from "@/components/ui/color-picker"
import type { OrganizationLabel, LabelCategory } from "@/lib/supabase/types"

const CATEGORY_INFO: Record<LabelCategory, { title: string; description: string }> = {
  type: {
    title: "Type Labels",
    description: "Categorize projects by type (e.g., Internal, Client Work, R&D)",
  },
  duration: {
    title: "Duration Labels",
    description: "Indicate project duration (e.g., Short-term, Long-term, Ongoing)",
  },
  group: {
    title: "Group Labels",
    description: "Group projects by department or category (e.g., Marketing, Engineering)",
  },
  badge: {
    title: "Badge Labels",
    description: "Highlight project status or attributes (e.g., Featured, On Hold, Priority)",
  },
}

export function LabelsSettings() {
  const { organization } = useOrganization()
  const [labels, setLabels] = useState<OrganizationLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<LabelCategory>("type")
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<OrganizationLabel | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(TAG_COLORS[10].hex)
  const [isSaving, setIsSaving] = useState(false)

  const loadLabels = useCallback(async () => {
    if (!organization) return
    setIsLoading(true)
    const result = await getLabels(organization.id)
    if (result.data) {
      setLabels(result.data)
    }
    setIsLoading(false)
  }, [organization])

  useEffect(() => {
    loadLabels()
  }, [loadLabels])

  const resetForm = () => {
    setName("")
    setDescription("")
    setColor(TAG_COLORS[10].hex)
    setError(null)
  }

  const handleCreate = async () => {
    if (!organization) return
    setIsSaving(true)
    setError(null)

    const result = await createLabel(organization.id, {
      category: activeCategory,
      name,
      description,
      color,
    })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsCreateOpen(false)
    resetForm()
    await loadLabels()
    setIsSaving(false)
  }

  const handleEdit = async () => {
    if (!selectedLabel) return
    setIsSaving(true)
    setError(null)

    const result = await updateLabel(selectedLabel.id, { name, description, color })

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setIsEditOpen(false)
    setSelectedLabel(null)
    resetForm()
    await loadLabels()
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedLabel) return

    const result = await deleteLabel(selectedLabel.id)

    if (result.error) {
      setError(result.error)
      return
    }

    setIsDeleteOpen(false)
    setSelectedLabel(null)
    await loadLabels()
  }

  const openEditDialog = (label: OrganizationLabel) => {
    setSelectedLabel(label)
    setName(label.name)
    setDescription(label.description || "")
    setColor(label.color)
    setError(null)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (label: OrganizationLabel) => {
    setSelectedLabel(label)
    setIsDeleteOpen(true)
  }

  const filteredLabels = labels.filter((label) => label.category === activeCategory)

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Labels</CardTitle>
          <CardDescription>
            Create and manage labels to categorize your projects by type, duration, group, and badges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as LabelCategory)}>
            <TabsList className="mb-4">
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="duration">Duration</TabsTrigger>
              <TabsTrigger value="group">Group</TabsTrigger>
              <TabsTrigger value="badge">Badge</TabsTrigger>
            </TabsList>

            {(["type", "duration", "group", "badge"] as LabelCategory[]).map((category) => (
              <TabsContent key={category} value={category} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{CATEGORY_INFO[category].title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {CATEGORY_INFO[category].description}
                    </p>
                  </div>
                  <Dialog open={isCreateOpen && activeCategory === category} onOpenChange={(open) => {
                    setIsCreateOpen(open)
                    if (!open) resetForm()
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        New Label
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create {CATEGORY_INFO[category].title.replace(" Labels", "")} Label</DialogTitle>
                        <DialogDescription>
                          Add a new label for categorizing projects.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Internal, Short-term, Marketing"
                            maxLength={50}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description"
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <ColorPicker value={color} onChange={setColor} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium">{name || "Preview"}</span>
                        </div>
                      </div>
                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={!name.trim() || isSaving}>
                          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Label
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLabels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No {category} labels yet. Create your first one!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLabels.map((label) => (
                      <div
                        key={label.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          <div>
                            <p className="font-medium">{label.name}</p>
                            {label.description && (
                              <p className="text-sm text-muted-foreground">{label.description}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(label)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(label)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open)
        if (!open) {
          setSelectedLabel(null)
          resetForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
            <DialogDescription>
              Update the label details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-md"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{name || "Preview"}</span>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the label "{selectedLabel?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/labels-settings.tsx
git commit -m "feat(settings): add LabelsSettings component"
```

---

## Task 8: Update Settings Exports and Page

**Files:**
- Modify: `components/settings/index.ts`
- Modify: `app/(dashboard)/settings/page.tsx`

**Step 1: Update settings index exports**

Replace contents of `components/settings/index.ts`:

```typescript
export { ProfileSettings } from "./profile-settings"
export { AISettings } from "./ai-settings"
export { OrganizationSettings } from "./organization-settings"
export { TagsSettings } from "./tags-settings"
export { LabelsSettings } from "./labels-settings"
```

**Step 2: Update settings page with new tabs**

Replace contents of `app/(dashboard)/settings/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettings, AISettings, OrganizationSettings, TagsSettings, LabelsSettings } from "@/components/settings"
import { User, Sparkles, Building2, Tag, Tags } from "lucide-react"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Settings</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-4 pt-4 pb-2">
            <TabsList className="inline-flex bg-muted rounded-full px-1 py-0.5 text-xs border border-border/50 h-8">
              <TabsTrigger
                value="profile"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <User className="h-3.5 w-3.5" />
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI
              </TabsTrigger>
              <TabsTrigger
                value="organization"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5" />
                Organization
              </TabsTrigger>
              <TabsTrigger
                value="tags"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
              </TabsTrigger>
              <TabsTrigger
                value="labels"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <Tags className="h-3.5 w-3.5" />
                Labels
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto px-4 pb-4">
            <div className="max-w-2xl">
              <TabsContent value="profile" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ProfileSettings />
              </TabsContent>

              <TabsContent value="ai" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <AISettings />
              </TabsContent>

              <TabsContent value="organization" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <OrganizationSettings />
              </TabsContent>

              <TabsContent value="tags" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <TagsSettings />
              </TabsContent>

              <TabsContent value="labels" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <LabelsSettings />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add components/settings/index.ts app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): add Tags and Labels tabs to settings page"
```

---

## Task 9: Verify Build and Test

**Step 1: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Manual test**

1. Start dev server: `pnpm dev`
2. Navigate to Settings page
3. Verify Tags and Labels tabs appear
4. Test creating, editing, deleting tags
5. Test creating, editing, deleting labels in each category

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete tags and labels settings implementation"
```

---

## Summary

This implementation adds:
1. Database tables for `organization_tags` and `organization_labels` with RLS
2. Server actions for CRUD operations on tags and labels
3. ColorPicker component with 16 preset colors
4. TagsSettings component with search, create, edit, delete
5. LabelsSettings component with category tabs (Type, Duration, Group, Badge)
6. Updated Settings page with new Tags and Labels tabs

Future integration tasks (not in this plan):
- Update project forms to use tag/label dropdowns
- Update task forms to use tag dropdown
- Display colored badges on project/task cards
