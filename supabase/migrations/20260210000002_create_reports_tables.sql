-- ============================================
-- Weekly Reports Module (Single-Project Model)
-- Migration: 20260210000002_create_reports_tables
-- ============================================
-- Creates tables for the weekly reports feature:
-- reports (with flat project fields), report_risks, report_highlights
-- Adds source_report_id to tasks table for action items

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE report_period_type AS ENUM ('weekly', 'monthly', 'custom');
CREATE TYPE report_project_status AS ENUM ('on_track', 'behind', 'at_risk', 'halted', 'completed');
CREATE TYPE client_satisfaction AS ENUM ('satisfied', 'neutral', 'dissatisfied');
CREATE TYPE risk_type AS ENUM ('blocker', 'risk');
CREATE TYPE risk_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE risk_status AS ENUM ('open', 'mitigated', 'resolved');
CREATE TYPE report_highlight_type AS ENUM ('highlight', 'decision');

-- ============================================
-- TABLES
-- ============================================

-- Reports (main report record with flat project fields)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  title TEXT NOT NULL,
  period_type report_period_type NOT NULL DEFAULT 'weekly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  status report_project_status NOT NULL DEFAULT 'on_track',
  previous_status report_project_status,
  client_satisfaction client_satisfaction NOT NULL DEFAULT 'satisfied',
  previous_satisfaction client_satisfaction,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  previous_progress INTEGER,
  narrative TEXT,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_in_progress INTEGER NOT NULL DEFAULT 0,
  tasks_overdue INTEGER NOT NULL DEFAULT 0,
  financial_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Report Risks (blockers and future risks)
CREATE TABLE report_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports ON DELETE CASCADE,
  type risk_type NOT NULL DEFAULT 'risk',
  description TEXT NOT NULL,
  severity risk_severity NOT NULL DEFAULT 'medium',
  status risk_status NOT NULL DEFAULT 'open',
  mitigation_notes TEXT,
  originated_report_id UUID REFERENCES reports ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Report Highlights (highlights and decisions)
CREATE TABLE report_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports ON DELETE CASCADE,
  type report_highlight_type NOT NULL DEFAULT 'highlight',
  description TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL
);

-- Add source_report_id to tasks table for action items
ALTER TABLE tasks ADD COLUMN source_report_id UUID REFERENCES reports ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================

-- Reports
CREATE INDEX idx_reports_org ON reports(organization_id);
CREATE INDEX idx_reports_created_by ON reports(created_by);
CREATE INDEX idx_reports_period ON reports(period_start, period_end);
CREATE INDEX idx_reports_org_period ON reports(organization_id, period_start DESC);
CREATE INDEX idx_reports_project ON reports(project_id) WHERE project_id IS NOT NULL;

-- Report Risks
CREATE INDEX idx_report_risks_report ON report_risks(report_id);
CREATE INDEX idx_report_risks_status ON report_risks(status);
CREATE INDEX idx_report_risks_originated ON report_risks(originated_report_id);

-- Report Highlights
CREATE INDEX idx_report_highlights_report ON report_highlights(report_id);

-- Tasks source report
CREATE INDEX idx_tasks_source_report ON tasks(source_report_id) WHERE source_report_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_highlights ENABLE ROW LEVEL SECURITY;

-- Reports: any org member can CRUD
CREATE POLICY "reports_select" ON reports
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "reports_update" ON reports
  FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "reports_delete" ON reports
  FOR DELETE USING (is_org_member(organization_id));

-- Report Risks: access via report's org membership
CREATE POLICY "report_risks_select" ON report_risks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_risks.report_id AND is_org_member(reports.organization_id))
  );

CREATE POLICY "report_risks_insert" ON report_risks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_risks.report_id AND is_org_member(reports.organization_id))
  );

CREATE POLICY "report_risks_update" ON report_risks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_risks.report_id AND is_org_member(reports.organization_id))
  );

CREATE POLICY "report_risks_delete" ON report_risks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_risks.report_id AND is_org_member(reports.organization_id))
  );

-- Report Highlights: access via report's org membership
CREATE POLICY "report_highlights_select" ON report_highlights
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_highlights.report_id AND is_org_member(reports.organization_id))
  );

CREATE POLICY "report_highlights_insert" ON report_highlights
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_highlights.report_id AND is_org_member(reports.organization_id))
  );

CREATE POLICY "report_highlights_update" ON report_highlights
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_highlights.report_id AND is_org_member(reports.organization_id))
  );

CREATE POLICY "report_highlights_delete" ON report_highlights
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM reports WHERE reports.id = report_highlights.report_id AND is_org_member(reports.organization_id))
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on reports
CREATE TRIGGER set_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
