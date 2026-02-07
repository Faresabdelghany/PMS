-- ============================================
-- Performance Fixes Migration
--
-- Fixes:
-- 1. Dead workstream index (wrong column name "order" → sort_order)
-- 2. Chat message RLS policies (IN subquery → EXISTS for better performance)
-- 3. Missing indexes for common query patterns
-- ============================================

-- ============================================
-- FIX 1: Workstream index references non-existent column "order"
-- The actual column is "sort_order"
-- ============================================

DROP INDEX IF EXISTS idx_workstreams_project_order;

CREATE INDEX IF NOT EXISTS idx_workstreams_project_sort_order
ON workstreams(project_id, sort_order);

-- ============================================
-- FIX 2: Chat message RLS policies - use EXISTS instead of IN
-- EXISTS allows PostgreSQL to stop scanning after first match,
-- while IN requires building the full subquery result set.
-- ============================================

DROP POLICY IF EXISTS "Users can read messages from own conversations" ON chat_messages;
CREATE POLICY "Users can read messages from own conversations"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON chat_messages;
CREATE POLICY "Users can insert messages to own conversations"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update messages in own conversations" ON chat_messages;
CREATE POLICY "Users can update messages in own conversations"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON chat_messages;
CREATE POLICY "Users can delete messages from own conversations"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND user_id = (SELECT auth.uid())
    )
  );

-- ============================================
-- FIX 3: Missing indexes for common query patterns
-- ============================================

-- Profile email index (needed for invitation acceptance and user lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_email
ON profiles(email);

-- Task activities by actor (needed for "activity by user" queries)
CREATE INDEX IF NOT EXISTS idx_task_activities_actor_created
ON task_activities(actor_id, created_at DESC);

-- Workflow statuses default lookup (partial index for fast default status queries)
CREATE INDEX IF NOT EXISTS idx_workflow_statuses_default
ON workflow_statuses(organization_id, entity_type, is_default)
WHERE is_default = true;

-- Task assignee + project + status (needed for "My Tasks" dashboard)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_project_status
ON tasks(assignee_id, project_id, status)
WHERE assignee_id IS NOT NULL;

-- Chat conversations by org (needed for org-scoped chat queries)
CREATE INDEX IF NOT EXISTS idx_chat_conversations_org_updated
ON chat_conversations(organization_id, updated_at DESC);

-- Task comments with ordering (needed for timeline queries)
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
ON task_comments(task_id, created_at ASC);
