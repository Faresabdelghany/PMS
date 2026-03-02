-- Mission Control Live Ops — Constraint Fixes
-- Fixes: non-negative checks, model_update command type, agent_messages insert policy

-- -------------------------------------------------------------------
-- 1. Non-negative CHECK constraints for analytics columns
-- -------------------------------------------------------------------

-- token_usage_logs
ALTER TABLE token_usage_logs
  ADD CONSTRAINT chk_token_usage_input_nonneg CHECK (input_tokens >= 0),
  ADD CONSTRAINT chk_token_usage_output_nonneg CHECK (output_tokens >= 0),
  ADD CONSTRAINT chk_token_usage_cost_nonneg CHECK (cost_usd >= 0);

-- agent_sessions (columns added in previous migration)
ALTER TABLE agent_sessions
  ADD CONSTRAINT chk_sessions_input_nonneg CHECK (input_tokens >= 0),
  ADD CONSTRAINT chk_sessions_output_nonneg CHECK (output_tokens >= 0);

-- -------------------------------------------------------------------
-- 2. Add 'model_update' to agent_commands command_type CHECK
-- -------------------------------------------------------------------

ALTER TABLE agent_commands
  DROP CONSTRAINT IF EXISTS agent_commands_command_type_check;

ALTER TABLE agent_commands
  ADD CONSTRAINT agent_commands_command_type_check
  CHECK (command_type IN ('run_task', 'ping', 'pause', 'resume', 'cancel', 'wake', 'message', 'model_update'));

-- -------------------------------------------------------------------
-- 3. Tighten agent_messages INSERT policy to prevent impersonation
-- -------------------------------------------------------------------

DROP POLICY IF EXISTS "agent_messages_insert" ON agent_messages;

CREATE POLICY "agent_messages_insert" ON agent_messages
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    AND (from_user_id IS NULL OR from_user_id = auth.uid())
  );
