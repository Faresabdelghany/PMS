# Task Details Page Design

**Date:** 2026-02-03
**Status:** Approved

## Overview

Implement a Task Details slide-over panel with rich commenting, activity tracking, and real-time collaboration. The design combines GitHub Issues-style presentation with Slack-like rich text editing.

## Key Decisions

| Aspect | Decision |
|--------|----------|
| Navigation | Slide-over panel from right (not dedicated page) |
| Layout | Description at top, interleaved comments + activity below |
| Editor | Full Tiptap with formatting, @mentions, emoji, file attachments |
| Reactions | Emoji reactions on comments |
| Permissions | All project members can comment and edit |
| Real-time | Live updates via Supabase Realtime |
| URL | Query param `?task={id}` for shareability |

## Database Schema

### task_comments

```sql
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  content TEXT NOT NULL,              -- HTML from Tiptap editor
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_created_at ON task_comments(task_id, created_at);
```

### task_activities

```sql
CREATE TABLE task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  action TEXT NOT NULL,               -- 'status_changed', 'assignee_changed', etc.
  old_value TEXT,                     -- Previous value (nullable)
  new_value TEXT,                     -- New value
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_task_activities_task_id ON task_activities(task_id);
CREATE INDEX idx_task_activities_created_at ON task_activities(task_id, created_at);
```

### task_comment_reactions

```sql
CREATE TABLE task_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id, emoji)
);

CREATE INDEX idx_task_comment_reactions_comment_id ON task_comment_reactions(comment_id);
```

### task_comment_attachments

```sql
CREATE TABLE task_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_task_comment_attachments_comment_id ON task_comment_attachments(comment_id);
```

### RLS Policies

All tables use project-based access control:

```sql
-- Example for task_comments (same pattern for all tables)
CREATE POLICY "Users can view comments on tasks they can access"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_comments.task_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_comments.task_id
      AND pm.user_id = auth.uid()
    )
    AND author_id = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON task_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON task_comments FOR DELETE
  USING (author_id = auth.uid());
```

## UI Component Structure

```
components/tasks/
├── TaskDetailPanel.tsx          # Main slide-over container
├── TaskDetailHeader.tsx         # Task name, status badge, close button
├── TaskDetailFields.tsx         # Editable fields grid
├── TaskDetailDescription.tsx    # Tiptap editor for description
├── TaskTimeline.tsx             # Combined comments + activity feed
├── TaskTimelineItem.tsx         # Single timeline item wrapper
├── TaskCommentItem.tsx          # Comment with reactions, edit, reply
├── TaskActivityItem.tsx         # Activity event display
├── TaskCommentEditor.tsx        # Rich text input with attachments
├── TaskReactions.tsx            # Emoji reaction picker and display
└── TaskMentionSuggestions.tsx   # @mention autocomplete dropdown
```

## Panel Layout

```
┌─────────────────────────────────────┐
│ Header: Task name + status + ✕      │
├─────────────────────────────────────┤
│ Fields: Assignee | Priority | Dates │
│         Workstream | Tags           │
├─────────────────────────────────────┤
│ Description (collapsible Tiptap)    │
├─────────────────────────────────────┤
│ Timeline (scrollable)               │
│  ├─ Activity: John created task     │
│  ├─ Comment: "Let's discuss..."     │
│  │   └─ Reactions: 👍 2             │
│  ├─ Activity: Status → In Progress  │
│  └─ Comment: "Done with first..."   │
├─────────────────────────────────────┤
│ Comment Editor (sticky bottom)      │
│ [Rich text input] [Attach] [Send]   │
└─────────────────────────────────────┘
```

## Panel Behavior

### Dimensions
- Desktop (>1024px): 50% width, task list visible
- Tablet (768-1024px): 65% width
- Mobile (<768px): Full width overlay

### Opening
- Click task name → Opens panel
- URL updates to `?task={taskId}`
- Browser back closes panel

### Closing
- Click ✕ button
- Press Escape key
- Click outside (desktop)
- Browser back

### Animation
- Slide from right (200ms ease-out)
- Backdrop on mobile only

## Server Actions

### lib/actions/task-comments.ts

```typescript
// Comments CRUD
createTaskComment(taskId: string, content: string, attachmentPaths?: string[])
updateTaskComment(commentId: string, content: string)
deleteTaskComment(commentId: string)

// Reactions
toggleReaction(commentId: string, emoji: string)

// Timeline (merged comments + activities)
getTaskTimeline(taskId: string): Promise<ActionResult<TimelineItem[]>>
```

### lib/actions/task-activities.ts

```typescript
// Called internally by task update actions
createTaskActivity(taskId: string, actorId: string, action: string, oldValue?: string, newValue?: string)
```

### Modify lib/actions/tasks.ts

- Wrap `updateTask()` to detect field changes and create activities
- Add activity creation to `updateTaskStatus()`, `updateTaskAssignee()`, etc.

## Activity Types

| Action | Display |
|--------|---------|
| `created` | "John created this task" |
| `status_changed` | "John changed status from **Todo** to **In Progress**" |
| `assignee_changed` | "John assigned this to **Sarah**" |
| `assignee_removed` | "John unassigned **Sarah**" |
| `priority_changed` | "John changed priority to **High**" |
| `due_date_changed` | "John changed due date to **Feb 15**" |
| `workstream_changed` | "John moved this to **Design**" |
| `description_changed` | "John updated the description" |
| `tag_changed` | "John changed tag to **feature**" |

## Comment Editor Features

### Tiptap Extensions
- StarterKit (bold, italic, lists, blockquotes, code)
- Link (clickable links)
- CodeBlockLowlight (syntax highlighting)
- Mention (@user mentions)
- Placeholder

### Additional Features
- Emoji picker (toolbar button)
- File attachments (images, PDFs, docs up to 10MB)
- Keyboard shortcuts: Cmd+Enter submit, Cmd+B/I/K formatting

### @Mentions Flow
1. Type `@` → Show filtered member list
2. Select member → Insert mention node
3. On submit → Create inbox notifications for mentioned users

## Real-time Updates

```typescript
// Subscribe to comments and activities for a task
useTaskTimelineRealtime(taskId: string, callbacks: {
  onCommentInsert: (comment: Comment) => void
  onCommentUpdate: (comment: Comment) => void
  onCommentDelete: (commentId: string) => void
  onActivityInsert: (activity: Activity) => void
  onReactionChange: (commentId: string, reactions: Reaction[]) => void
})
```

## Supabase Storage

New bucket: `task-attachments`

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false);

-- RLS: Project members can upload/download
CREATE POLICY "Project members can manage task attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');
```

## Cache Tags

Add to `lib/cache-tags.ts`:

```typescript
taskComments: (taskId: string) => `task-comments-${taskId}`,
taskActivities: (taskId: string) => `task-activities-${taskId}`,
taskTimeline: (taskId: string) => `task-timeline-${taskId}`,
```

## Implementation Order

1. Database migration (tables, RLS, indexes, storage bucket)
2. TypeScript types for new tables
3. Server actions (comments, activities, timeline)
4. Modify existing task actions to create activities
5. TaskDetailPanel container with slide-over behavior
6. TaskDetailHeader and TaskDetailFields
7. TaskDetailDescription with Tiptap
8. TaskTimeline, TaskCommentItem, TaskActivityItem
9. TaskCommentEditor with @mentions
10. TaskReactions with emoji picker
11. File attachment upload/display
12. Real-time subscriptions
13. Mobile responsive adjustments
14. Integration with task list (click to open)
