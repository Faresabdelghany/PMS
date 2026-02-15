-- ============================================
-- Cursor Pagination & Aggregation Optimization
-- ============================================
--
-- Records indexes and RPC functions already applied to the live database
-- from the Feb 14 2026 performance audit. This migration exists to keep
-- the repo in sync with production.
--
-- P0: Replace unbounded full-table scans with SQL aggregation (RPC)
-- P1: Add composite indexes for cursor-based pagination
-- P2: Drop duplicate / overlapping indexes
-- ============================================

-- ============================================
-- P1: COMPOSITE INDEXES FOR CURSOR PAGINATION
-- ============================================

-- getTasks(cursor): ORDER BY sort_order ASC, id ASC WHERE project_id = $1
CREATE INDEX IF NOT EXISTS idx_tasks_project_sort_order_id
ON tasks(project_id, sort_order ASC, id ASC);

-- getMyTasks(cursor): ORDER BY updated_at DESC, id DESC WHERE assignee_id = $1
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_updated_id
ON tasks(assignee_id, updated_at DESC, id DESC)
WHERE assignee_id IS NOT NULL;

-- getProjects(cursor): ORDER BY updated_at DESC, id DESC WHERE organization_id = $1
CREATE INDEX IF NOT EXISTS idx_projects_org_updated_id
ON projects(organization_id, updated_at DESC, id DESC);

-- ============================================
-- P0 SUPPORTING INDEX: Project counts by client
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_client_status
ON projects(client_id, status)
WHERE client_id IS NOT NULL;

-- ============================================
-- P0: RPC FUNCTIONS FOR AGGREGATION
-- ============================================

-- 1. get_task_stats: Single-pass COUNT with FILTER replaces N-row fetch
CREATE OR REPLACE FUNCTION get_task_stats(p_project_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'todo',        COUNT(*) FILTER (WHERE status = 'todo'),
      'in-progress', COUNT(*) FILTER (WHERE status = 'in-progress'),
      'done',        COUNT(*) FILTER (WHERE status = 'done')
    ),
    'byPriority', json_build_object(
      'no-priority', COUNT(*) FILTER (WHERE priority = 'no-priority'),
      'low',         COUNT(*) FILTER (WHERE priority = 'low'),
      'medium',      COUNT(*) FILTER (WHERE priority = 'medium'),
      'high',        COUNT(*) FILTER (WHERE priority = 'high'),
      'urgent',      COUNT(*) FILTER (WHERE priority = 'urgent')
    )
  )
  FROM tasks
  WHERE project_id = p_project_id;
$$;

GRANT EXECUTE ON FUNCTION get_task_stats(UUID) TO authenticated;

-- 2. get_client_stats: Single-pass COUNT with FILTER replaces N-row fetch
CREATE OR REPLACE FUNCTION get_client_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'prospect', COUNT(*) FILTER (WHERE status = 'prospect'),
      'active',   COUNT(*) FILTER (WHERE status = 'active'),
      'on_hold',  COUNT(*) FILTER (WHERE status = 'on_hold'),
      'archived', COUNT(*) FILTER (WHERE status = 'archived')
    )
  )
  FROM clients
  WHERE organization_id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION get_client_stats(UUID) TO authenticated;

-- 3. get_project_stats: Single-pass COUNT with FILTER replaces N-row fetch
CREATE OR REPLACE FUNCTION get_project_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'byStatus', json_build_object(
      'backlog',    COUNT(*) FILTER (WHERE status = 'backlog'),
      'planned',    COUNT(*) FILTER (WHERE status = 'planned'),
      'active',     COUNT(*) FILTER (WHERE status = 'active'),
      'cancelled',  COUNT(*) FILTER (WHERE status = 'cancelled'),
      'completed',  COUNT(*) FILTER (WHERE status = 'completed')
    ),
    'byPriority', json_build_object(
      'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
      'high',   COUNT(*) FILTER (WHERE priority = 'high'),
      'medium', COUNT(*) FILTER (WHERE priority = 'medium'),
      'low',    COUNT(*) FILTER (WHERE priority = 'low')
    )
  )
  FROM projects
  WHERE organization_id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION get_project_stats(UUID) TO authenticated;

-- 4. get_project_counts_for_clients: GROUP BY aggregation replaces unbounded IN query
CREATE OR REPLACE FUNCTION get_project_counts_for_clients(p_client_ids UUID[])
RETURNS TABLE(
  client_id UUID,
  total BIGINT,
  active BIGINT,
  planned BIGINT,
  completed BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.client_id,
    COUNT(*)                                                     AS total,
    COUNT(*) FILTER (WHERE p.status = 'active')                  AS active,
    COUNT(*) FILTER (WHERE p.status IN ('planned', 'backlog'))   AS planned,
    COUNT(*) FILTER (WHERE p.status = 'completed')               AS completed
  FROM projects p
  WHERE p.client_id = ANY(p_client_ids)
  GROUP BY p.client_id;
$$;

GRANT EXECUTE ON FUNCTION get_project_counts_for_clients(UUID[]) TO authenticated;

-- ============================================
-- CLEANUP: Remove duplicate inbox indexes
-- ============================================

DROP INDEX IF EXISTS idx_inbox_items_created_at;
DROP INDEX IF EXISTS idx_inbox_items_is_read;
