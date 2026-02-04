-- Additional performance indexes for INP optimization
-- Targets the /projects/[id] page which currently has 280ms INP

-- Optimize task queries by workstream (used heavily in WorkstreamTab)
CREATE INDEX IF NOT EXISTS idx_tasks_workstream_status_order
ON tasks(workstream_id, status, "order")
WHERE workstream_id IS NOT NULL;

-- Optimize task queries without workstream (unassigned tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_no_workstream_project
ON tasks(project_id, status, created_at DESC)
WHERE workstream_id IS NULL;

-- Optimize task comments queries (task detail panel)
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
ON task_comments(task_id, created_at DESC);

-- Optimize task comment reactions
CREATE INDEX IF NOT EXISTS idx_task_comment_reactions_comment
ON task_comment_reactions(comment_id, user_id);

-- Optimize task comment attachments
CREATE INDEX IF NOT EXISTS idx_task_comment_attachments_comment
ON task_comment_attachments(comment_id, created_at DESC);

-- Optimize task activities timeline
CREATE INDEX IF NOT EXISTS idx_task_activities_task_created
ON task_activities(task_id, created_at DESC);

-- Optimize organization tags lookup (used in task forms)
CREATE INDEX IF NOT EXISTS idx_org_tags_org_name
ON organization_tags(organization_id, name);

-- Optimize project labels lookup
CREATE INDEX IF NOT EXISTS idx_org_labels_org_category
ON organization_labels(organization_id, category);

-- Optimize chat conversations by user
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
ON chat_conversations(user_id, updated_at DESC);

-- Optimize chat messages by conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
ON chat_messages(conversation_id, created_at ASC);

-- Composite index for task filtering (status + priority + assignee)
CREATE INDEX IF NOT EXISTS idx_tasks_project_filters
ON tasks(project_id, status, priority, assignee_id)
WHERE status != 'done';

-- Index for overdue tasks
CREATE INDEX IF NOT EXISTS idx_tasks_overdue
ON tasks(project_id, due_date, status)
WHERE due_date IS NOT NULL AND status != 'done';

-- Index for task search by name (trigram for full-text search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tasks_name_trgm
ON tasks USING gin(name gin_trgm_ops);

-- Index for project search by name
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
ON projects USING gin(name gin_trgm_ops);

-- Index for client search by name
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
ON clients USING gin(name gin_trgm_ops);

-- Analyze tables to update statistics for query planner
ANALYZE tasks;
ANALYZE workstreams;
ANALYZE projects;
ANALYZE task_comments;
ANALYZE task_activities;
ANALYZE organization_tags;
