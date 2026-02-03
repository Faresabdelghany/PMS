-- ============================================
-- Task Comments, Activities & Reactions
-- Migration: 20260203000001_task_comments
-- ============================================
-- Adds tables for task comments, activity tracking, reactions, and attachments

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get project_id from a task
CREATE OR REPLACE FUNCTION get_task_project_id(t_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT project_id FROM public.tasks WHERE id = t_id;
$$;

-- Check if user can access a task (through project membership)
CREATE OR REPLACE FUNCTION can_access_task(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.project_members pm ON pm.project_id = t.project_id
    WHERE t.id = t_id
    AND pm.user_id = auth.uid()
  );
$$;

-- ============================================
-- TABLES
-- ============================================

-- Task Comments
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Task Activities (audit log)
CREATE TABLE task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Task Comment Reactions
CREATE TABLE task_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id, emoji)
);

-- Task Comment Attachments
CREATE TABLE task_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Task Comments: query by task, ordered by created_at
CREATE INDEX idx_task_comments_task_created
  ON task_comments(task_id, created_at ASC);

-- Task Activities: query by task, ordered by created_at
CREATE INDEX idx_task_activities_task_created
  ON task_activities(task_id, created_at ASC);

-- Task Comment Reactions: query by comment
CREATE INDEX idx_task_comment_reactions_comment
  ON task_comment_reactions(comment_id);

-- Task Comment Attachments: query by comment
CREATE INDEX idx_task_comment_attachments_comment
  ON task_comment_attachments(comment_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to task_comments
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comment_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - Task Comments
-- ============================================

-- Project members can view comments on tasks they can access
CREATE POLICY "Project members can view task comments"
  ON task_comments FOR SELECT
  USING (can_access_task(task_id));

-- Project members can create comments
CREATE POLICY "Project members can create task comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    can_access_task(task_id) AND
    author_id = auth.uid()
  );

-- Users can update their own comments
CREATE POLICY "Users can update own task comments"
  ON task_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own task comments"
  ON task_comments FOR DELETE
  USING (author_id = auth.uid());

-- ============================================
-- RLS POLICIES - Task Activities
-- ============================================

-- Project members can view activities
CREATE POLICY "Project members can view task activities"
  ON task_activities FOR SELECT
  USING (can_access_task(task_id));

-- Project members can create activities (for task updates)
CREATE POLICY "Project members can create task activities"
  ON task_activities FOR INSERT
  WITH CHECK (
    can_access_task(task_id) AND
    actor_id = auth.uid()
  );

-- Activities are immutable - no update or delete policies

-- ============================================
-- RLS POLICIES - Task Comment Reactions
-- ============================================

-- Project members can view reactions
CREATE POLICY "Project members can view task comment reactions"
  ON task_comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_comments tc
      WHERE tc.id = comment_id
      AND can_access_task(tc.task_id)
    )
  );

-- Project members can add reactions
CREATE POLICY "Project members can add task comment reactions"
  ON task_comment_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM task_comments tc
      WHERE tc.id = comment_id
      AND can_access_task(tc.task_id)
    )
  );

-- Users can remove their own reactions
CREATE POLICY "Users can remove own task comment reactions"
  ON task_comment_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES - Task Comment Attachments
-- ============================================

-- Project members can view attachments
CREATE POLICY "Project members can view task comment attachments"
  ON task_comment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_comments tc
      WHERE tc.id = comment_id
      AND can_access_task(tc.task_id)
    )
  );

-- Comment authors can add attachments (during comment creation)
CREATE POLICY "Comment authors can add task comment attachments"
  ON task_comment_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_comments tc
      WHERE tc.id = comment_id
      AND tc.author_id = auth.uid()
    )
  );

-- Comment authors can delete their attachments
CREATE POLICY "Comment authors can delete task comment attachments"
  ON task_comment_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM task_comments tc
      WHERE tc.id = comment_id
      AND tc.author_id = auth.uid()
    )
  );

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Create task-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760, -- 10MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/markdown'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Helper function to get task_id from storage path
-- Path format: {org_id}/{task_id}/{filename}
CREATE OR REPLACE FUNCTION public.get_task_id_from_attachment_path(path TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN (string_to_array(path, '/'))[2]::UUID;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Project members can read task attachments
CREATE POLICY "Project members can read task attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments' AND
  can_access_task(public.get_task_id_from_attachment_path(name))
);

-- Project members can upload task attachments
CREATE POLICY "Project members can upload task attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' AND
  can_access_task(public.get_task_id_from_attachment_path(name))
);

-- Users can delete their own uploaded attachments
CREATE POLICY "Users can delete own task attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-attachments' AND
  owner_id::uuid = auth.uid()
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE task_comments IS 'Stores comments/discussion on tasks';
COMMENT ON TABLE task_activities IS 'Audit log of task changes (status, assignee, etc.)';
COMMENT ON TABLE task_comment_reactions IS 'Emoji reactions on task comments';
COMMENT ON TABLE task_comment_attachments IS 'File attachments on task comments';
COMMENT ON COLUMN task_activities.action IS 'Action type: created, status_changed, assignee_changed, priority_changed, due_date_changed, workstream_changed, description_changed, tag_changed';
COMMENT ON COLUMN task_activities.metadata IS 'Additional context for the activity (e.g., old/new assignee names)';

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for task comments and activities
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE task_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE task_comment_reactions;
