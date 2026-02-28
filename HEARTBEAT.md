# Mission Control Heartbeat Protocol (Phase 1 MVP)

Shared dependency for Live Ops + retry/recovery:

- `interval`: every `30s`
- `timeout`: stale after `90s`
- `blocked threshold`: treat as blocked after `120s` without heartbeat or explicit fail event

Payload contract for `/api/agent-events`:

- `org_id` (required)
- `agent_id` (required for session tracking)
- `event_type` in `task_started | task_progress | task_completed | task_failed | heartbeat`
- `message` (required)
- `task_id` (optional but recommended)
- `payload` (optional metadata)

Session semantics:

- `task_started` / `task_progress` => `agent_sessions.status = running`
- `heartbeat` => `agent_sessions.status = waiting` (unless an active task event updates it)
- `task_failed` => `agent_sessions.status = blocked`, carries `error_msg` / `blocker_reason`
- `task_completed` => `agent_sessions.status = completed`

Phase 1 notes:

- Transport is polling (`/mission-control` refresh every 5s), no WebSocket
- Protocol constants live in `lib/mission-control/heartbeat-protocol.ts`
