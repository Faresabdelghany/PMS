-- Migration: Add workstream fields for enhanced functionality
-- Adds start_date, end_date, description, and tag to workstreams table

-- Add new columns to workstreams table
ALTER TABLE workstreams
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tag TEXT;

-- Create a function to validate workstream end_date against project end_date
CREATE OR REPLACE FUNCTION validate_workstream_dates()
RETURNS TRIGGER AS $$
DECLARE
  project_end DATE;
BEGIN
  -- Get the project's end_date
  SELECT end_date INTO project_end
  FROM projects
  WHERE id = NEW.project_id;

  -- Validate: workstream end_date cannot exceed project end_date
  IF NEW.end_date IS NOT NULL AND project_end IS NOT NULL THEN
    IF NEW.end_date > project_end THEN
      RAISE EXCEPTION 'Workstream end date (%) cannot be after project end date (%)',
        NEW.end_date, project_end;
    END IF;
  END IF;

  -- Validate: workstream start_date should not be after end_date
  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    IF NEW.start_date > NEW.end_date THEN
      RAISE EXCEPTION 'Workstream start date (%) cannot be after end date (%)',
        NEW.start_date, NEW.end_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate dates on insert and update
DROP TRIGGER IF EXISTS validate_workstream_dates_trigger ON workstreams;
CREATE TRIGGER validate_workstream_dates_trigger
  BEFORE INSERT OR UPDATE ON workstreams
  FOR EACH ROW
  EXECUTE FUNCTION validate_workstream_dates();

-- Add index for querying workstreams by date range
CREATE INDEX IF NOT EXISTS idx_workstreams_dates
  ON workstreams (project_id, start_date, end_date);

-- Comment on new columns
COMMENT ON COLUMN workstreams.start_date IS 'Optional start date for the workstream';
COMMENT ON COLUMN workstreams.end_date IS 'Optional end date - must not exceed project end_date';
COMMENT ON COLUMN workstreams.description IS 'Optional description of the workstream';
COMMENT ON COLUMN workstreams.tag IS 'Optional tag/category for the workstream';
