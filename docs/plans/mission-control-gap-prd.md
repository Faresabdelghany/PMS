# Mission Control Gap Closure — PRD

> **Date:** 2026-03-02
> **Author:** Product Analysis
> **Status:** Draft
> **Reference:** [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) + [OpenClaw Docs](https://docs.openclaw.ai)

---

## 1. Executive Summary

PMS is evolving into **Mission Control** — a live command center where Fares manages his entire AI team (24 agents) and everything OpenClaw does. After comparing PMS against builderz-labs/mission-control (the reference open-source OpenClaw dashboard), this document catalogs every gap, classifies each as **NEED** or **SKIP**, and provides implementation specs for what we're building.

**Key Insight:** PMS already has a more mature project management foundation (clients, projects, workstreams, reports, multi-view tasks). The main gap is the **live agent connection layer** — real-time communication with OpenClaw agents, session management, and observability tooling.

---

## 2. What We Already Have (No Work Needed)

These features exist and are mature. Do not rebuild or duplicate.

| Feature | PMS Status | Notes |
|---------|-----------|-------|
| Agent CRUD (list, create, edit, delete) | Done | 24 agents seeded with hierarchy |
| Agent hierarchy/network visualization | Done | ReactFlow-based |
| Agent activity feed | Done | `/activity` page with filters |
| Task Kanban board (multi-view) | Done | Kanban, list, week, timeline views |
| Task assignment to agents | Done | `agent_id` + `assigned_agent_id` fields |
| Task comments, reactions, @mentions | Done | More mature than MC |
| Approvals workflow | Done | `/approvals` with pending/approved/rejected |
| Gateways management | Done | `/gateways` with health checks |
| Skills marketplace | Done | Gateway catalog fetch + fallback catalog |
| Boards + board groups | Done | `/boards` with grouping |
| Board webhooks | Done | Event subscriptions per board |
| Custom fields | Done | Definition + values per task |
| Tags | Done | MC doesn't have this |
| Agent documents/deliverables | Done | MC doesn't have this |
| Agent commands (PMS → Agent) | Done | Supabase bus: `agent_commands` table |
| Agent events (Agent → PMS) | Done | Webhook: `POST /api/agent-events` |
| Real-time subscriptions | Done | Supabase Realtime (pooled) |
| Retry policies with escalation | Done | MC doesn't have this |
| Definition of Done enforcement | Done | MC doesn't have this |
| Full auth (login, signup, OAuth, invites) | Done | Supabase Auth |
| Client management | Done | MC doesn't have this |
| Project management | Done | MC doesn't have this |
| AI Chat with streaming | Done | `/chat` with persistence |
| Inbox, Settings, Reports, Workstreams | Done | MC doesn't have this |

---

## 3. Features We NEED — Full Spec

### 3.1 — WebSocket Gateway Connection (CRITICAL)

**Priority:** P0 — This unlocks everything else
**Effort:** Large
**Why:** Currently PMS communicates with OpenClaw via Supabase tables (async polling). Mission Control connects directly via WebSocket to OpenClaw's gateway (port 18789) for instant bidirectional communication. Without this, everything is delayed.

**What to build:**
- WebSocket client hook (`useOpenClawGateway`) that connects to OpenClaw gateway
- Connection manager with auto-reconnect + exponential backoff
- Heartbeat ping/pong every 30s with RTT latency display
- Frame protocol support (req/res/event message types)
- Connection status indicator in the UI (connected/disconnected/reconnecting)
- Gateway selector (connect to any registered gateway from `/gateways`)
- Store integration (Zustand or React context) to distribute events to components

**Protocol details (from MC):**
```text
Frame: { type: 'req'|'res'|'event', id?, method?, params?, result?, error? }
Heartbeat: ping/pong every 30s, 3 missed = reconnect
Gateway default: ws://127.0.0.1:18789
Auth: Bearer token in connection params
```

**Acceptance criteria:**
- [ ] Connect to OpenClaw gateway from PMS UI
- [ ] Auto-reconnect on disconnect
- [ ] Show connection status (green/yellow/red indicator)
- [ ] Display RTT latency
- [ ] Route incoming events to appropriate components
- [ ] Support multiple gateways (select from registered list)

---

### 3.2 — Session Viewer & Inspector (HIGH)

**Priority:** P1
**Effort:** Medium
**Depends on:** 3.1 (WebSocket) for live updates; can work with DB-only initially
**Why:** Agents run tasks in sessions. Without seeing sessions, Fares is blind to what agents are actively doing.

**What to build:**
- **Page:** `/sessions` — list all active/recent agent sessions
- Session table with columns: Agent, Task, Status, Started, Duration, Tokens Used
- Status filter: running / blocked / waiting / completed
- **Session detail panel** (slide-over or page):
  - Session metadata (agent, task, start time, status)
  - Live log stream (if WebSocket connected)
  - Token usage breakdown
  - Blocker reason (if blocked/waiting)
  - Error details (if failed)
- **Control buttons:**
  - Monitor (watch live)
  - Pause session
  - Resume session
  - Terminate session
- Session spawning: "New Session" button → pick agent + task → spawn

**Database:** `agent_sessions` table already exists with all needed fields.

**Acceptance criteria:**
- [ ] List all sessions with status badges
- [ ] Filter by status, agent
- [ ] View session details in panel
- [ ] Control buttons dispatch commands via `agent_commands`
- [ ] Spawn new session from UI
- [ ] Live updates via Supabase Realtime (upgrade to WebSocket later)

---

### 3.3 — Agent Memory Browser (HIGH)

**Priority:** P1
**Effort:** Medium
**Why:** Agents accumulate memory (context, decisions, learned patterns). Fares needs to see what each agent "knows" and search across memories.

**What to build:**
- **Page:** `/memory` — org-wide memory overview
- **Per-agent memory panel** (accessible from agent detail page):
  - File tree browser showing memory directory structure
  - File content viewer (markdown rendered)
  - Search within agent's memory files
- **Org-wide memory search:**
  - Search across all agents' memories
  - Filter by agent, date range, content type
  - Results with agent attribution and file path
- Memory stats per agent (file count, total size, last updated)

**Integration:** Requires API endpoint on OpenClaw side to serve memory files, OR gateway command to read memory. If not available, start with displaying `agent_events` of type `agent_message` as a memory proxy.

**Acceptance criteria:**
- [ ] Browse memory files per agent
- [ ] View file contents (rendered markdown)
- [ ] Search across all agents' memories
- [ ] Show memory stats on agent cards
- [ ] Fallback to event history if direct memory access unavailable

---

### 3.4 — Token Usage & Cost Dashboard (HIGH)

**Priority:** P1
**Effort:** Medium
**Why:** Running 24 agents costs money. Fares needs to know burn rate, per-agent costs, and trends to optimize spending.

**What to build:**
- **Dashboard widget:** Total spend today / this week / this month
- **Dedicated page:** `/costs` or section within `/dashboard`
  - Cost by agent (bar chart)
  - Cost by model (pie chart)
  - Cost over time (line chart — daily/weekly)
  - Token usage breakdown: input vs output tokens
  - Per-session cost tracking
  - Top 5 most expensive tasks
- **Data collection:**
  - New table `token_usage_logs`: agent_id, session_id, task_id, model, input_tokens, output_tokens, cost, timestamp
  - OpenClaw reports token usage via events → store in this table
  - Or parse from session completion events
- Cost alerts: warn when daily spend exceeds threshold

**Existing assets:** `ai_models` table already has `cost_per_input_token` / `cost_per_output_token` fields.

**Acceptance criteria:**
- [ ] Track token usage per agent/session/task
- [ ] Display cost charts (by agent, by model, over time)
- [ ] Show daily/weekly/monthly summaries
- [ ] Dashboard widget with current burn rate
- [ ] Export cost data as CSV

---

### 3.5 — Active Heartbeat System (HIGH)

**Priority:** P1
**Effort:** Small-Medium
**Depends on:** 3.1 (WebSocket) for real-time; can start with polling
**Why:** Agent status is currently static. Need live health monitoring to know which agents are actually responsive.

**What to build:**
- **Heartbeat loop:** Every 30s, check each agent's last heartbeat
- **Status transitions:**
  - `online` → `offline` if no heartbeat in `heartbeat_timeout_seconds` (default 90s)
  - `offline` → `online` when heartbeat received
  - `busy` when agent reports task in progress
  - `idle` when agent reports no active task
- **Health indicator on agent cards:**
  - Green dot = online (heartbeat < 30s ago)
  - Yellow dot = stale (heartbeat 30-90s ago)
  - Red dot = offline (heartbeat > 90s ago)
  - Pulsing animation when busy
- **Heartbeat endpoint check** (like MC):
  - When agent heartbeats, check for pending work:
    - Assigned tasks waiting
    - @mentions in comments
    - Pending approvals
    - Unread notifications
  - Return work items or `HEARTBEAT_OK`
- **Dashboard widget:** Agent health overview (X online, Y offline, Z busy)

**Database:** `agents.heartbeat_interval_seconds`, `agents.heartbeat_timeout_seconds`, `mission_control_heartbeat` table already exist.

**Acceptance criteria:**
- [ ] Agents show live health status (green/yellow/red)
- [ ] Auto-transition to offline after timeout
- [ ] Heartbeat response includes pending work items
- [ ] Dashboard shows agent health summary
- [ ] Alert when critical agent goes offline

---

### 3.6 — Agent Wake & Spawn Controls (MEDIUM-HIGH)

**Priority:** P2
**Effort:** Small
**Why:** Fares needs to kick agents into action from the UI — wake a sleeping agent, spawn a new session with a task.

**What to build:**
- **Wake Agent button** (on agent detail page + agent list):
  - Opens modal: "Send wake message to [Agent Name]"
  - Text input for custom message (optional)
  - Dispatches wake command via `agent_commands` or WebSocket
- **Spawn Session button** (on agent detail page):
  - Opens modal: "Start new session"
  - Select task to work on (from task list)
  - Optional: custom instructions
  - Creates session + dispatches run_task command
- **Ping button** (quick health check):
  - Already has `pingAgent()` action
  - Add UI button with loading state + result toast
- **Bulk actions:**
  - "Pause All" — send pause to all online agents
  - "Resume All" — send resume to all paused agents
  - Confirmation dialog before bulk actions

**Acceptance criteria:**
- [ ] Wake button sends message to agent
- [ ] Spawn button creates session + dispatches task
- [ ] Ping button shows response time
- [ ] Bulk pause/resume with confirmation
- [ ] Toast notifications for action results

---

### 3.7 — Log Viewer (MEDIUM)

**Priority:** P2
**Effort:** Medium
**Why:** When things go wrong, Fares needs to see agent logs — errors, warnings, debug info — in real time.

**What to build:**
- **Page:** `/logs` or panel within `/agents/[id]`
- Log stream display (terminal-style, monospace):
  - Timestamp | Agent | Level | Message
  - Color-coded by level (error=red, warn=yellow, info=white, debug=gray)
- **Filters:**
  - By agent (multi-select)
  - By level (error, warn, info, debug)
  - By time range
  - Text search within log messages
- **Live streaming:**
  - Via WebSocket: stream logs as they arrive
  - Via polling fallback: fetch new logs every 5s
- **Log retention:**
  - Store in `agent_logs` table (new)
  - Fields: id, org_id, agent_id, session_id, level, message, metadata (JSONB), created_at
  - Auto-cleanup: keep last 7 days (configurable)

**Acceptance criteria:**
- [ ] View logs in real-time (streaming or polling)
- [ ] Filter by agent, level, time range, text
- [ ] Color-coded log levels
- [ ] Auto-scroll with pause option
- [ ] Export filtered logs

---

### 3.8 — System Status Panel (MEDIUM)

**Priority:** P2
**Effort:** Small
**Why:** Quick overview of system health — are gateways connected? How many agents active? Any errors?

**What to build:**
- **Dashboard widget** (not a separate page):
  - Gateway connection status (connected/disconnected per gateway)
  - Gateway latency (RTT from heartbeat)
  - Active agents count / total
  - Active sessions count
  - Pending commands count
  - Last event received timestamp
  - Error rate (failed events / total in last hour)
- **Status bar** (persistent, in header or sidebar):
  - Small indicator: "Gateway: Connected (12ms)" or "Gateway: Disconnected"
  - Click to expand full status panel

**Acceptance criteria:**
- [ ] Dashboard shows system health at a glance
- [ ] Gateway connection status visible at all times
- [ ] Error rate tracking
- [ ] Click-to-expand for details

---

### 3.9 — Inter-Agent Communication Hub (MEDIUM)

**Priority:** P2
**Effort:** Medium-Large
**Why:** Agents need to message each other (lead → specialist, specialist → lead). Fares needs to see these conversations.

**What to build:**
- **Page:** `/communications` or tab within `/agents`
- **Conversation list:**
  - Agent-to-agent message threads
  - Filter by agent, date range
  - Unread indicator
- **Message view:**
  - Threaded conversation display
  - Timestamp + sender agent avatar
  - Message type badges (task update, question, handoff, etc.)
- **Send message** (Fares → Agent):
  - Text input to message any agent
  - Dispatched via `agent_commands` with type `message`
- **Coordinator integration:**
  - Messages routed through coordinator agent (Ziko/Nabil)
  - Follows chain of command visibility

**Database:** `task_messages` table exists but is task-scoped. Need a new `agent_messages` table or extend `task_messages` to support non-task conversations.

**Acceptance criteria:**
- [ ] View all agent-to-agent conversations
- [ ] Send message from UI to any agent
- [ ] Real-time message delivery via Realtime
- [ ] Thread grouping by conversation
- [ ] Unread indicators

---

### 3.10 — Alert Rules Engine (MEDIUM)

**Priority:** P2
**Effort:** Medium
**Why:** Automated monitoring — get notified when specific conditions occur without manually watching.

**What to build:**
- **Page:** `/alerts` or section in `/settings`
- **Alert rule builder:**
  - Entity type: Agent / Task / Session / Gateway
  - Condition: field + operator + value
    - Example: "Agent status = error" → Notify
    - Example: "Task status = blocked for > 1 hour" → Notify
    - Example: "Daily cost > $50" → Notify
    - Example: "Gateway disconnected for > 5 min" → Notify
  - Action: in-app notification / email / webhook / Telegram
  - Cooldown period (prevent spam)
- **Alert history:** List of triggered alerts with timestamps
- **Active rules dashboard:** Show all rules with on/off toggle

**Database (new):**
```sql
alert_rules: id, org_id, name, entity_type, condition_field, condition_operator,
             condition_value, action_type, action_target, cooldown_minutes,
             enabled, last_triggered_at, created_at
alert_history: id, rule_id, org_id, message, metadata, created_at
```

**Acceptance criteria:**
- [ ] Create alert rules with conditions
- [ ] Rules evaluate automatically on events
- [ ] Actions fire (notification at minimum)
- [ ] Cooldown prevents duplicate alerts
- [ ] Alert history viewable

---

### 3.11 — Scheduled Runs UI (MEDIUM)

**Priority:** P3
**Effort:** Small-Medium
**Why:** Some tasks need to run on a schedule (daily reports, weekly cleanup, periodic checks).

**What to build:**
- **Page:** `/schedules` or tab within `/agents`
- **Schedule list:**
  - Agent | Task Type | Schedule (cron expression) | Last Run | Next Run | Status
- **Create schedule:**
  - Pick agent
  - Pick task type or custom task
  - Set cron expression (with human-readable preview)
  - Enable/disable toggle
- **Run history:**
  - Per-schedule: list of past runs with status, duration, log link
- **Controls:**
  - Pause/resume schedule
  - Trigger manual run
  - Delete schedule

**Database:** `scheduled_runs` table already exists with all needed fields.

**Acceptance criteria:**
- [ ] List all scheduled runs
- [ ] Create new schedule with cron expression
- [ ] View run history per schedule
- [ ] Pause/resume/delete schedules
- [ ] Manual trigger button

---

### 3.12 — Models Management Page (MEDIUM)

**Priority:** P2
**Effort:** Small
**Why:** Already in Sprint 4 backlog. Manage which AI models are available and assign them to agents/use cases.

**What to build:**
- **Page:** `/models`
- **Model list:**
  - Display name, provider, model ID, context window, cost per token
  - Default model badge
  - Edit/delete actions
- **Add model form:**
  - Provider (Anthropic, Google, OpenAI, etc.)
  - Model ID
  - API key (encrypted)
  - Cost per input/output token
  - Set as default checkbox
- **Model assignments:**
  - Assign model to use case (coding, research, review, etc.)
  - Assign model to specific agent (override default)
- **Model switching per agent:**
  - On agent edit page, select from registered models
  - Dispatches `model_update` command

**Database:** `user_models` + `model_assignments` tables already exist.

**Acceptance criteria:**
- [ ] CRUD for AI models
- [ ] Set default model
- [ ] Assign models to use cases
- [ ] Switch model per agent from edit page
- [ ] Show current model on agent cards

---

### 3.13 — Webhook Delivery History (LOW-MEDIUM)

**Priority:** P3
**Effort:** Small
**Why:** Already in Sprint 5 backlog. When webhooks fire, need to see delivery status and debug failures.

**What to build:**
- **Panel** within `/gateways/[id]` or `/boards`:
  - List of webhook deliveries: timestamp, event, URL, status code, response time
  - Filter by status (success/failed)
  - Retry failed deliveries button
  - View request/response payloads
- **Database (new):**
  ```sql
  webhook_deliveries: id, webhook_id, org_id, event_type, request_payload,
                      response_status, response_body, duration_ms,
                      attempt_count, created_at
  ```

**Acceptance criteria:**
- [ ] View delivery history per webhook
- [ ] See success/failure status
- [ ] View payloads
- [ ] Retry failed deliveries

---

### 3.14 — OpenClaw Config Viewer (LOW)

**Priority:** P3
**Effort:** Small
**Why:** Nice-to-have for debugging. View OpenClaw's configuration from PMS without SSH-ing into the server.

**What to build:**
- **Panel** within gateway detail page:
  - Read-only view of OpenClaw config (JSON viewer)
  - Sensitive fields masked (API keys, tokens)
  - Refresh button
- **Optional (Phase 2):** Edit mode for non-sensitive fields
- Requires: Gateway API endpoint to serve config, or read from `openclaw.json` via command

**Acceptance criteria:**
- [ ] View OpenClaw config from gateway detail
- [ ] Sensitive fields masked
- [ ] Refresh button

---

### 3.15 — Global Entity Search (LOW)

**Priority:** P3
**Effort:** Small-Medium
**Why:** As the system grows, need to quickly find agents, tasks, sessions, etc. from one search bar.

**What to build:**
- **Command palette** (Cmd+K / Ctrl+K):
  - Search across: agents, tasks, projects, clients, sessions, skills
  - Result categories with icons
  - Keyboard navigation
  - Recent searches
- Uses existing Supabase full-text search or client-side filtering

**Acceptance criteria:**
- [ ] Cmd+K opens search palette
- [ ] Search across all entity types
- [ ] Navigate to result on select
- [ ] Recent searches shown on open

---

## 4. Features We DON'T NEED (Skip)

These exist in Mission Control but are unnecessary for PMS due to architectural differences.

| MC Feature | Why We Skip It |
|-----------|---------------|
| **SQLite database** | PMS uses Supabase (PostgreSQL) — better scaling, built-in auth, RLS, realtime |
| **Custom auth system (scrypt)** | PMS uses Supabase Auth — login, signup, OAuth, invitations all handled |
| **Server-Sent Events (SSE)** | PMS uses Supabase Realtime (WebSocket-based) — already superior |
| **Local EventEmitter event bus** | Supabase Realtime serves this purpose — cross-instance, persistent |
| **In-memory rate limiting** | Vercel Edge handles rate limiting; Supabase has built-in throttling |
| **CSRF middleware** | Next.js Server Actions have built-in CSRF protection |
| **Network access control (MC_ALLOWED_HOSTS)** | Vercel deployment handles this; Supabase RLS handles data access |
| **Security headers middleware** | Vercel config + Next.js `headers()` in `next.config.ts` handles this |
| **Docker deployment** | PMS auto-deploys on Vercel from `main` branch |
| **Node-cron background scheduler** | Not compatible with serverless (Vercel). Use Vercel Cron Jobs or Supabase pg_cron instead |
| **1Password CLI integration** | Different secret management — use Vercel env vars + Supabase vault |
| **Google Sign-In with admin approval** | PMS uses Supabase Auth with org invitations — different flow |
| **Viewer/Operator/Admin RBAC** | PMS uses org-based membership with roles — different model |
| **Local file-based agent sync** | PMS agents are in Supabase, not synced from local `openclaw.json` |
| **Single-server architecture** | PMS is serverless on Vercel — horizontally scalable by default |
| **Standup report generation** | PMS has its own Reports feature — extend that instead |
| **Quality review gates (6-column Kanban)** | PMS has Definition of Done policies — superior approach |
| **Workflow pipeline engine** | Over-engineered for current needs. PMS has task dependencies + retry policies |
| **Audit log (separate table)** | PMS has `agent_activities` + `agent_events` which serve as audit trail |

---

## 5. Implementation Phases

### Phase 1 — Live Connection (Weeks 1-2)

| # | Feature | Priority | Effort | Depends On |
|---|---------|----------|--------|------------|
| 3.1 | WebSocket Gateway Connection | P0 | Large | — |
| 3.5 | Active Heartbeat System | P1 | Small | 3.1 (partial) |
| 3.6 | Agent Wake & Spawn Controls | P2 | Small | 3.1 |
| 3.8 | System Status Panel | P2 | Small | 3.1 |

**Outcome:** PMS can talk to OpenClaw in real-time. Agent status is live. Fares can wake/spawn agents.

### Phase 2 — Observability (Weeks 3-4)

| # | Feature | Priority | Effort | Depends On |
|---|---------|----------|--------|------------|
| 3.2 | Session Viewer & Inspector | P1 | Medium | 3.1 |
| 3.3 | Agent Memory Browser | P1 | Medium | 3.1 (optional) |
| 3.4 | Token Usage & Cost Dashboard | P1 | Medium | — |
| 3.7 | Log Viewer | P2 | Medium | 3.1 |

**Outcome:** Full visibility into what agents are doing, how much they cost, and what they remember.

### Phase 3 — Management & Automation (Weeks 5-6)

| # | Feature | Priority | Effort | Depends On |
|---|---------|----------|--------|------------|
| 3.12 | Models Management Page | P2 | Small | — |
| 3.9 | Inter-Agent Communication Hub | P2 | Medium-Large | — |
| 3.10 | Alert Rules Engine | P2 | Medium | — |
| 3.11 | Scheduled Runs UI | P3 | Small-Medium | — |

**Outcome:** Full control over models, agent communication, automated alerts, and scheduled operations.

### Phase 4 — Polish (Week 7)

| # | Feature | Priority | Effort | Depends On |
|---|---------|----------|--------|------------|
| 3.13 | Webhook Delivery History | P3 | Small | — |
| 3.14 | OpenClaw Config Viewer | P3 | Small | 3.1 |
| 3.15 | Global Entity Search | P3 | Small-Medium | — |

**Outcome:** Quality-of-life improvements for daily operations.

---

## 6. New Database Tables Needed

```sql
-- Token tracking (for 3.4)
token_usage_logs (
  id, organization_id, agent_id, session_id, task_id,
  model, provider, input_tokens, output_tokens,
  cost_usd, created_at
)

-- Log storage (for 3.7)
agent_logs (
  id, organization_id, agent_id, session_id,
  level, message, metadata,
  created_at
)

-- Alert system (for 3.10)
alert_rules (
  id, organization_id, name, entity_type,
  condition_field, condition_operator, condition_value,
  action_type, action_target, cooldown_minutes,
  enabled, last_triggered_at, created_at
)
alert_history (
  id, rule_id, organization_id,
  message, metadata, created_at
)

-- Agent messaging (for 3.9)
agent_messages (
  id, organization_id, conversation_id,
  from_agent_id, to_agent_id, content,
  message_type, metadata, created_at
)
agent_conversations (
  id, organization_id, title,
  participant_ids, last_message_at, created_at
)

-- Webhook delivery tracking (for 3.13)
webhook_deliveries (
  id, webhook_id, organization_id, event_type,
  request_payload, response_status, response_body,
  duration_ms, attempt_count, created_at
)
```

**Existing tables that are ready (schema exists, no UI yet):**
- `agent_sessions` — for 3.2
- `scheduled_runs` — for 3.11
- `user_models` + `model_assignments` — for 3.12
- `mission_control_heartbeat` — for 3.5

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Gateway connection uptime | > 99% during work hours |
| Agent status accuracy | Real status within 30s of change |
| Event latency (OpenClaw → PMS UI) | < 2s via WebSocket |
| Cost tracking coverage | 100% of agent sessions tracked |
| Session visibility | All active sessions visible in UI |
| Alert response time | < 60s from condition → notification |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenClaw gateway API not documented | Blocks WebSocket integration | Start with Supabase bus; add WebSocket when API confirmed |
| WebSocket not compatible with Vercel serverless | Blocks real-time features | Use Supabase Realtime as transport layer; client-side WS only |
| Token usage not reported by OpenClaw | Blocks cost dashboard | Parse from session events; request OpenClaw team to add |
| Memory files not accessible via API | Blocks memory browser | Use agent events as memory proxy; request API addition |
| 24 agents = high event volume | Performance/cost concerns | Batch events; use efficient queries; set retention policies |

---

## 9. Out of Scope (Future Consideration)

- Native desktop app (Electron/Tauri)
- Mobile app for agent monitoring
- Multi-organization agent sharing
- Agent marketplace (third-party agents)
- AI-powered anomaly detection on agent behavior
- Video/screen recording of agent sessions
- Agent A/B testing framework
- Natural language alert rule builder
