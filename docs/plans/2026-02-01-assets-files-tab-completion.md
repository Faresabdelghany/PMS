# Assets & Files Tab Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Assets & Files tab by fetching real files from database, implementing edit/delete operations, and adding real-time file updates.

**Architecture:**
1. Fetch files from Supabase in ProjectDetailsPage using existing `getProjectFiles()` action
2. Implement edit/delete handlers in AssetsFilesTab with server actions
3. Add real-time subscriptions using existing pooled realtime infrastructure
4. Wire up modal dialogs for edit operations with form validation

**Tech Stack:** Next.js Server Actions, React hooks, Supabase realtime, React Hook Form, Zod validation, shadcn/ui modals

---

## Task 1: Fetch Files from Database in ProjectDetailsPage

**Files:**
- Modify: `app/(dashboard)/projects/[id]/page.tsx:280` (where files are initialized)
- Modify: `lib/actions/project-details.ts` (fetch files within existing getProjectDetails call)
- Reference: `lib/actions/files.ts:getProjectFiles()` (existing server action to use)

**Step 1: Read ProjectDetailsPage to understand current structure**

Run: `read app/(dashboard)/projects/[id]/page.tsx`

Expected: See how `project` object is constructed and where `files: []` is hardcoded

**Step 2: Read project-details.ts to see getProjectDetails structure**

Run: `read lib/actions/project-details.ts`

Expected: Understand how related data (tasks, workstreams) are fetched and returned

**Step 3: Modify getProjectDetails to fetch files**

In `lib/actions/project-details.ts`, add files fetching:
```typescript
// After fetching other relations, add:
const filesData = await getProjectFiles(projectId);
if (filesData.error) {
  return { error: filesData.error };
}

// Map database format to UI format
const files = (filesData.data || []).map(file => ({
  ...file,
  sizeMB: Math.round(file.size_bytes / 1024 / 1024 * 100) / 100,
  type: file.file_type as any,
  addedDate: new Date(file.created_at),
  addedBy: file.profiles ? {
    id: file.profiles.id,
    email: file.profiles.email,
    fullName: file.profiles.full_name || 'Unknown',
    avatar: file.profiles.avatar_url,
  } : { id: '', email: 'Unknown', fullName: 'Unknown' },
}));
```

**Step 4: Return files in getProjectDetails response**

In `lib/actions/project-details.ts`, update return statement:
```typescript
return {
  data: {
    ...project,
    files,
    // ... rest of fields
  }
};
```

**Step 5: Test the changes**

Navigate to a project details page in dev server and check browser DevTools Network tab to verify files are being fetched. Files section should now show real data from database (if any files exist for that project).

**Step 6: Commit**

```bash
git add app/(dashboard)/projects/[id]/page.tsx lib/actions/project-details.ts
git commit -m "feat: fetch project files from database in project details"
```

---

## Task 2: Create EditFileModal Component

**Files:**
- Create: `components/projects/EditFileModal.tsx`
- Reference: `components/projects/AddFileModal.tsx` (use as template for modal structure)
- Reference: `lib/actions/files.ts:updateFile()` (existing server action)

**Step 1: Create EditFileModal component with form**

Create `components/projects/EditFileModal.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { updateFile } from '@/lib/actions/files';
import { ProjectFile } from '@/lib/data/project-details';

const editFileSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  description: z.string().optional(),
});

type EditFileFormValues = z.infer<typeof editFileSchema>;

interface EditFileModalProps {
  file: ProjectFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditFileModal({
  file,
  open,
  onOpenChange,
  onSuccess,
}: EditFileModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditFileFormValues>({
    resolver: zodResolver(editFileSchema),
    defaultValues: {
      name: file.name,
      description: file.description || '',
    },
  });

  async function onSubmit(values: EditFileFormValues) {
    setIsLoading(true);
    setError(null);

    const result = await updateFile(file.id, {
      name: values.name,
      description: values.description,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    form.reset();
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit File</DialogTitle>
          <DialogDescription>Update the file details</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter file name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a description for this file"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Test modal displays correctly**

Verify the component compiles and exports properly. No runtime test needed yet.

**Step 3: Commit**

```bash
git add components/projects/EditFileModal.tsx
git commit -m "feat: create edit file modal component with form"
```

---

## Task 3: Implement Edit/Delete Handlers in AssetsFilesTab

**Files:**
- Modify: `components/projects/AssetsFilesTab.tsx` (replace placeholder handlers)
- Reference: `components/projects/EditFileModal.tsx` (import and use)
- Reference: `lib/actions/files.ts:deleteFile()` (existing server action)

**Step 1: Read AssetsFilesTab to find current placeholder handlers**

Run: `read components/projects/AssetsFilesTab.tsx`

Expected: Find `handleEditFile` and `handleDeleteFile` with console.log statements around lines 39-45

**Step 2: Update AssetsFilesTab with edit/delete implementation**

Replace the handler section (around lines 39-45) with:
```typescript
const [editingFile, setEditingFile] = useState<ProjectFile | null>(null);
const [editModalOpen, setEditModalOpen] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

const handleEditFile = (file: ProjectFile) => {
  setEditingFile(file);
  setEditModalOpen(true);
};

const handleDeleteFile = async (fileId: string) => {
  if (!confirm('Are you sure you want to delete this file?')) {
    return;
  }

  setIsDeleting(true);
  const result = await deleteFile(fileId);
  setIsDeleting(false);

  if (result.error) {
    alert(`Failed to delete file: ${result.error}`);
    return;
  }

  // Trigger refresh - this will be improved with real-time in next task
  window.location.reload();
};

const handleFilesRefresh = () => {
  // Will be implemented with real-time subscription in Task 4
  window.location.reload();
};
```

**Step 3: Import EditFileModal and add to render**

Add import at top:
```typescript
import { EditFileModal } from './EditFileModal';
```

Add before the return statement:
```typescript
{editingFile && (
  <EditFileModal
    file={editingFile}
    open={editModalOpen}
    onOpenChange={setEditModalOpen}
    onSuccess={handleFilesRefresh}
  />
)}
```

**Step 4: Update FilesTable to pass handlers**

Modify the FilesTable render call to pass handlers:
```typescript
<FilesTable
  files={filteredFiles}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  onEditFile={handleEditFile}
  onDeleteFile={handleDeleteFile}
  isDeleting={isDeleting}
/>
```

**Step 5: Update FilesTable component to accept handlers**

Read and modify `components/projects/FilesTable.tsx` to:
- Accept `onEditFile`, `onDeleteFile`, `isDeleting` props
- Call these handlers from action menu instead of console.log

**Step 6: Test edit/delete flow**

- Open project details page
- Try clicking edit on a file - should open EditFileModal
- Try clicking delete on a file - should show confirmation and delete
- File should disappear from list (page reload)

**Step 7: Commit**

```bash
git add components/projects/AssetsFilesTab.tsx components/projects/FilesTable.tsx
git commit -m "feat: implement edit and delete file operations"
```

---

## Task 4: Add Real-time File Updates Subscription

**Files:**
- Create: `hooks/use-project-files-realtime.ts` (new realtime hook)
- Modify: `components/projects/AssetsFilesTab.tsx` (use realtime hook instead of static files)
- Reference: `hooks/use-realtime.ts` (existing realtime patterns)
- Reference: `hooks/realtime-context.tsx` (pooled realtime patterns)

**Step 1: Read existing realtime hooks for patterns**

Run: `read hooks/use-realtime.ts` and `read hooks/realtime-context.tsx`

Expected: Understand how subscriptions are set up and managed

**Step 2: Create new realtime hook for project files**

Create `hooks/use-project-files-realtime.ts`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ProjectFile } from '@/lib/data/project-details';
import { getProjectFiles } from '@/lib/actions/files';

export function useProjectFilesRealtime(projectId: string) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    const fetchFiles = async () => {
      setIsLoading(true);
      const result = await getProjectFiles(projectId);
      if (isMounted) {
        if (result.error) {
          setError(result.error);
        } else {
          // Transform to UI format (same as in Task 1)
          const transformed = (result.data || []).map(file => ({
            ...file,
            sizeMB: Math.round(file.size_bytes / 1024 / 1024 * 100) / 100,
            type: file.file_type as any,
            addedDate: new Date(file.created_at),
            addedBy: file.profiles ? {
              id: file.profiles.id,
              email: file.profiles.email,
              fullName: file.profiles.full_name || 'Unknown',
              avatar: file.profiles.avatar_url,
            } : { id: '', email: 'Unknown', fullName: 'Unknown' },
          }));
          setFiles(transformed as ProjectFile[]);
          setError(null);
        }
        setIsLoading(false);
      }
    };

    fetchFiles();

    // Setup realtime subscription
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`project-files:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (isMounted) {
            // Refetch files on any change
            fetchFiles();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { files, isLoading, error };
}
```

**Step 3: Update AssetsFilesTab to use realtime hook**

In `components/projects/AssetsFilesTab.tsx`, replace the static `files` prop with:
```typescript
interface AssetsFilesTabProps {
  projectId: string; // Change from files prop to projectId
}

export function AssetsFilesTab({ projectId }: AssetsFilesTabProps) {
  const { files, isLoading, error } = useProjectFilesRealtime(projectId);
  // ... rest of component
}
```

**Step 4: Remove window.location.reload() from handlers**

Update `handleFilesRefresh` to just trigger refetch:
```typescript
const handleFilesRefresh = () => {
  // Real-time subscription will automatically update files
  // No manual refresh needed
};
```

Update `handleDeleteFile` to not reload:
```typescript
const handleDeleteFile = async (fileId: string) => {
  if (!confirm('Are you sure you want to delete this file?')) {
    return;
  }

  setIsDeleting(true);
  const result = await deleteFile(fileId);
  setIsDeleting(false);

  if (result.error) {
    alert(`Failed to delete file: ${result.error}`);
    return;
  }

  // Real-time subscription will automatically update the list
};
```

**Step 5: Update ProjectDetailsPage to pass projectId instead of files**

In `app/(dashboard)/projects/[id]/page.tsx` around line 471:
```typescript
<TabsContent value="assets">
  <AssetsFilesTab projectId={project.id} />
</TabsContent>
```

**Step 6: Remove files from getProjectDetails return (optional cleanup)**

Since files are now fetched client-side, you can optionally remove the file fetching from `getProjectDetails` to reduce server load.

**Step 7: Test real-time updates**

- Open project details page
- Upload a new file from another tab/window
- Should see new file appear immediately without page refresh
- Delete a file - should disappear immediately

**Step 8: Commit**

```bash
git add hooks/use-project-files-realtime.ts components/projects/AssetsFilesTab.tsx app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat: add real-time file updates subscription"
```

---

## Task 5: Handle Loading and Error States

**Files:**
- Modify: `components/projects/AssetsFilesTab.tsx` (add loading/error UI)
- Reference: `components/ui/skeleton.tsx` (for loading skeletons)

**Step 1: Add loading skeleton in AssetsFilesTab**

In the render, wrap the content with:
```typescript
if (isLoading) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

if (error) {
  return (
    <div className="rounded-md bg-destructive/10 p-4 text-destructive">
      Failed to load files: {error}
    </div>
  );
}
```

**Step 2: Test loading and error states**

Temporarily break the action to test error state display.

**Step 3: Commit**

```bash
git add components/projects/AssetsFilesTab.tsx
git commit -m "feat: add loading and error states to assets tab"
```

---

## Task 6: Add E2E Tests for File Operations

**Files:**
- Create: `e2e/project-files.spec.ts`
- Reference: `e2e/fixtures.ts` (test setup)
- Reference: `e2e/pages/ProjectDetailsPage.ts` (page object)

**Step 1: Create E2E test file**

Create `e2e/project-files.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { authenticatedTest } from './fixtures';

authenticatedTest('should upload and display files', async ({ page, projectPage }) => {
  await projectPage.goto();

  // Upload a file
  await projectPage.uploadFile('test-file.pdf');

  // Verify file appears in files table
  await expect(page.locator('text=test-file.pdf')).toBeVisible();
});

authenticatedTest('should edit file details', async ({ page, projectPage }) => {
  await projectPage.goto();

  // Edit a file
  await projectPage.editFile('test-file.pdf', { name: 'renamed-file.pdf' });

  // Verify change appears
  await expect(page.locator('text=renamed-file.pdf')).toBeVisible();
});

authenticatedTest('should delete files', async ({ page, projectPage }) => {
  await projectPage.goto();

  // Delete a file
  await projectPage.deleteFile('test-file.pdf');

  // Verify file is gone
  await expect(page.locator('text=test-file.pdf')).not.toBeVisible();
});

authenticatedTest('should see real-time file updates', async ({ page, projectPage, context }) => {
  await projectPage.goto();

  // Open another tab and upload a file
  const page2 = await context.newPage();
  // ... upload file in page2

  // Verify first page sees it automatically
  await expect(page.locator('text=new-file.pdf')).toBeVisible();
});
```

**Step 2: Run E2E tests**

Run: `pnpm test:e2e project-files.spec.ts`

Expected: Tests should pass

**Step 3: Commit**

```bash
git add e2e/project-files.spec.ts
git commit -m "test: add e2e tests for file operations"
```

---

## Summary

| Task | What It Does | Time |
|------|-------------|------|
| 1 | Fetch files from database on page load | 15 min |
| 2 | Create edit file modal form | 10 min |
| 3 | Wire up edit/delete handlers | 15 min |
| 4 | Add real-time subscriptions | 20 min |
| 5 | Add loading/error states | 10 min |
| 6 | Write E2E tests | 15 min |

**Total estimated time:** ~90 minutes

**Testing approach:** After each task, manually test in dev server. Task 6 adds automated E2E coverage.

**Rollback strategy:** Each task is a separate commit - easy to revert if issues arise.

---

Plan complete and saved to `docs/plans/2026-02-01-assets-files-tab-completion.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach would you prefer?