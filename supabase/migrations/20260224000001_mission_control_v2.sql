-- Mission Control v2 — 2026-02-24
-- Apply via Supabase Dashboard → SQL Editor

-- ── Migration 1: Extend agents table ────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS session_key TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS current_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- ── Migration 2: Task messages (agent-to-agent comments) ────────────
CREATE TABLE IF NOT EXISTS task_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE task_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_messages_org" ON task_messages FOR ALL USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;

-- ── Migration 3: Agent documents (deliverables) ─────────────────────
CREATE TABLE IF NOT EXISTS agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  doc_type TEXT DEFAULT 'deliverable' CHECK (doc_type IN ('deliverable', 'research', 'protocol', 'draft', 'report')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_documents_org" ON agent_documents FOR ALL USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
ALTER PUBLICATION supabase_realtime ADD TABLE agent_documents;

-- ── Migration 4: Agent notifications (@mentions) ────────────────────
CREATE TABLE IF NOT EXISTS agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mentioned_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  message_id UUID REFERENCES task_messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_notifications_org" ON agent_notifications FOR ALL USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
ALTER PUBLICATION supabase_realtime ADD TABLE agent_notifications;

-- ── Migration 5: Seed session_key for all 24 agents ─────────────────
UPDATE agents SET session_key = 'agent:main:main' WHERE name = 'Ziko' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:nabil:main' WHERE name = 'Nabil' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:tech-lead:main' WHERE name = 'Omar' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:marketing-lead:main' WHERE name = 'Karim' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:design-lead:main' WHERE name = 'Design Lead' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:product-analyst:main' WHERE name = 'Product Analyst' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:researcher:main' WHERE name = 'Researcher' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:frontend:main' WHERE name = 'Sara' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:backend:main' WHERE name = 'Mostafa' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:backend-senior:main' WHERE name = 'Ali' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:fullstack:main' WHERE name = 'Yasser' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:qa:main' WHERE name = 'Hady' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:ui-designer:main' WHERE name = 'Farah' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:devops:main' WHERE name = 'Bassem' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:design-agent:main' WHERE name = 'Design Agent' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:seo:main' WHERE name = 'Sami' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:content:main' WHERE name = 'Maya' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:social:main' WHERE name = 'Amir' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:outreach:main' WHERE name = 'Rami' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:cro:main' WHERE name = 'Tarek' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:ads:main' WHERE name = 'Mariam' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:email-marketing:main' WHERE name = 'Nour' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:copywriter:main' WHERE name = 'Salma' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
UPDATE agents SET session_key = 'agent:analytics:main' WHERE name = 'Ziad' AND organization_id = '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
