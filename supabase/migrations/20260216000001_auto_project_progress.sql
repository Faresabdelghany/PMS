-- Auto-calculate project progress from task completion ratio.
-- Updates projects.progress whenever tasks are inserted, updated, or deleted.

CREATE OR REPLACE FUNCTION recalculate_project_progress(target_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INT;
  done  INT;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'done')
    INTO total, done
    FROM tasks
   WHERE project_id = target_project_id;

  UPDATE projects
     SET progress = CASE
           WHEN total = 0 THEN 0
           ELSE ROUND(done::numeric / total * 100)
         END
   WHERE id = target_project_id;
END;
$$;

-- Trigger function for INSERT / DELETE (single project_id)
CREATE OR REPLACE FUNCTION trigger_recalc_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_project_progress(OLD.project_id);
  ELSE
    PERFORM recalculate_project_progress(NEW.project_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger function for UPDATE (handles project_id change)
CREATE OR REPLACE FUNCTION trigger_recalc_project_progress_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalculate_project_progress(NEW.project_id);
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    PERFORM recalculate_project_progress(OLD.project_id);
  END IF;
  RETURN NULL;
END;
$$;

-- AFTER INSERT
CREATE TRIGGER trg_tasks_insert_recalc_progress
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_project_progress();

-- AFTER UPDATE of status or project_id
CREATE TRIGGER trg_tasks_update_recalc_progress
  AFTER UPDATE OF status, project_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_project_progress_on_update();

-- AFTER DELETE
CREATE TRIGGER trg_tasks_delete_recalc_progress
  AFTER DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_project_progress();

-- Backfill: recalculate progress for all existing projects
DO $$
DECLARE
  proj RECORD;
BEGIN
  FOR proj IN SELECT id FROM projects LOOP
    PERFORM recalculate_project_progress(proj.id);
  END LOOP;
END;
$$;
