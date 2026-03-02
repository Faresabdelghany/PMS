-- Fix tasks RLS policies to allow org admins (consistent with project policies)
-- Root cause: org admins couldn't create/update/delete tasks in projects they
-- weren't explicitly added to as project_members, causing RLS violations.

-- Drop existing task policies
DROP POLICY IF EXISTS "Project members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Project members can update tasks" ON tasks;
DROP POLICY IF EXISTS "Project members can delete tasks" ON tasks;

-- Recreate with org admin fallback
CREATE POLICY "Project members can create tasks" ON tasks FOR INSERT
  WITH CHECK (
    is_project_member(project_id)
    OR is_org_admin(get_project_org_id(project_id))
  );

CREATE POLICY "Project members can update tasks" ON tasks FOR UPDATE
  USING (
    is_project_member(project_id)
    OR is_org_admin(get_project_org_id(project_id))
  )
  WITH CHECK (
    is_project_member(project_id)
    OR is_org_admin(get_project_org_id(project_id))
  );

CREATE POLICY "Project members can delete tasks" ON tasks FOR DELETE
  USING (
    is_project_member(project_id)
    OR is_org_admin(get_project_org_id(project_id))
  );

-- Backfill: add org admins as owners of projects that have no owner
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, om.user_id, 'owner'
FROM projects p
JOIN organization_members om ON om.organization_id = p.organization_id AND om.role = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = om.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM project_members pm2 WHERE pm2.project_id = p.id AND pm2.role = 'owner'
)
ON CONFLICT DO NOTHING;
