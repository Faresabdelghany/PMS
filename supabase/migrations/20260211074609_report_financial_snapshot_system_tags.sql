-- ============================================
-- Migration: Report Financial Snapshot & System Tags
-- ============================================

-- 1. Add is_system flag to organization_tags
ALTER TABLE organization_tags
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- 2. Add financial snapshot columns to reports
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS financial_total_value NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_paid_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_invoiced_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_unpaid_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_currency TEXT DEFAULT 'USD';

-- 3. Add source_report_id to tasks (links action items to reports)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_report_id UUID REFERENCES reports(id) ON DELETE SET NULL;

-- 4. Create trigger function to seed system tags on org creation
CREATE OR REPLACE FUNCTION seed_system_tags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_tags (organization_id, name, description, color, is_system)
  VALUES (NEW.id, 'Action Item', 'System tag for report action items', '#7C3AED', true);
  RETURN NEW;
END;
$$;

-- 5. Attach trigger to organizations table
DROP TRIGGER IF EXISTS seed_system_tags_on_org_create ON organizations;
CREATE TRIGGER seed_system_tags_on_org_create
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_system_tags();

-- 6. Seed "Action Item" system tag for all existing organizations that don't have it
INSERT INTO organization_tags (organization_id, name, description, color, is_system)
SELECT o.id, 'Action Item', 'System tag for report action items', '#7C3AED', true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM organization_tags t
  WHERE t.organization_id = o.id AND t.name = 'Action Item' AND t.is_system = true
);

-- 7. Migrate existing tasks with tag = 'report-action' to 'Action Item'
UPDATE tasks SET tag = 'Action Item' WHERE tag = 'report-action';
