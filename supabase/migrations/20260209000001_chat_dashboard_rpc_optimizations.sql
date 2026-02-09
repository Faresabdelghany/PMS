-- ============================================
-- Chat & Dashboard RPC Optimizations
-- Migration: 20260209000001_chat_dashboard_rpc_optimizations
-- ============================================
-- Creates RPC functions to consolidate multiple round-trip queries
-- into single database calls for Chat and Dashboard pages.
--
-- Problem: Chat page makes 7+ separate queries for AI context data,
-- and the conversation page fetches conversation + messages separately.
-- Dashboard stats require multiple count queries.
--
-- Solution: Server-side RPC functions that return all needed data in one call.

-- ============================================
-- 1. get_conversation_with_messages
-- Fetches a conversation and its messages in a single round trip.
-- Eliminates 2 separate queries on /chat/[conversationId].
-- ============================================

CREATE OR REPLACE FUNCTION get_conversation_with_messages(
  p_conversation_id UUID,
  p_message_limit INT DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation JSON;
  v_messages JSON;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch conversation (RLS-like check: only own conversations)
  SELECT json_build_object(
    'id', c.id,
    'organization_id', c.organization_id,
    'user_id', c.user_id,
    'title', c.title,
    'created_at', c.created_at,
    'updated_at', c.updated_at
  ) INTO v_conversation
  FROM chat_conversations c
  WHERE c.id = p_conversation_id
    AND c.user_id = v_user_id;

  IF v_conversation IS NULL THEN
    RETURN json_build_object('conversation', NULL, 'messages', '[]'::json);
  END IF;

  -- Fetch messages for the conversation
  SELECT COALESCE(json_agg(m ORDER BY m.created_at ASC), '[]'::json)
  INTO v_messages
  FROM (
    SELECT
      id, conversation_id, role, content,
      attachments, action_data, multi_action_data, created_at
    FROM chat_messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at ASC
    LIMIT p_message_limit
  ) m;

  RETURN json_build_object(
    'conversation', v_conversation,
    'messages', v_messages
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_conversation_with_messages(UUID, INT) TO authenticated;


-- ============================================
-- 2. get_dashboard_stats
-- Consolidates project count, task stats, and client count
-- into a single database call. Replaces 3 separate queries
-- used by getCachedProjectCount, getCachedTaskStats, getCachedClientCount.
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_total INT;
  v_project_active INT;
  v_project_completed INT;
  v_client_total INT;
  v_task_total INT;
  v_task_due_today INT;
  v_task_overdue INT;
  v_task_completed_week INT;
  v_now TIMESTAMPTZ;
  v_today DATE;
  v_start_of_week TIMESTAMPTZ;
BEGIN
  -- Verify user is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_now := now();
  v_today := v_now::date;
  -- Start of week (Sunday)
  v_start_of_week := date_trunc('week', v_now) - interval '1 day';

  -- Project counts (single scan)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_project_total, v_project_active, v_project_completed
  FROM projects
  WHERE organization_id = p_org_id;

  -- Client count
  SELECT COUNT(*)
  INTO v_client_total
  FROM clients
  WHERE organization_id = p_org_id;

  -- Task stats for current user (single scan with conditional aggregates)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE end_date::date = v_today AND status != 'done'),
    COUNT(*) FILTER (WHERE end_date IS NOT NULL AND end_date::date < v_today AND status != 'done'),
    COUNT(*) FILTER (WHERE status = 'done' AND updated_at >= v_start_of_week)
  INTO v_task_total, v_task_due_today, v_task_overdue, v_task_completed_week
  FROM tasks t
  INNER JOIN projects p ON t.project_id = p.id
  WHERE t.assignee_id = p_user_id
    AND p.organization_id = p_org_id;

  RETURN json_build_object(
    'projects', json_build_object(
      'total', v_project_total,
      'active', v_project_active,
      'completed', v_project_completed
    ),
    'clients', json_build_object(
      'total', v_client_total
    ),
    'tasks', json_build_object(
      'total', v_task_total,
      'dueToday', v_task_due_today,
      'overdue', v_task_overdue,
      'completedThisWeek', v_task_completed_week
    )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, UUID) TO authenticated;


-- ============================================
-- 3. get_ai_context_summary
-- Consolidates the 7 queries made by getAIContext() into 1 call.
-- Returns lightweight summaries (IDs, names, statuses) needed
-- for AI chat context, not full records.
-- ============================================

CREATE OR REPLACE FUNCTION get_ai_context_summary(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org JSON;
  v_projects JSON;
  v_clients JSON;
  v_members JSON;
  v_teams JSON;
  v_inbox JSON;
  v_tasks JSON;
BEGIN
  -- Verify membership
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Organization name
  SELECT json_build_object('id', id, 'name', name)
  INTO v_org
  FROM organizations
  WHERE id = p_org_id;

  -- Projects summary (id, name, status, client name, due date)
  SELECT COALESCE(json_agg(proj), '[]'::json)
  INTO v_projects
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'name', p.name,
      'status', p.status,
      'clientName', c.name,
      'dueDate', p.end_date
    ) AS proj
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.organization_id = p_org_id
    ORDER BY p.updated_at DESC
    LIMIT 20
  ) sub;

  -- Clients summary
  SELECT COALESCE(json_agg(json_build_object(
    'id', id,
    'name', name,
    'status', COALESCE(status, 'active'),
    'projectCount', 0
  )), '[]'::json)
  INTO v_clients
  FROM clients
  WHERE organization_id = p_org_id;

  -- Members summary
  SELECT COALESCE(json_agg(json_build_object(
    'id', om.user_id,
    'name', COALESCE(pr.full_name, pr.email),
    'email', pr.email,
    'role', om.role
  )), '[]'::json)
  INTO v_members
  FROM organization_members om
  JOIN profiles pr ON pr.id = om.user_id
  WHERE om.organization_id = p_org_id;

  -- Teams summary
  SELECT COALESCE(json_agg(json_build_object(
    'id', id,
    'name', name,
    'memberCount', 0
  )), '[]'::json)
  INTO v_teams
  FROM teams
  WHERE organization_id = p_org_id;

  -- Inbox items (latest 5)
  SELECT COALESCE(json_agg(inbox_item), '[]'::json)
  INTO v_inbox
  FROM (
    SELECT json_build_object(
      'id', id,
      'type', COALESCE(item_type, 'notification'),
      'title', title,
      'read', is_read,
      'createdAt', created_at
    ) AS inbox_item
    FROM inbox_items
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) sub;

  -- User tasks summary
  SELECT COALESCE(json_agg(task_item), '[]'::json)
  INTO v_tasks
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.name,
      'status', t.status,
      'priority', t.priority,
      'projectId', t.project_id,
      'projectName', COALESCE(p.name, 'Unknown'),
      'dueDate', t.end_date
    ) AS task_item
    FROM tasks t
    INNER JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = p_user_id
      AND p.organization_id = p_org_id
    ORDER BY t.updated_at DESC
  ) sub;

  RETURN json_build_object(
    'organization', v_org,
    'projects', v_projects,
    'clients', v_clients,
    'members', v_members,
    'teams', v_teams,
    'inbox', v_inbox,
    'userTasks', v_tasks
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_ai_context_summary(UUID, UUID) TO authenticated;


-- ============================================
-- 4. Additional index for inbox items by user + read status
-- Optimizes getUnreadCount() query
-- ============================================

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_unread
ON inbox_items(user_id, is_read)
WHERE is_read = false;

-- ============================================
-- 5. Analyze all affected tables
-- ============================================

ANALYZE chat_conversations;
ANALYZE chat_messages;
ANALYZE projects;
ANALYZE clients;
ANALYZE tasks;
ANALYZE inbox_items;
ANALYZE organization_members;
ANALYZE teams;
