-- ============================================
-- PMS Remaining Performance & Security Fixes
-- Migration: 20260130000001_remaining_perf_security_fixes
-- ============================================
-- Fixes:
-- 1. Function search_path security (update_updated_at_column)
-- 2. Missing foreign key indexes (7 tables)
-- ============================================

-- ============================================
-- 1. FIX FUNCTION SEARCH_PATH
-- ============================================
-- Note: This was previously fixed but overwritten by organization_tags_labels migration

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. ADD MISSING FOREIGN KEY INDEXES
-- ============================================
-- These improve JOIN and DELETE performance

-- clients.owner_id
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);

-- invitations.invited_by_id
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by_id ON invitations(invited_by_id);

-- invitations.organization_id (using existing index name pattern)
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);

-- project_files.added_by_id
CREATE INDEX IF NOT EXISTS idx_project_files_added_by_id ON project_files(added_by_id);

-- project_notes.added_by_id
CREATE INDEX IF NOT EXISTS idx_project_notes_added_by_id ON project_notes(added_by_id);

-- projects.team_id (using existing index name pattern from schema)
-- Note: idx_projects_team already exists, this is a safeguard
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);

-- teams.organization_id (using existing index name pattern from schema)
-- Note: idx_teams_org already exists, this is a safeguard
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);

-- ============================================
-- NOTES
-- ============================================
-- Leaked password protection must be enabled in Supabase Dashboard:
-- Authentication > Attack Protection > Enable "Leaked Password Protection"
-- See: https://supabase.com/docs/guides/auth/password-security
