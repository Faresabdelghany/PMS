-- Task orchestration v1: subtasks + source tracking

-- Add parent_task_id for subtask hierarchy (max 1 level)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Add source tracking
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'agent', 'speckit', 'system'));

-- Index for subtask queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

-- Trigger: ensure parent and child share same project_id + max depth of 1
CREATE OR REPLACE FUNCTION check_subtask_project_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND project_id = NEW.project_id
    ) THEN
      RAISE EXCEPTION 'Subtask must belong to same project as parent task';
    END IF;

    IF EXISTS (
      SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND parent_task_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Only one level of subtask nesting is allowed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_subtask_project_id_trigger ON tasks;
CREATE TRIGGER check_subtask_project_id_trigger
  BEFORE INSERT OR UPDATE OF parent_task_id, project_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION check_subtask_project_id();
