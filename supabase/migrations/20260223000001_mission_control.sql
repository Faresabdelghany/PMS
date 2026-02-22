-- ============================================
-- Mission Control Integration
-- Migration: mission_control
-- Date: 2026-02-23
-- ============================================

-- ============================================
-- PATCH AGENTS TABLE (add missing columns)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='model') THEN
    ALTER TABLE agents ADD COLUMN model TEXT;
  END IF;
END $$;

-- squad, status, last_active_at, description, prompt already exist from agents_system migration

-- ============================================
-- APPROVALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decision_reason TEXT,
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_org ON approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_agent ON approvals(agent_id);
CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at DESC);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "approvals_select" ON approvals FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "approvals_insert" ON approvals FOR INSERT
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "approvals_update" ON approvals FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "approvals_delete" ON approvals FOR DELETE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ============================================
-- GATEWAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT 'http://localhost:18789',
  status TEXT DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'unknown')),
  last_seen_at TIMESTAMPTZ,
  workspace_root TEXT,
  auth_mode TEXT DEFAULT 'none'
    CHECK (auth_mode IN ('none', 'token', 'basic')),
  auth_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gateways_org ON gateways(org_id);
CREATE INDEX IF NOT EXISTS idx_gateways_status ON gateways(status);

ALTER TABLE gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "gateways_select" ON gateways FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "gateways_insert" ON gateways FOR INSERT
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "gateways_update" ON gateways FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "gateways_delete" ON gateways FOR DELETE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ============================================
-- SKILLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  version TEXT,
  author TEXT,
  installed BOOLEAN DEFAULT false NOT NULL,
  enabled BOOLEAN DEFAULT true NOT NULL,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_org ON skills(org_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_installed ON skills(installed);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "skills_select" ON skills FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "skills_insert" ON skills FOR INSERT
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "skills_update" ON skills FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "skills_delete" ON skills FOR DELETE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ============================================
-- BOARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  gateway_id UUID REFERENCES gateways(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_boards_org ON boards(org_id);
CREATE INDEX IF NOT EXISTS idx_boards_gateway ON boards(gateway_id);
CREATE INDEX IF NOT EXISTS idx_boards_agent ON boards(agent_id);
CREATE INDEX IF NOT EXISTS idx_boards_status ON boards(status);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "boards_select" ON boards FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "boards_insert" ON boards FOR INSERT
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "boards_update" ON boards FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "boards_delete" ON boards FOR DELETE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ============================================
-- TAGS TABLE (mission control specific)
-- ============================================
CREATE TABLE IF NOT EXISTS mc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mc_tags_org ON mc_tags(org_id);

ALTER TABLE mc_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "mc_tags_select" ON mc_tags FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "mc_tags_insert" ON mc_tags FOR INSERT
  WITH CHECK (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "mc_tags_update" ON mc_tags FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "mc_tags_delete" ON mc_tags FOR DELETE
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_approvals_updated_at') THEN
    CREATE TRIGGER update_approvals_updated_at
      BEFORE UPDATE ON approvals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gateways_updated_at') THEN
    CREATE TRIGGER update_gateways_updated_at
      BEFORE UPDATE ON gateways
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_skills_updated_at') THEN
    CREATE TRIGGER update_skills_updated_at
      BEFORE UPDATE ON skills
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_boards_updated_at') THEN
    CREATE TRIGGER update_boards_updated_at
      BEFORE UPDATE ON boards
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mc_tags_updated_at') THEN
    CREATE TRIGGER update_mc_tags_updated_at
      BEFORE UPDATE ON mc_tags
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
