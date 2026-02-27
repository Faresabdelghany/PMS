-- Extend agent_events event_type constraint with task orchestration events
ALTER TABLE agent_events DROP CONSTRAINT IF EXISTS agent_events_event_type_check;

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
    'subtask_create'
  ));
