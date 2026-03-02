# Mission Control — Implementation Plan (Revised)

> **Date:** 2026-03-02
> **Status:** Approved for execution
> **Architecture:** Next.js 16 + Supabase + Vercel (NO FastAPI)
> **Reference:** Gap analysis from `docs/plans/mission-control-gap-prd.md`

---

## Architecture Principles

Before anything: this project runs on **Next.js 16 (App Router) + Supabase + Vercel**. Every decision must respect that.

| Principle | Rule |
|-----------|------|
| No separate backend | No FastAPI, no Express, no standalone Python service. All server logic lives in Next.js Server Actions (`lib/actions/`) and API Routes (`app/api/`). |
| Supabase is the database AND message bus | `agent_commands` + `agent_events` tables with Realtime subscriptions. No Redis, no custom event bus. |
| Client-side WebSocket only | The browser connects directly to the OpenClaw gateway. No server-side WS proxy (Vercel serverless can't hold persistent connections). |
| Extend, don't rebuild | 8+ agent tables, 15+ server actions, pooled realtime hooks, and the ingestion API already exist. Build on them. |
| Vercel Cron for scheduled work | Background jobs (heartbeat checks, alert evaluation, retention cleanup) use Vercel Cron Jobs (`/api/cron/*`), not worker loops. |
| Follow existing patterns | `getPageOrganization()` for page auth, `invalidateCache.*` for mutations, `usePooledRealtime()` for subscriptions, `PageHeader` for page layouts. |

---

## What Already Exists (DO NOT REBUILD)

### Database Tables (already migrated)

| Table | Migration | Has RLS | Has Realtime | Has Indexes |
|-------|-----------|---------|-------------|-------------|
| `agents` | `20260220000001` | Yes | Yes | Yes |
| `agent_activities` | `20260220000001` | Yes | No | Yes |
| `ai_models` | `20260220000001` | Yes | No | Yes |
| `agent_decisions` | `20260220000001` | Yes | No | Yes |
| `agent_commands` | `20260223000004` | Yes | Yes | Yes |
| `agent_events` | `20260223000004` | Yes | Yes | Yes |
| `approvals` | `20260223000001` | Yes | No | — |
| `gateways` | `20260223000001` | Yes | No | — |
| `skills` | `20260223000001` | Yes | No | — |
| `boards` + `board_groups` | `20260223000001/2` | Yes | No | — |
| `board_webhooks` | `20260223000002` | Yes | No | — |
| `custom_field_definitions` | `20260223000002` | Yes | No | — |
| `custom_field_values` | `20260223000002` | Yes | No | — |
| `mc_tags` | `20260223000001` | Yes | No | — |
| `task_messages` | `20260224000001` | Yes | Yes | — |
| `agent_documents` | `20260224000001` | Yes | Yes | — |
| `agent_notifications` | `20260224000001` | Yes | Yes | — |
| `agent_sessions` | `20260301000001` | Yes | No | Yes |
| `scheduled_runs` | `20260301000001` | Yes | No | Yes |
| `retry_policies` | `20260301000001` | Yes | No | — |
| `retry_log` | `20260301000001` | Yes | No | Yes |
| `done_policies` | `20260301000001` | Yes | No | Yes |
| `done_check_results` | `20260301000001` | Yes | No | Yes |
| `user_models` | `20260224000001` | Yes | No | — |
| `model_assignments` | `20260224000001` | Yes | No | — |

### Server Actions (already written)

| File | Key Functions |
|------|--------------|
| `lib/actions/agents.ts` | `getAgents()`, `getAgent()`, `createAgent()`, `updateAgent()`, `deleteAgent()`, `getAgentActivities()`, `getDashboardAgentStats()` |
| `lib/actions/agent-commands.ts` | `createAgentCommand()`, `pingAgent()`, `getAgentCommands()`, `cancelAgentCommand()` |
| `lib/actions/agent-events.ts` | `getAgentEvents()`, `getGatewayStatus()`, `createAgentEvent()` |
| `lib/actions/gateways.ts` | `getGateways()`, `createGateway()`, `checkGatewayHealth()` |
| `lib/actions/skills.ts` | `getSkills()`, `getMarketplaceSkills()`, `upsertSkill()`, `getCatalogForOrg()` |
| `lib/actions/user-models.ts` | `getUserModels()`, `createUserModel()`, `updateUserModel()`, `setDefaultModel()` |
| `lib/actions/model-assignments.ts` | `getModelAssignments()`, `upsertModelAssignment()` |
| `lib/actions/approvals.ts` | `getApprovals()`, `createApproval()`, `updateApproval()` |
| `lib/actions/boards.ts` | `getBoards()`, `createBoard()`, `updateBoard()`, `deleteBoard()` |
| `lib/actions/activity.ts` | `getActivityFeed()` |
| `lib/actions/memory.ts` | `getAgentMemoryCards()`, `getAgentEventHistory()` |

### API Routes (already built)

| Route | Purpose |
|-------|---------|
| `POST /api/agent-events` | OpenClaw webhook ingestion (366 lines, handles task creation, status updates, heartbeat, retry) |
| `GET /api/gateway` | Gateway health check |

### Frontend Infrastructure (already built)

| Component/Hook | Purpose |
|----------------|---------|
| `hooks/realtime-context.tsx` | Pooled Supabase Realtime subscriptions (490 lines) — `usePooledRealtime()`, `usePooledRealtimeMulti()` |
| `components/agents/AgentsTable.tsx` | Agent list table |
| `components/agents/AgentDetailPanel.tsx` | Agent detail sidebar |
| `components/agents/AgentNetworkClient.tsx` | Agent hierarchy network visualization |
| `components/agents/agent-activity-feed.tsx` | Agent activity timeline |
| `components/activity/activity-timeline.tsx` | Activity timeline visualization |
| `components/ui/page-header.tsx` | Standard page header (use on ALL new pages) |

### Environment Variables (already set)

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Set |
| `ENCRYPTION_KEY` | Set |
| `NEXT_PUBLIC_SENTRY_DSN` | Set |

---

## Phase 1 — Database + Gateway Connection (Week 1)

### 1.1 New Database Migration

Create ONE migration: `20260302000001_mission_control_live_ops.sql`

**New tables to create:**

```sql
-- Token usage tracking (for cost dashboard)
CREATE TABLE token_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent logs (for log viewer)
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert rules (for alert engine)
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('agent', 'task', 'session', 'gateway', 'cost')),
  condition_field TEXT NOT NULL,
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('=', '!=', '>', '<', '>=', '<=', 'contains')),
  condition_value TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'notification' CHECK (action_type IN ('notification', 'webhook', 'email')),
  action_target TEXT,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert history (triggered alerts log)
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent conversations (for inter-agent chat)
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT,
  participant_agent_ids UUID[] NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent messages (within conversations)
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'status', 'handoff', 'task_update', 'system')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook delivery tracking
CREATE TABLE webhook_deliveries (
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
```

**For each new table, add:**
- RLS policies (org-scoped SELECT/INSERT/UPDATE via `organization_members`)
- Indexes on `(organization_id, created_at DESC)`, `(organization_id, agent_id)` where applicable
- Realtime publication for `agent_messages`, `token_usage_logs`, and `agent_sessions`
- `updated_at` triggers where the column exists

**Modifications to existing tables:**
- Add `input_tokens` + `output_tokens` columns to `agent_sessions` for per-session token tracking

### 1.2 Environment Variables

Add to `.env.local` and Vercel:

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_GATEWAY_WS_URL` | Default OpenClaw gateway WebSocket URL | `ws://127.0.0.1:18789` |

Note: In production, this will come from the `gateways` table (each gateway stores its own URL). The env var is a fallback for local development.

### 1.3 Gateway WebSocket Hook

Create `hooks/use-gateway-websocket.ts`:

```
Purpose: Client-side WebSocket connection to OpenClaw gateway
Pattern: React hook with auto-reconnect, heartbeat, RTT tracking
```

**Responsibilities:**
- Connect to gateway URL (from `gateways` table or env var)
- OpenClaw frame protocol: `{ type: 'req'|'res'|'event', id?, method?, params?, result?, error? }`
- Ping/pong heartbeat every 30 seconds
- Track RTT (round-trip time) for latency display
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- 3 missed pongs = mark disconnected
- Expose: `{ isConnected, rtt, send, lastEvent, error, reconnect }`

**Does NOT replace Supabase Realtime** — this is an additional channel for direct gateway communication. Supabase Realtime continues to handle database change subscriptions.

### 1.4 Gateway Context Provider

Create `hooks/gateway-context.tsx`:

```
Purpose: React context that wraps the WebSocket hook and provides
         gateway state to all Mission Control components
```

**Provides:**
- `gatewayStatus`: 'connected' | 'disconnected' | 'reconnecting'
- `rtt`: number (milliseconds)
- `lastEventAt`: Date
- `sendCommand(agentId, command, payload)`: dispatch via WebSocket
- `onlineAgentCount`, `activeSessionCount`, `pendingCommandCount`

### 1.5 Status Bar Component

Create `components/mission-control/status-bar.tsx`:

**Shows (always visible in sidebar or header):**
- Gateway connection dot: green (connected) / yellow (reconnecting) / red (disconnected)
- RTT latency: "12ms" (green if <100ms, yellow if <500ms, red if >500ms)
- Agent counts: "18/24 online"
- Active sessions: "3 active"
- Last event: "2s ago"

**Placement:** Add to the dashboard sidebar or main layout, visible on all Mission Control pages.

---

## Phase 2 — Agent Controls + Sessions (Weeks 2-3)

### 2.1 Agent Control Buttons

**Location:** Agent detail page (`/agents/[agentId]`) + agent list quick actions

**Buttons to add:**

| Button | Action | Implementation |
|--------|--------|----------------|
| Ping | Send health check | `createAgentCommand(orgId, agentId, 'ping')` — already exists as `pingAgent()` |
| Wake | Send wake message | `createAgentCommand(orgId, agentId, 'wake', { message })` — add 'wake' to command_type CHECK |
| Spawn Session | Start new session with task | Insert into `agent_sessions` + `createAgentCommand(orgId, agentId, 'run_task', { taskId })` |
| Pause | Pause active session | `createAgentCommand(orgId, agentId, 'pause')` — already in CHECK |
| Resume | Resume paused session | `createAgentCommand(orgId, agentId, 'resume')` — already in CHECK |

**Bulk actions bar** (when multiple agents selected):
- Pause All Selected
- Resume All Selected
- Confirmation dialog before bulk operations

### 2.2 Sessions Page

**Route:** `app/(dashboard)/sessions/page.tsx`

**Server Actions** (new file: `lib/actions/sessions.ts`):
- `getSessions(orgId, filters?)` — list with agent joins, filter by status/agent/date
- `getSession(id)` — single session with agent + task details
- `createSession(orgId, agentId, taskId?, instructions?)` — create + dispatch run_task command
- `updateSessionStatus(id, status, metadata?)` — update status
- `terminateSession(id)` — set status to completed + dispatch cancel command

**UI Components:**
- `components/sessions/sessions-page-client.tsx` — main client component
- Session table: Agent (avatar+name), Task (title), Status (badge), Started (relative time), Duration, Tokens
- Filters: status dropdown, agent dropdown, date range
- Click row → open session detail panel

**Session Detail Panel** (slide-over):
- Header: agent avatar + name, task title, status badge
- Timeline: events for this session (query `agent_events` WHERE `session_id = ?`)
- Metrics: duration, tokens used, cost estimate
- Blocker section (if status = 'blocked'): show `blocker_reason`
- Error section (if `error_msg`): show error details
- Controls: Pause / Resume / Terminate buttons
- Live updates via `usePooledRealtime()` on `agent_sessions` table

### 2.3 Heartbeat System

**Vercel Cron Job:** `app/api/cron/check-heartbeats/route.ts`
- Schedule: every 1 minute (Vercel Cron minimum)
- Logic:
  1. Query all agents where `is_active = true`
  2. For each agent, check `last_active_at` against `heartbeat_timeout_seconds`
  3. If `now() - last_active_at > heartbeat_timeout_seconds` → update `status = 'offline'`
  4. Log status transitions to `agent_activities`
- Secured with `CRON_SECRET` env var (Vercel Cron standard)

**Agent health indicator** (update `AgentsTable.tsx`):
- Green pulsing dot: online + last heartbeat < 30s
- Green static dot: online + last heartbeat 30-60s
- Yellow dot: online + last heartbeat 60-90s (stale)
- Red dot: offline
- Spinner: busy (processing task)

**Heartbeat response enhancement** (update `POST /api/agent-events`):
When event_type = 'heartbeat':
1. Update `agents.last_active_at = now()`
2. Update `agents.status = 'online'` (if currently offline)
3. Check for pending work:
   - Assigned tasks with `dispatch_status = 'pending'`
   - Pending approvals for this agent
   - Unread notifications
4. Return work item count in response (for agent to pick up)

---

## Phase 3 — Observability (Weeks 3-4)

### 3.1 Log Viewer

**Route:** `app/(dashboard)/logs/page.tsx`

**Server Actions** (new file: `lib/actions/agent-logs.ts`):
- `getAgentLogs(orgId, filters?)` — paginated, filter by agent/level/date/search text
- `getAgentLogStats(orgId)` — counts by level for the last 24h

**Ingestion:** Update `POST /api/agent-events` to also insert into `agent_logs` when events include log data. Add a new event_type `'log'` to the CHECK constraint.

**UI:**
- Terminal-style display (monospace, dark background optional)
- Each row: `[timestamp] [agent-name] [LEVEL] message`
- Color coding: error=red, warn=amber, info=default, debug=muted
- Filters bar: agent multi-select, level checkboxes, date range, search input
- Auto-scroll toggle (on by default, pause when user scrolls up)
- "Export CSV" button for filtered results
- Live updates via `usePooledRealtime()` on `agent_logs` table
- Pagination: load 100 at a time, "Load more" button

### 3.2 Token Usage & Cost Dashboard

**Route:** `app/(dashboard)/costs/page.tsx`

**Server Actions** (new file: `lib/actions/token-usage.ts`):
- `getTokenUsageSummary(orgId, range)` — total tokens + cost for 1d/7d/30d
- `getTokenUsageByAgent(orgId, range)` — breakdown per agent
- `getTokenUsageByModel(orgId, range)` — breakdown per model
- `getTokenUsageTrend(orgId, range, interval)` — time series (daily/weekly)
- `getTopExpensiveTasks(orgId, range, limit)` — highest cost tasks

**Ingestion:** Update `POST /api/agent-events` to extract token counts from event payloads and insert into `token_usage_logs`. Look for `payload.usage.input_tokens`, `payload.usage.output_tokens`, or similar fields.

**Cost calculation:**
- Use `ai_models.cost_input` / `ai_models.cost_output` (per 1M tokens) from existing table
- Fallback: static pricing JSON for known models (Claude Opus, Sonnet, Gemini Flash, etc.)
- Formula: `cost_usd = (input_tokens * cost_input / 1_000_000) + (output_tokens * cost_output / 1_000_000)`

**UI:**
- Summary cards: Today / This Week / This Month (total cost, total tokens)
- Burn rate indicator: "~$X.XX / day"
- Bar chart: cost by agent (top 10) — use Recharts (already in deps)
- Pie chart: cost by model
- Line chart: daily cost trend
- Table: recent token usage entries with agent, model, tokens, cost
- Export CSV button

**Dashboard widget:** Add a compact cost summary card to the main `/dashboard` page.

### 3.3 Memory Browser

**Route:** `app/(dashboard)/memory/page.tsx`

**Server Actions** (extend `lib/actions/memory.ts`):
- `getAgentMemoryOverview(orgId)` — all agents with their last event, event count, last active
- `getAgentMemoryTimeline(agentId, orgId, limit, offset)` — paginated event history
- `searchAgentMemory(orgId, query, agentId?)` — full-text search across agent events

**UI:**
- Left sidebar: agent list with avatars, click to select
- Main area: selected agent's memory timeline
  - Event cards: type badge, message, timestamp, metadata expandable
  - Search bar at top
  - Filter by event type
- If no direct memory file access: show banner "Event-derived view — direct memory browsing requires gateway connection"
- When gateway connected (Phase 1 WebSocket): send `memory.list` / `memory.read` commands to gateway for actual file browsing

**Future enhancement (requires gateway):**
- File tree component showing actual memory directory
- File content viewer (markdown rendered)
- Memory file search

---

## Phase 4 — Management & Automation (Weeks 5-6)

### 4.1 Models Management Page

**Route:** `app/(dashboard)/models/page.tsx`

**Server Actions:** Already exist in `lib/actions/user-models.ts` + `lib/actions/model-assignments.ts`. No new actions needed.

**UI:**
- Model cards/table: display name, provider, model ID, context window, cost/1M tokens
- Default model badge
- Add model form: provider, model ID, display name, API key (encrypted), cost rates
- Edit/delete actions
- "Set as Default" button
- Model assignments section: use case → model mapping table
  - Use cases: coding, research, review, communication, general
  - Dropdown to assign model per use case
- Per-agent model assignment: link to agent edit page

### 4.2 Alert Rules

**Route:** `app/(dashboard)/alerts/page.tsx`

**Server Actions** (new file: `lib/actions/alerts.ts`):
- `getAlertRules(orgId)` — list all rules
- `createAlertRule(orgId, input)` — create rule
- `updateAlertRule(id, input)` — update rule
- `deleteAlertRule(id)` — delete rule
- `getAlertHistory(orgId, ruleId?, limit?)` — triggered alerts log
- `evaluateAlerts(orgId)` — run evaluation (called by cron)

**Vercel Cron Job:** `app/api/cron/evaluate-alerts/route.ts`
- Schedule: every 5 minutes
- Logic:
  1. Get all enabled rules for all orgs
  2. For each rule, query the entity and check condition
  3. If condition met AND cooldown expired → trigger action + log to `alert_history`
  4. Update `last_triggered_at` on the rule

**UI:**
- Rules list with on/off toggle, entity type, condition summary
- Create/edit form: entity type → condition builder → action selector → cooldown
- Alert history tab: timeline of triggered alerts with rule name, message, timestamp
- Test button: manually evaluate a rule to see if it would fire

### 4.3 Inter-Agent Communication

**Route:** `app/(dashboard)/communications/page.tsx`

**Server Actions** (new file: `lib/actions/agent-messages.ts`):
- `getConversations(orgId, agentId?)` — list conversations with last message preview
- `getConversation(id)` — single conversation with participant details
- `createConversation(orgId, participantIds, title?)` — start new conversation
- `getMessages(conversationId, limit, offset)` — paginated messages
- `sendMessage(conversationId, fromUserId?, fromAgentId?, content, type)` — send message
- `getUnreadCount(orgId, agentId?)` — unread message count

**UI:**
- Left panel: conversation list (sorted by last message)
  - Each row: participant avatars, title/preview, timestamp, unread badge
  - "New Conversation" button
- Right panel: message thread
  - Messages with agent avatar, name, timestamp, content
  - Message type badges (text, status, handoff, task_update)
  - Input bar at bottom for Fares to send messages
- Live updates via `usePooledRealtime()` on `agent_messages`

### 4.4 Scheduled Runs UI

**Route:** `app/(dashboard)/schedules/page.tsx`

**Server Actions** (new file: `lib/actions/scheduled-runs.ts`):
- `getScheduledRuns(orgId)` — list all schedules
- `createScheduledRun(orgId, input)` — create schedule (agent, task type, cron expr, next_run_at)
- `updateScheduledRun(id, input)` — update schedule
- `deleteScheduledRun(id)` — delete schedule
- `toggleSchedulePause(id)` — pause/resume
- `triggerManualRun(id)` — execute immediately

**Cron expression support:**
- Use `cron-parser` npm package to validate expressions and compute `next_run_at`
- Show human-readable description: "Every day at 9:00 AM"

**Vercel Cron Job:** `app/api/cron/run-schedules/route.ts`
- Schedule: every 1 minute
- Logic:
  1. Query `scheduled_runs` WHERE `paused = false AND next_run_at <= now()`
  2. For each due run: dispatch `createAgentCommand()` with `run_task`
  3. Update `last_run_at`, `last_status`, compute `next_run_at`

**UI:**
- Table: agent, task type, schedule (human-readable), last run (relative + status badge), next run
- Create form: agent selector, task type, cron builder (presets + custom)
- Row actions: pause/resume toggle, trigger now, edit, delete
- Run history expandable per schedule

---

## Phase 5 — Hardening & Polish (Week 7)

### 5.1 Webhook Delivery History

**Extension to existing board webhooks UI.**

**Server Actions** (new file: `lib/actions/webhook-deliveries.ts`):
- `getWebhookDeliveries(webhookId, orgId, limit)` — list deliveries
- `retryWebhookDelivery(deliveryId)` — re-send the payload

**UI** (panel within gateway or board webhook pages):
- Delivery list: timestamp, event type, status code (green/red badge), duration
- Expand row: request payload, response body
- Retry button for failed deliveries

### 5.2 Global Search (Cmd+K)

**Component:** `components/command-palette.tsx`

**Implementation:**
- Use `cmdk` npm package (already common with shadcn)
- Search categories: Agents, Tasks, Projects, Clients, Sessions
- Query via Supabase full-text search or ILIKE on name/title fields
- Recent searches stored in localStorage
- Keyboard navigation + Enter to navigate

### 5.3 Performance Optimizations

| Area | Action |
|------|--------|
| Long lists (logs, events, messages) | Use `@tanstack/react-virtual` for virtual scrolling |
| Session/event pagination | Server-side cursor pagination (not offset) |
| Large JSON payloads | Collapsed by default, expand on click |
| Dashboard queries | Use `lib/server-cache.ts` with appropriate TTL |
| Realtime subscriptions | Already pooled via `RealtimeProvider` — verify no leaks with 24 agents |

### 5.4 Security Checks

| Check | Action |
|-------|--------|
| Gateway tokens | Never log or expose to client. Redact in any UI display (show `••••••••`). |
| API key encryption | Already uses AES-256-GCM. Verify new model forms use same encryption. |
| RLS verification | Write test: create user in org B, verify they cannot read org A's data. |
| Cron endpoints | Verify `CRON_SECRET` header check on all `/api/cron/*` routes. |
| WebSocket auth | Gateway connection must include auth token from `gateways.auth_token`. |

### 5.5 Data Retention

**Vercel Cron Job:** `app/api/cron/cleanup/route.ts`
- Schedule: daily at 3:00 AM UTC
- Cleanup rules:
  - `agent_logs`: delete rows older than 14 days
  - `agent_events`: delete rows older than 90 days
  - `token_usage_logs`: keep raw data 90 days, aggregate older data into daily summaries
  - `alert_history`: delete rows older than 90 days
  - `webhook_deliveries`: delete rows older than 30 days

### 5.6 Observability

| Tool | Purpose |
|------|---------|
| Sentry (already configured) | Error tracking, performance monitoring |
| Vercel Analytics | Page load times, web vitals |
| Supabase Dashboard | Database performance, RLS policy hits |
| Custom: connection health banner | Show degraded state banner when gateway disconnects or Supabase Realtime drops |

---

## Execution Order Summary

```
Week 1:  Phase 1 — DB migration + Gateway WS hook + Status bar
Week 2:  Phase 2a — Agent control buttons + Sessions page
Week 3:  Phase 2b — Heartbeat system + Session detail panel
Week 3:  Phase 3a — Log viewer
Week 4:  Phase 3b — Cost dashboard + Memory browser
Week 5:  Phase 4a — Models page + Alert rules
Week 6:  Phase 4b — Agent chat + Scheduled runs
Week 7:  Phase 5  — Webhook history + Global search + Hardening
```

---

## New Files to Create (Summary)

### Server Actions
| File | Phase |
|------|-------|
| `lib/actions/sessions.ts` | 2 |
| `lib/actions/agent-logs.ts` | 3 |
| `lib/actions/token-usage.ts` | 3 |
| `lib/actions/alerts.ts` | 4 |
| `lib/actions/agent-messages.ts` | 4 |
| `lib/actions/scheduled-runs.ts` | 4 |
| `lib/actions/webhook-deliveries.ts` | 5 |

### Hooks
| File | Phase |
|------|-------|
| `hooks/use-gateway-websocket.ts` | 1 |
| `hooks/gateway-context.tsx` | 1 |

### API Routes (Cron Jobs)
| File | Phase |
|------|-------|
| `app/api/cron/check-heartbeats/route.ts` | 2 |
| `app/api/cron/evaluate-alerts/route.ts` | 4 |
| `app/api/cron/run-schedules/route.ts` | 4 |
| `app/api/cron/cleanup/route.ts` | 5 |

### Pages
| Route | Phase |
|-------|-------|
| `app/(dashboard)/sessions/page.tsx` | 2 |
| `app/(dashboard)/logs/page.tsx` | 3 |
| `app/(dashboard)/costs/page.tsx` | 3 |
| `app/(dashboard)/memory/page.tsx` | 3 |
| `app/(dashboard)/models/page.tsx` | 4 |
| `app/(dashboard)/alerts/page.tsx` | 4 |
| `app/(dashboard)/communications/page.tsx` | 4 |
| `app/(dashboard)/schedules/page.tsx` | 4 |

### Components
| File | Phase |
|------|-------|
| `components/mission-control/status-bar.tsx` | 1 |
| `components/sessions/sessions-page-client.tsx` | 2 |
| `components/sessions/session-detail-panel.tsx` | 2 |
| `components/logs/log-viewer.tsx` | 3 |
| `components/costs/cost-dashboard.tsx` | 3 |
| `components/memory/memory-browser.tsx` | 3 |
| `components/models/models-page-client.tsx` | 4 |
| `components/alerts/alerts-page-client.tsx` | 4 |
| `components/communications/chat-page-client.tsx` | 4 |
| `components/schedules/schedules-page-client.tsx` | 4 |
| `components/command-palette.tsx` | 5 |

---

## Database Migration Summary

**Migration: `20260302000001_mission_control_live_ops.sql`**

| Action | Table |
|--------|-------|
| CREATE | `token_usage_logs` |
| CREATE | `agent_logs` |
| CREATE | `alert_rules` |
| CREATE | `alert_history` |
| CREATE | `agent_conversations` |
| CREATE | `agent_messages` |
| CREATE | `webhook_deliveries` |
| ALTER | `agent_commands` — add 'wake' and 'message' to command_type CHECK |
| ALTER | `agent_events` — add 'log' to event_type CHECK |
| ALTER | `agent_sessions` — add `input_tokens`, `output_tokens` columns |
| ALTER PUBLICATION | Add `agent_sessions`, `agent_messages` to `supabase_realtime` |

**Every new table gets:**
- RLS enabled + org-scoped policies (SELECT/INSERT for members, UPDATE where needed)
- Indexes on `(organization_id, created_at DESC)` at minimum
- `updated_at` trigger where applicable

---

## What We Explicitly Skip

| Feature from ChatGPT Plan | Reason |
|---------------------------|--------|
| FastAPI skeleton | Wrong architecture. PMS is serverless Next.js on Vercel. |
| FastAPI JWT middleware | Supabase Auth handles this. Server Actions use `requireAuth()`. |
| FastAPI worker loop for commands | Use Supabase Realtime + Edge Functions instead. |
| FastAPI WS proxy | Client-side WebSocket connects directly to gateway. |
| FastAPI ingestion APIs | `POST /api/agent-events` already handles this (366 lines). |
| FastAPI cost aggregation endpoints | Next.js Server Actions in `lib/actions/token-usage.ts`. |
| Zustand state management | PMS uses React Context. Follow existing `RealtimeProvider` pattern. |
| New realtime system (`useMissionControlStream`) | Extend existing `usePooledRealtime()` from `hooks/realtime-context.tsx`. |
| Bunny storage integration | Not needed. |
| Recreating `agent_events` table | Already exists since Sprint 3. |
| Recreating `agent_commands` table | Already exists since Sprint 3. |
| Recreating `agent_sessions` table | Already exists since Phase 1 gap closure. |
| Recreating `scheduled_runs` table | Already exists since Phase 1 gap closure. |
| SSE (Server-Sent Events) | Supabase Realtime (WebSocket) is superior and already integrated. |
| Custom auth system | Supabase Auth with org-based membership already handles everything. |
| Docker deployment | Vercel auto-deploys from `main` branch. |
