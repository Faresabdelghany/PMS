-- ============================================
-- Custom Workflow Statuses
-- Migration: 20260130000003_workflow_statuses
-- ============================================

-- Enum for workflow status category
CREATE TYPE workflow_category AS ENUM ('unstarted', 'started', 'finished', 'canceled');

-- Enum for entity type the status applies to
CREATE TYPE workflow_entity_type AS ENUM ('task', 'project', 'workstream');

-- Workflow statuses table
CREATE TABLE workflow_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  entity_type workflow_entity_type NOT NULL,
  category workflow_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, entity_type, name)
);

-- Index for common queries
CREATE INDEX idx_workflow_statuses_org ON workflow_statuses(organization_id);
CREATE INDEX idx_workflow_statuses_entity ON workflow_statuses(organization_id, entity_type);

-- Trigger for updated_at
CREATE TRIGGER update_workflow_statuses_updated_at
  BEFORE UPDATE ON workflow_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE workflow_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workflow statuses"
  ON workflow_statuses FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Org admins can create workflow statuses"
  ON workflow_statuses FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Org admins can update workflow statuses"
  ON workflow_statuses FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Org admins can delete workflow statuses"
  ON workflow_statuses FOR DELETE
  USING (is_org_admin(organization_id) AND is_locked = false);

-- Insert default statuses function (call when org is created)
CREATE OR REPLACE FUNCTION create_default_workflow_statuses(org_id UUID)
RETURNS void AS $$
BEGIN
  -- Default task statuses
  INSERT INTO workflow_statuses (organization_id, entity_type, category, name, description, is_default, is_locked, sort_order) VALUES
    (org_id, 'task', 'unstarted', 'To-do', 'Tasks that are not started yet', true, true, 0),
    (org_id, 'task', 'started', 'Doing', 'Tasks that are in progress', true, false, 1),
    (org_id, 'task', 'finished', 'Done', 'Tasks that are completed', true, true, 2);

  -- Default project statuses
  INSERT INTO workflow_statuses (organization_id, entity_type, category, name, description, is_default, is_locked, sort_order) VALUES
    (org_id, 'project', 'unstarted', 'Backlog', 'Projects not yet started', true, true, 0),
    (org_id, 'project', 'unstarted', 'Planned', 'Projects planned to start', true, false, 1),
    (org_id, 'project', 'started', 'Active', 'Projects currently in progress', true, false, 2),
    (org_id, 'project', 'finished', 'Completed', 'Projects that are done', true, true, 3),
    (org_id, 'project', 'canceled', 'Cancelled', 'Projects that were cancelled', true, true, 4);

  -- Default workstream statuses
  INSERT INTO workflow_statuses (organization_id, entity_type, category, name, description, is_default, is_locked, sort_order) VALUES
    (org_id, 'workstream', 'unstarted', 'Planned', 'Workstreams not yet started', true, true, 0),
    (org_id, 'workstream', 'started', 'Active', 'Workstreams in progress', true, false, 1),
    (org_id, 'workstream', 'finished', 'Completed', 'Workstreams that are done', true, true, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
