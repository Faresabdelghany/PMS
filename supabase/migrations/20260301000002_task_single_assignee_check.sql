-- Enforce mutual exclusivity between human assignee and agent assignee.
-- Safe for repeated runs: only add when not already present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tasks
    WHERE assignee_id IS NOT NULL
      AND assigned_agent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot add chk_single_assignee: found tasks with both assignee_id and assigned_agent_id set';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_single_assignee'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT chk_single_assignee
      CHECK (NOT (assignee_id IS NOT NULL AND assigned_agent_id IS NOT NULL));
  END IF;
END $$;
