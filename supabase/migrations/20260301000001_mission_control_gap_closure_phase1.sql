-- Mission Control Gap Closure - Phase 1 MVP
-- Scope: live ops sessions, scheduled runs, retry basics, DoD warn engine, heartbeat dependency

-- -------------------------------------------------------------------
-- Shared enums
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mc_session_status') THEN
    CREATE TYPE mc_session_status AS ENUM ('running', 'blocked', 'waiting', 'completed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mc_run_status') THEN
    CREATE TYPE mc_run_status AS ENUM ('success', 'failed', 'skipped', 'running', 'pending');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mc_policy_mode') THEN
    CREATE TYPE mc_policy_mode AS ENUM ('warn', 'block', 'auto-reopen');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mc_retry_outcome') THEN
    CREATE TYPE mc_retry_outcome AS ENUM ('retrying', 'succeeded', 'failed', 'escalated');
  END IF;
END $$;

-- -------------------------------------------------------------------
-- Heartbeat dependency fields on agents
-- -------------------------------------------------------------------
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS heartbeat_timeout_seconds INTEGER NOT NULL DEFAULT 90;

-- -------------------------------------------------------------------
-- Agent sessions (live ops)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status mc_session_status NOT NULL DEFAULT 'waiting',
  task_summary TEXT,
  queue_position INTEGER,
  blocker_reason TEXT,
  error_msg TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_org_status ON agent_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org_heartbeat ON agent_sessions(organization_id, heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_task ON agent_sessions(agent_id, task_id);

-- -------------------------------------------------------------------
-- Scheduled runs (calendar)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL DEFAULT 'agent_run',
  schedule_expr TEXT NOT NULL,
  last_status mc_run_status NOT NULL DEFAULT 'pending',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  run_duration_seconds INTEGER,
  run_log_url TEXT,
  paused BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_runs_org_next_run ON scheduled_runs(organization_id, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_org_status ON scheduled_runs(organization_id, last_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_agent ON scheduled_runs(agent_id);

-- -------------------------------------------------------------------
-- Retry policy + retry log (auto recovery basics)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retry_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'default',
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  backoff_seconds INTEGER NOT NULL DEFAULT 30 CHECK (backoff_seconds BETWEEN 1 AND 3600),
  escalation_channel TEXT NOT NULL DEFAULT 'telegram' CHECK (escalation_channel IN ('telegram')),
  escalation_target TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, task_type)
);

CREATE TABLE IF NOT EXISTS retry_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES retry_policies(id) ON DELETE SET NULL,
  agent_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  error TEXT,
  outcome mc_retry_outcome NOT NULL,
  next_retry_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retry_log_org_task_created ON retry_log(organization_id, task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retry_log_org_outcome ON retry_log(organization_id, outcome);

-- -------------------------------------------------------------------
-- DoD policies + check result audit (warn mode in P1)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS done_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_type TEXT,
  mode mc_policy_mode NOT NULL DEFAULT 'warn',
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_done_policies_org_project ON done_policies(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_done_policies_org_active ON done_policies(organization_id, active);

CREATE TABLE IF NOT EXISTS done_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES done_policies(id) ON DELETE SET NULL,
  check_name TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_done_check_results_task_created ON done_check_results(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_done_check_results_org_passed ON done_check_results(organization_id, passed);

-- -------------------------------------------------------------------
-- updated_at triggers
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
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_sessions_updated_at') THEN
    CREATE TRIGGER update_agent_sessions_updated_at
      BEFORE UPDATE ON agent_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scheduled_runs_updated_at') THEN
    CREATE TRIGGER update_scheduled_runs_updated_at
      BEFORE UPDATE ON scheduled_runs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_retry_policies_updated_at') THEN
    CREATE TRIGGER update_retry_policies_updated_at
      BEFORE UPDATE ON retry_policies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_done_policies_updated_at') THEN
    CREATE TRIGGER update_done_policies_updated_at
      BEFORE UPDATE ON done_policies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE retry_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retry_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE done_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE done_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_sessions_select" ON agent_sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_sessions_insert" ON agent_sessions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "agent_sessions_update" ON agent_sessions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_runs_select" ON scheduled_runs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_runs_insert" ON scheduled_runs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_runs_update" ON scheduled_runs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "retry_policies_select" ON retry_policies FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "retry_policies_insert" ON retry_policies FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "retry_policies_update" ON retry_policies FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "retry_log_select" ON retry_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "retry_log_insert" ON retry_log FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "done_policies_select" ON done_policies FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "done_policies_insert" ON done_policies FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "done_policies_update" ON done_policies FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "done_check_results_select" ON done_check_results FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "done_check_results_insert" ON done_check_results FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
