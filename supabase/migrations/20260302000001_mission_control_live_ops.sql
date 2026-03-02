-- Mission Control Live Ops Foundation
-- Creates foundational Mission Control operational tables and updates existing agent tables.

-- -------------------------------------------------------------------
-- New tables
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS token_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info'
    CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('agent', 'task', 'session', 'gateway', 'cost')),
  condition_field TEXT NOT NULL,
  condition_operator TEXT NOT NULL
    CHECK (condition_operator IN ('=', '!=', '>', '<', '>=', '<=', 'contains')),
  condition_value TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'notification'
    CHECK (action_type IN ('notification', 'webhook', 'email')),
  action_target TEXT,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT,
  participant_agent_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'status', 'handoff', 'task_update', 'system')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_agent_id IS NOT NULL OR from_user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES board_webhooks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------
-- Existing table updates
-- -------------------------------------------------------------------

ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER NOT NULL DEFAULT 0;

ALTER TABLE agent_commands
  DROP CONSTRAINT IF EXISTS agent_commands_command_type_check;

ALTER TABLE agent_commands
  ADD CONSTRAINT agent_commands_command_type_check
  CHECK (command_type IN ('run_task', 'ping', 'pause', 'resume', 'cancel', 'wake', 'message'));

ALTER TABLE agent_events
  DROP CONSTRAINT IF EXISTS agent_events_event_type_check;

ALTER TABLE agent_events
  ADD CONSTRAINT agent_events_event_type_check
  CHECK (event_type IN (
    'task_started',
    'task_progress',
    'task_completed',
    'task_failed',
    'agent_message',
    'approval_request',
    'status_change',
    'heartbeat',
    'task_create',
    'subtask_create',
    'log'
  ));

-- -------------------------------------------------------------------
-- updated_at trigger helper and triggers
-- -------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_alert_rules_updated_at') THEN
    CREATE TRIGGER update_alert_rules_updated_at
      BEFORE UPDATE ON alert_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_conversations_updated_at') THEN
    CREATE TRIGGER update_agent_conversations_updated_at
      BEFORE UPDATE ON agent_conversations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_token_usage_logs_org_created_at
  ON token_usage_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_org_agent
  ON token_usage_logs(organization_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_logs_org_created_at
  ON agent_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_org_agent
  ON agent_logs(organization_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_org_level
  ON agent_logs(organization_id, level);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org_created_at
  ON alert_rules(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_enabled
  ON alert_rules(organization_id, enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_entity_type
  ON alert_rules(organization_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_alert_history_org_created_at
  ON alert_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_created_at
  ON alert_history(rule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_org_created_at
  ON agent_conversations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_org_last_message_at
  ON agent_conversations(organization_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_messages_org_created_at
  ON agent_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created_at
  ON agent_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_created_at
  ON webhook_deliveries(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created_at
  ON webhook_deliveries(webhook_id, created_at DESC);

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------

ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_usage_logs_select" ON token_usage_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "token_usage_logs_insert" ON token_usage_logs
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_logs_select" ON agent_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_logs_insert" ON agent_logs
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_rules_select" ON alert_rules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_rules_insert" ON alert_rules
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_rules_update" ON alert_rules
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_history_select" ON alert_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "alert_history_insert" ON alert_history
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_conversations_select" ON agent_conversations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_conversations_insert" ON agent_conversations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_conversations_update" ON agent_conversations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_messages_select" ON agent_messages
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_messages_insert" ON agent_messages
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_deliveries_select" ON webhook_deliveries
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_deliveries_insert" ON webhook_deliveries
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------------
-- Realtime publication
-- -------------------------------------------------------------------

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.token_usage_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
