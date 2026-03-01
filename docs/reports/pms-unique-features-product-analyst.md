# PMS Product Analysis: Unique Feature Proposals & Roadmap

**Date:** 2026-02-27  
**Analyst:** Product Analyst (AI Subagent)  
**Codebase Version:** 0.1.0 (Next.js 16 + Supabase)

---

## 1. Current Feature Inventory

| Domain | Existing Capabilities |
|---|---|
| **Projects** | CRUD, wizard (intent/mode/outcome/structure), scope/outcomes/features (P0-P2), deliverables, metrics, workstreams, timeline/Gantt, progress tracking, board view, cards view |
| **Tasks** | CRUD, priorities, statuses, subtasks (1-level), workstream assignment, drag-and-drop reorder, bulk operations, source tracking (manual/agent/speckit/system) |
| **Agents (AI)** | Agent registry (supreme/lead/specialist/integration), hierarchy (reports_to), squads, capabilities/skills, AI model config per agent, activity log, agent events, commands, documents |
| **Mission Control** | Approvals workflow, gateways (local agent bridges), boards with custom workflow statuses, board groups, webhooks, agent communication, thread subscriptions |
| **AI Chat** | Multi-provider chat (Anthropic/Google/OpenAI), conversations, AI-powered task generation, model assignments per context |
| **Collaboration** | Organizations, teams, invitations, project members (owner/pic/member/viewer), task comments, inbox, activity feed, notifications |
| **Content** | Notes (general/meeting/audio), documents, file management with storage, rich text (TipTap) |
| **Analytics** | Dashboard charts, project reports (wizard-based), financial snapshots |
| **Settings** | User preferences, color themes, labels, tags, custom fields, import, model assignments |
| **Infra** | Supabase RLS, Sentry, Vercel Analytics, rate limiting, cursor pagination, SWR caching |

### Competitive Positioning

**vs Linear/Jira/Asana:** PMS already has AI-native agent orchestration (hierarchical agents, approvals, gateways) which none of the big three offer natively. The project wizard with intent/outcome framing is also unique.

**vs AI-agent tools (CrewAI, AutoGen, LangGraph):** PMS bridges the gap between PM tooling and agent orchestration — agents live alongside human workflows rather than in a separate dev framework.

**Key gaps:** No time tracking, no sprint/cycle management, no dependency graphs, no automations engine, no API/integrations marketplace, no audit trail, limited analytics depth.

---

## 2. Feature Proposals (22 Ideas)

### A. Core PM (5 ideas)

#### A1. Task Dependency Graph & Critical Path
- **Problem:** No way to model task dependencies or identify bottleneck chains
- **Uniqueness:** 3/10 (table stakes for PM tools, but absent here)
- **Effort:** M | **Impact:** H
- **Dependencies:** Task system
- **Phase:** Now

#### A2. Sprint/Cycle Engine with Agent-Aware Planning
- **Problem:** No time-boxed iteration support; agents can't plan capacity across cycles
- **Uniqueness:** 7/10 (sprint planning that accounts for AI agent throughput is novel)
- **Effort:** L | **Impact:** H
- **Dependencies:** Tasks, Agents
- **Phase:** Now

#### A3. Time Tracking with AI Auto-Logging
- **Problem:** No time tracking; manual logging is tedious
- **Uniqueness:** 6/10 (auto-logging agent work time + human estimates is differentiated)
- **Effort:** M | **Impact:** M
- **Dependencies:** Tasks, Agent activity log
- **Phase:** Next

#### A4. Recurring Tasks & Templates
- **Problem:** Repetitive work must be created manually each time
- **Uniqueness:** 2/10 (common feature)
- **Effort:** S | **Impact:** M
- **Dependencies:** Tasks
- **Phase:** Now

#### A5. Multi-Level Subtask Hierarchy
- **Problem:** Current subtask depth is limited to 1 level; complex projects need deeper nesting
- **Uniqueness:** 3/10 (Linear has sub-issues, but tree depth is limited everywhere)
- **Effort:** S | **Impact:** M
- **Dependencies:** Tasks (parent_task_id constraint change)
- **Phase:** Later

---

### B. Agent Ops (5 ideas)

#### B1. Agent Cost Dashboard & Budget Caps
- **Problem:** No visibility into per-agent AI spend; no way to cap costs before they spike
- **Uniqueness:** 9/10 (no PM tool tracks agent token spend natively)
- **Effort:** M | **Impact:** H
- **Dependencies:** ai_models cost fields (already exist), agent_activities
- **Phase:** Now

#### B2. Agent Skill Marketplace (Community Skills)
- **Problem:** Skills page exists but no community sharing mechanism
- **Uniqueness:** 8/10 (a skill marketplace for PM-specific agent capabilities)
- **Effort:** L | **Impact:** H
- **Dependencies:** Skills system, agents
- **Phase:** Next

#### B3. Agent Autonomy Levels & Guardrails
- **Problem:** Binary approve/reject isn't granular enough; need configurable autonomy per agent/action type
- **Uniqueness:** 9/10 (no PM tool has agent autonomy controls)
- **Effort:** M | **Impact:** H
- **Dependencies:** Approvals system, agents
- **Phase:** Now

#### B4. Agent Performance Benchmarking
- **Problem:** No way to compare agent effectiveness across tasks, models, or configurations
- **Uniqueness:** 8/10 (agent A/B testing in a PM context)
- **Effort:** M | **Impact:** M
- **Dependencies:** Agent activities, tasks
- **Phase:** Next

#### B5. Multi-Agent Collaboration Protocols
- **Problem:** Agents operate independently; no structured handoff or collaboration patterns
- **Uniqueness:** 9/10 (orchestrated agent teamwork within PM workflows)
- **Effort:** L | **Impact:** H
- **Dependencies:** Agent hierarchy, agent events
- **Phase:** Next

---

### C. Workflow Automation (4 ideas)

#### C1. Visual Workflow Automations Builder
- **Problem:** No way to automate repetitive sequences (e.g., "when task done → notify client → create invoice")
- **Uniqueness:** 5/10 (Asana/Monday have this, but with AI agent actions as nodes it's novel)
- **Effort:** L | **Impact:** H
- **Dependencies:** Webhooks (exist), tasks, agents
- **Phase:** Next

#### C2. Smart Status Transitions with AI Validation
- **Problem:** Custom workflow statuses exist but transitions aren't enforced or AI-validated
- **Uniqueness:** 7/10 (AI reviewing whether a task truly meets "done" criteria)
- **Effort:** M | **Impact:** M
- **Dependencies:** Workflow statuses, AI chat
- **Phase:** Next

#### C3. Webhook-to-Agent Event Bridge
- **Problem:** External webhooks can't trigger agent actions automatically
- **Uniqueness:** 8/10 (inbound webhooks → agent task assignment)
- **Effort:** S | **Impact:** H
- **Dependencies:** Webhooks, agent events
- **Phase:** Now

#### C4. Natural Language Automation Rules
- **Problem:** Non-technical PMs can't create automations
- **Uniqueness:** 8/10 ("When a client goes on_hold, pause all their projects" in plain English)
- **Effort:** M | **Impact:** H
- **Dependencies:** AI chat, workflow automation engine
- **Phase:** Later

---

### D. Collaboration (3 ideas)

#### D1. Client Portal (External Stakeholder View)
- **Problem:** Clients table exists but clients can't self-serve; updates require manual communication
- **Uniqueness:** 6/10 (client portals exist, but AI-generated status summaries are novel)
- **Effort:** L | **Impact:** H
- **Dependencies:** Clients, projects, reports
- **Phase:** Next

#### D2. @-Mention Agents in Comments
- **Problem:** No way to invoke an agent from a task comment or note
- **Uniqueness:** 8/10 (natural language agent invocation within collaboration context)
- **Effort:** S | **Impact:** H
- **Dependencies:** Task comments, agents, AI chat
- **Phase:** Now

#### D3. Real-Time Collaborative Notes (CRDT)
- **Problem:** Notes use TipTap but no multiplayer editing
- **Uniqueness:** 4/10 (common in modern tools)
- **Effort:** L | **Impact:** M
- **Dependencies:** TipTap, Supabase Realtime
- **Phase:** Later

---

### E. Enterprise & Compliance (3 ideas)

#### E1. Full Audit Trail with Immutable Log
- **Problem:** Activity log exists but isn't comprehensive or tamper-proof; no compliance story
- **Uniqueness:** 5/10 (table stakes for enterprise, but audit of agent actions is novel)
- **Effort:** M | **Impact:** H
- **Dependencies:** Activity system
- **Phase:** Next

#### E2. Role-Based Agent Permissions (RBAC for Agents)
- **Problem:** Agents can potentially access any org data; no scoped permissions
- **Uniqueness:** 8/10 (agent RBAC is uncharted in PM tools)
- **Effort:** M | **Impact:** H
- **Dependencies:** Agents, RLS policies
- **Phase:** Next

#### E3. Data Residency & AI Provider Routing
- **Problem:** No control over where data is processed; compliance-sensitive orgs need regional routing
- **Uniqueness:** 7/10 (AI provider routing by data sensitivity)
- **Effort:** L | **Impact:** M
- **Dependencies:** AI models, gateways
- **Phase:** Later

---

### F. Analytics (2 ideas)

#### F1. Predictive Project Health Score
- **Problem:** Progress is manually tracked or auto-calculated from tasks; no predictive signals
- **Uniqueness:** 8/10 (ML-driven project risk prediction using agent + human activity patterns)
- **Effort:** M | **Impact:** H
- **Dependencies:** Projects, tasks, activity data
- **Phase:** Next

#### F2. AI-Generated Weekly Digest & Insights
- **Problem:** Stakeholders need manual status reports; existing report wizard requires effort
- **Uniqueness:** 7/10 (auto-generated contextual summaries combining human + agent work)
- **Effort:** S | **Impact:** H
- **Dependencies:** Reports, AI chat, projects
- **Phase:** Now

---

## 3. Top 10 Prioritized Roadmap

| Rank | Feature | Phase | Rationale |
|------|---------|-------|-----------|
| **1** | **B3. Agent Autonomy Levels & Guardrails** | Now | Core differentiator — enables trust in AI agents. Builds on existing approvals system. High impact, moderate effort. |
| **2** | **B1. Agent Cost Dashboard & Budget Caps** | Now | Cost fields already in DB. Users need spend visibility before scaling agent usage. Quick win with high trust-building value. |
| **3** | **A2. Sprint/Cycle Engine (Agent-Aware)** | Now | Fills critical PM gap while leveraging unique agent capacity planning angle. |
| **4** | **D2. @-Mention Agents in Comments** | Now | Small effort, massive UX improvement. Makes agents feel native to collaboration, not separate. |
| **5** | **F2. AI-Generated Weekly Digest** | Now | Low effort, high visibility feature. Leverages existing AI + reports infrastructure. |
| **6** | **C3. Webhook-to-Agent Event Bridge** | Now | Small effort, unlocks entire external integration story. Gateways + webhooks already exist. |
| **7** | **A1. Task Dependency Graph** | Now | Table-stakes PM feature needed for credibility with serious teams. |
| **8** | **B5. Multi-Agent Collaboration Protocols** | Next | Builds on agent hierarchy. Unlocks complex workflows where agents hand off work. |
| **9** | **C1. Visual Workflow Automations Builder** | Next | High-effort but high-impact. Differentiates from Linear (which lacks automations). |
| **10** | **F1. Predictive Project Health Score** | Next | Leverages unique data advantage (human + agent activity) for insights no competitor has. |

---

## 4. Strategic Themes

### The "Agent-Native PM" Moat
Features B1, B3, B4, B5, D2, E2 collectively create a **unique category**: a PM tool where AI agents are first-class team members with budgets, permissions, performance reviews, and collaboration protocols. No competitor has this.

### Phase Strategy
- **Now (0-3 months):** Ship 6 high-impact items that deepen the agent-native story + fill critical PM gaps (sprints, dependencies)
- **Next (3-6 months):** Build the automation engine, client portal, and predictive analytics that create stickiness
- **Later (6-12 months):** Multi-level subtasks, CRDT collab, NLP automations, data residency — polish and enterprise readiness

### Key Risk
The biggest risk is **spreading too thin** across both PM fundamentals and agent innovation. Recommendation: dedicate ~60% of effort to agent-native features (the moat) and ~40% to PM table-stakes (credibility).
