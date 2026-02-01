-- Critical Security Fixes Migration
-- Fixes identified in database audit on 2026-02-01

-- ============================================================================
-- CRITICAL FIX 1: Remove open RLS policies that expose all data
-- These policies bypass multi-tenant isolation completely
-- ============================================================================

-- Remove the "Allow all select" policy on projects table
DROP POLICY IF EXISTS "Allow all select for realtime test" ON projects;

-- Remove the "Allow all select" policy on tasks table
DROP POLICY IF EXISTS "Allow all select for realtime" ON tasks;

-- ============================================================================
-- CRITICAL FIX 2: Fix search_path in SECURITY DEFINER function
-- Without SET search_path = '', the function is vulnerable to search path attacks
-- ============================================================================

-- Drop and recreate the function with proper search_path
CREATE OR REPLACE FUNCTION public.create_default_workflow_statuses(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.workflow_statuses (organization_id, name, color, sort_order, is_default, is_completed)
  VALUES
    (org_id, 'To Do', '#6B7280', 0, true, false),
    (org_id, 'In Progress', '#3B82F6', 1, false, false),
    (org_id, 'In Review', '#F59E0B', 2, false, false),
    (org_id, 'Done', '#10B981', 3, false, true)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$function$;

-- ============================================================================
-- HIGH FIX: Optimize RLS policies on chat tables with (SELECT auth.uid()) pattern
-- This prevents re-evaluation per row
-- ============================================================================

-- Drop and recreate chat_conversations policies with optimized pattern
DROP POLICY IF EXISTS "Users can read own conversations" ON chat_conversations;
CREATE POLICY "Users can read own conversations"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own conversations" ON chat_conversations;
CREATE POLICY "Users can insert own conversations"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own conversations" ON chat_conversations;
CREATE POLICY "Users can update own conversations"
  ON chat_conversations FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own conversations" ON chat_conversations;
CREATE POLICY "Users can delete own conversations"
  ON chat_conversations FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Drop and recreate chat_messages policies with optimized pattern
DROP POLICY IF EXISTS "Users can read messages from own conversations" ON chat_messages;
CREATE POLICY "Users can read messages from own conversations"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.chat_conversations WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON chat_messages;
CREATE POLICY "Users can insert messages to own conversations"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.chat_conversations WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update messages in own conversations" ON chat_messages;
CREATE POLICY "Users can update messages in own conversations"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.chat_conversations WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON chat_messages;
CREATE POLICY "Users can delete messages from own conversations"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.chat_conversations WHERE user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- HIGH FIX: Add missing index on chat_conversations.organization_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_conversations_organization_id
  ON chat_conversations(organization_id);

-- ============================================================================
-- Verify changes
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Critical security fixes applied successfully';
  RAISE NOTICE '- Removed open RLS policies on projects and tasks';
  RAISE NOTICE '- Fixed search_path in create_default_workflow_statuses';
  RAISE NOTICE '- Optimized chat RLS policies with (SELECT auth.uid()) pattern';
  RAISE NOTICE '- Added index on chat_conversations.organization_id';
END $$;
