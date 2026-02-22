-- ============================================
-- Agent Management System
-- Migration: agents_system
-- ============================================

-- Agent type enum
CREATE TYPE agent_type AS ENUM ('supreme', 'lead', 'specialist', 'integration');

-- Agent status enum  
CREATE TYPE agent_status AS ENUM ('online', 'busy', 'offline', 'idle');

-- Squad enum
CREATE TYPE agent_squad AS ENUM ('engineering', 'marketing', 'all');

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  agent_type agent_type NOT NULL DEFAULT 'specialist',
  squad agent_squad NOT NULL DEFAULT 'engineering',
  status agent_status NOT NULL DEFAULT 'offline',
  
  -- AI Configuration
  ai_provider TEXT,
  ai_model TEXT,
  ai_api_key_encrypted TEXT,
  system_prompt TEXT,
  
  -- Capabilities & Skills
  capabilities TEXT[] DEFAULT '{}',
  skills JSONB DEFAULT '[]',
  
  -- Hierarchy
  reports_to UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Activity
  last_active_at TIMESTAMPTZ,
  performance_notes TEXT,
  
  -- Metadata
  avatar_url TEXT,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- AGENT ACTIVITY LOG
-- ============================================
CREATE TABLE agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'task_completed', 'task_assigned', 'message', 'status_change', 'model_change', 'error'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- AI MODELS REGISTRY
-- ============================================
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'anthropic', 'google', 'openai', 'custom'
  model_id TEXT NOT NULL, -- 'claude-opus-4-6', 'gemini-2.5-flash', etc.
  display_name TEXT NOT NULL,
  api_key_encrypted TEXT,
  base_url TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  cost_input DECIMAL(10,4), -- per 1M tokens
  cost_output DECIMAL(10,4),
  context_window INTEGER,
  max_tokens INTEGER,
  supports_vision BOOLEAN DEFAULT false,
  supports_reasoning BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, provider, model_id)
);

-- ============================================
-- AGENT TASK ASSIGNMENTS (extend tasks)
-- ============================================
-- Add agent_id to tasks table
ALTER TABLE tasks ADD COLUMN agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- ============================================
-- AGENT DECISIONS LOG
-- ============================================
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  title TEXT NOT NULL,
  question TEXT,
  decision_summary TEXT NOT NULL,
  consulted_agents UUID[] DEFAULT '{}',
  decided_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_squad ON agents(squad);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_reports_to ON agents(reports_to);
CREATE INDEX idx_agent_activities_agent ON agent_activities(agent_id);
CREATE INDEX idx_agent_activities_org ON agent_activities(organization_id);
CREATE INDEX idx_agent_activities_created ON agent_activities(created_at DESC);
CREATE INDEX idx_ai_models_org ON ai_models(organization_id);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_agent_decisions_org ON agent_decisions(organization_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

-- Agents: org members can read, admins can write
CREATE POLICY "agents_select" ON agents FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "agents_insert" ON agents FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "agents_update" ON agents FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "agents_delete" ON agents FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Agent activities: org members can read/write
CREATE POLICY "agent_activities_select" ON agent_activities FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "agent_activities_insert" ON agent_activities FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- AI Models: org members can read, admins can write
CREATE POLICY "ai_models_select" ON ai_models FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "ai_models_insert" ON ai_models FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "ai_models_update" ON ai_models FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "ai_models_delete" ON ai_models FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Agent decisions: org members can read/write
CREATE POLICY "agent_decisions_select" ON agent_decisions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "agent_decisions_insert" ON agent_decisions FOR INSERT
  WITH CHECK (organization_id IN (
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
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON ai_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
