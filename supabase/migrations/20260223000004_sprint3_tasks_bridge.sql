-- ============================================
-- Sprint 3: Tasks + Agent Bridge
-- Migration: sprint3_tasks_bridge
-- ============================================

-- ── Extend tasks table with agent assignment ──
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'user' CHECK (task_type IN ('user', 'agent', 'recurring'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dispatch_status TEXT DEFAULT 'pending' CHECK (dispatch_status IN ('pending', 'dispatched', 'running', 'completed', 'failed'));

-- ── Agent Commands table (PMS → OpenClaw) ──
CREATE TABLE IF NOT EXISTS agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('run_task', 'ping', 'pause', 'resume', 'cancel')),
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'picked_up', 'completed', 'failed')),
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_commands_select" ON agent_commands
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_commands_insert" ON agent_commands
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_commands_update" ON agent_commands
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ── Agent Events table (OpenClaw → PMS) ──
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'task_started', 'task_progress', 'task_completed', 'task_failed',
    'agent_message', 'approval_request', 'status_change', 'heartbeat'
  )),
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_events_select" ON agent_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (OpenClaw uses service role key)
CREATE POLICY "agent_events_insert" ON agent_events
  FOR INSERT WITH CHECK (true);

-- ── Enable Realtime on new tables (tasks already in publication) ──
ALTER PUBLICATION supabase_realtime ADD TABLE agent_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;

-- ── Indexes for performance ──
CREATE INDEX IF NOT EXISTS idx_agent_commands_agent_id ON agent_commands(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commands_task_id ON agent_commands(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_commands_status ON agent_commands(status);
CREATE INDEX IF NOT EXISTS idx_agent_commands_org_id ON agent_commands(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id ON agent_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_task_id ON agent_events(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_org_id ON agent_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent_id ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_dispatch_status ON tasks(dispatch_status);
