-- Performance indexes for Cache Components optimization
-- These indexes optimize the most common queries used by cached functions

-- Optimize inbox/activity queries (user-specific, time-ordered)
CREATE INDEX IF NOT EXISTS idx_inbox_items_user_created
ON inbox_items(user_id, created_at DESC);

-- Optimize task queries by project and status
CREATE INDEX IF NOT EXISTS idx_tasks_project_status
ON tasks(project_id, status, created_at DESC);

-- Optimize task queries by assignee (for "My Tasks" page)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status
ON tasks(assignee_id, status, due_date);

-- Optimize project queries by organization
CREATE INDEX IF NOT EXISTS idx_projects_org_status
ON projects(organization_id, status, updated_at DESC);

-- Optimize client queries by organization
CREATE INDEX IF NOT EXISTS idx_clients_org_name
ON clients(organization_id, name);

-- Optimize workstream queries by project
CREATE INDEX IF NOT EXISTS idx_workstreams_project_order
ON workstreams(project_id, "order");

-- Optimize project members lookup
CREATE INDEX IF NOT EXISTS idx_project_members_project
ON project_members(project_id, user_id);

-- Optimize organization members lookup
CREATE INDEX IF NOT EXISTS idx_org_members_org
ON organization_members(organization_id, user_id);

-- Optimize project files lookup
CREATE INDEX IF NOT EXISTS idx_project_files_project
ON project_files(project_id, created_at DESC);

-- Optimize project notes lookup
CREATE INDEX IF NOT EXISTS idx_project_notes_project
ON project_notes(project_id, created_at DESC);
