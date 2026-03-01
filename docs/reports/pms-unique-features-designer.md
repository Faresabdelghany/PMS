# PMS — UX & Product Design Differentiators
*AI-Native Project Management — Premium Feature Proposals*

> **Prepared by:** Design Review (Subagent)  
> **Date:** 2026-02-27  
> **Scope:** UX surfaces audit + 13 differentiating feature proposals  
> **Status:** Strategy only — no implementation

---

## Part 1 — Current UX Surface Audit

### Surfaces Reviewed

| Surface | Route | Current State | Key Gap |
|---|---|---|---|
| **Dashboard** | `/` | Static KPI cards + two charts (bar completions, area status distribution), a Pending Approvals card, and a Gateway Status card | No "live" view of what agents are doing right now; metrics are retrospective |
| **Agents** | `/agents` | Sortable table with search, status badges (online/busy/idle/offline), agent type badges, tabbed list vs. network views; side panel for detail/edit | Agent cards feel like a directory, not a command center — no workload viz, no real-time streaming output |
| **Activity** | `/activity` | Chronological timeline with date separators; badge-filter by agent name; plain text entries | No grouping by project/task, no visual urgency, no diff-view of what changed |
| **Boards** | `/boards/[id]` | Detail page with four info cards (agent, gateway, created, updated) + quick-nav tabs to approvals/webhooks | Board feels like a configuration artifact, not an operational canvas |
| **Approvals** | `/approvals` | Tabbed (all/pending/approved/rejected) card list; collapsible payload JSON; approve/reject with optional reason dialog | No urgency ranking, no batch actions, requires drilling into each card individually |
| **Skills** | `/skills` | Listed in sidebar; marketplace sync spec exists | Skills feel disconnected from agent assignment UX |
| **AI Chat** | `/chat` | Chat history sidebar + main chat view; separate from other contexts | No contextual injection (e.g., "open this task in chat"), requires navigation switch |
| **Tasks / My Tasks** | `/tasks`, `/inbox` | Standard inbox + task list patterns | No AI-generated task breakdown, no visual "agent doing this now" indicator |
| **Projects** | `/projects` | Timeline, card, and row views with filtering | AI agents working on projects are invisible; no live progress streaming |
| **Memory** | `/memory` | Memory management for agents | Opaque to users — no way to see what agents "know" without diving in |
| **Sessions** | `/sessions` | Agent sessions listing | Functionally present but lacks replay/audit UX |

### Recurring Patterns & Gaps

1. **AI agents are invisible while working.** Status badges (online/busy) exist, but no surface shows *what* an agent is actually doing at this moment.
2. **Approvals lack urgency and batch ergonomics.** PMs must click into each card; there's no triage view.
3. **Activity is chronological but not actionable.** Entries are logs, not signals.
4. **Chat is isolated.** No way to invoke AI in-context (e.g., from a task, approval, or activity entry).
5. **Board/Agent relationship is architectural, not operational.** Boards show config; no live execution state.
6. **Skills feel administrative.** Assigning skills to agents happens in a form, not through any discovery or recommendation flow.

---

## Part 2 — UX Feature Proposals

*Scoring key:* **Impact** (H/M/L) × **Effort** (H/M/L) → category is **Quick Win**, **High Leverage**, or **Strategic Bet**

---

### Feature 1 — Live Agent Pulse Panel

**Category:** 🏃 Quick Win | **Impact:** H | **Effort:** L

**What it is:**  
A persistent "what's happening right now" strip at the top of the Dashboard and optionally the Activity page. Each online/busy agent gets a compact pulse card showing their current task title, a live elapsed-time ticker, and a pulsing dot in the agent's brand color.

**UI Pattern:**  
Horizontally scrollable row of micro-cards (think "Now Playing" cards). Each card ~200px wide:
```
┌────────────────────┐
│ 🤖 Aria · busy     │
│ "Drafting Q1 deck" │
│ ⏱ 4m 32s          │
│ [View] [Pause]     │
└────────────────────┘
```
Cards animate in/out as agents start/stop. Agent's status dot pulses with a CSS `@keyframes` ring animation when busy.

**User Flow:**
1. PM opens dashboard → immediately sees which agents are active.
2. Click "View" → deep-link to the activity timeline filtered to that agent.
3. Click "Pause" → triggers a soft interrupt (creates an approval request if agent is mid-task).

**Why it feels premium:**  
Turns agents from a settings list into visible co-workers.

---

### Feature 2 — Approval Triage Mode

**Category:** 🏃 Quick Win | **Impact:** H | **Effort:** L

**What it is:**  
A swipe/keyboard-driven triage view for the Approvals page. Instead of a scrollable card list, present one approval at a time as a large modal-style card. Users navigate with `←` / `→` arrow keys or swipe gestures, and approve/reject with `A` / `R` shortcuts (with an optional reason chip if rejecting).

**UI Pattern:**  
A "deck" metaphor — pending approvals stack behind the current one with subtle z-offset shadows. A mini progress indicator shows "3 of 12 pending."

**User Flow:**
1. User lands on `/approvals?mode=triage` (or clicks "Triage" toggle button).
2. Current card fills the center panel.
3. Press `A` → card flies up-right with a green checkmark ghost (similar to Tinder approve motion).
4. Press `R` → a small reason chip popover appears; user optionally types; card flies down with red tint.
5. After last card → confetti/success state with "All caught up 🎉"

**Bonus:** Keyboard shortcut hint bar appears at the bottom on first visit; dismissible.

**Why it feels premium:**  
High-volume approvals (common in AI-native PM) become effortless. Zero-click state management.

---

### Feature 3 — Contextual AI Sidebar ("Ask AI about this")

**Category:** ⚡ High Leverage | **Impact:** H | **Effort:** M

**What it is:**  
A globally accessible AI side drawer that opens in-context from any surface — right-click on a task → "Ask AI", hover on an approval → "Explain this", click the sparkle icon in an activity entry → "What triggered this?". The drawer pre-loads context (task body, agent ID, approval payload) so the AI responds without the user copy-pasting.

**UI Pattern:**  
A `Sheet` (sliding panel) from the right, 420px wide. The top header shows the context source ("Talking about: *Deploy API task*"). Below: standard chat thread. A "Send to Chat" button exports the conversation to `/chat` history.

**User Flow (from Approvals):**
1. Hovering an approval card reveals a small `✨ Explain` icon.
2. Click → Drawer slides in pre-populated: *"Explain why agent Aria requested: [approval title] with payload: [JSON summary]"*
3. AI responds inline.
4. User can follow up, then click "Approve based on this" — which confirms the approval without leaving the drawer.

**Why it feels premium:**  
AI is a co-pilot embedded in the workflow, not a separate destination.

---

### Feature 4 — Activity Feed "Diff View"

**Category:** ⚡ High Leverage | **Impact:** M | **Effort:** M

**What it is:**  
When an activity entry represents a data change (e.g., "Agent updated task description"), expand it to show a GitHub-style diff: removed lines in red, added lines in green. Currently activity shows only a title string.

**UI Pattern:**  
Collapsible diff block inside the activity timeline entry. Uses a monospace font with colored line-level highlights. For non-text changes (status, priority), shows a `before → after` pill pair: `[In Progress] → [Done]`.

**User Flow:**
1. User sees "Aria: Updated task description" in the timeline.
2. Click the entry → expands to show diff inline (no page navigation).
3. Diff has a "Revert" button that creates a new approval request for the rollback.

**Why it feels premium:**  
Transforms an audit log into a meaningful change narrative. Differentiates from every PM tool that shows "Updated at 3:42 PM."

---

### Feature 5 — Agent Workload Heatmap (Agents Page)

**Category:** ⚡ High Leverage | **Impact:** H | **Effort:** M

**What it is:**  
Replace or augment the current agents table view with an optional "Workload" view — a calendar-style heatmap (7 days × agents) showing task density per agent per day. Darker cells = more tasks. Clicking a cell opens a filtered activity/task view.

**UI Pattern:**  
Grid layout: rows = agents, columns = last 7 days + today. Each cell is a colored rectangle (e.g., cool blue → hot orange gradient). A legend at the bottom explains the scale. Toggle between "Table" / "Workload" via the existing tab pattern.

**Additional Visualization:**  
Each agent row header shows a mini sparkline (7-day task completion trend) and a live utilization percentage.

**User Flow:**
1. PM opens `/agents`, switches to "Workload" tab.
2. Sees at a glance which agents are overloaded (hot cells) vs. idle (empty).
3. Click overloaded cell → sees all tasks scheduled/completed that day for that agent.
4. Drag a task from one agent's cell to another → reassigns the task (with confirmation).

**Why it feels premium:**  
Capacity planning is the #1 PM pain point. Making agent workload spatial and visual is a major differentiator from any other AI PM tool.

---

### Feature 6 — Agent Org-Chart / Network Navigator

**Category:** ⚡ High Leverage | **Impact:** M | **Effort:** M

**What it is:**  
The current "Agent Network" view exists but needs UX elevation. Propose an interactive force-graph (or clean tree layout) showing agent hierarchy (supreme → lead → specialist), with live status rings, task counts on edges (e.g., "Aria → Kai: 3 tasks delegated"), and click-to-inspect.

**UI Pattern:**  
D3-style interactive graph embedded in the Agents page as a dedicated tab. Nodes are agent avatars (circle). Node border color = status color. Edges are animated dashed lines when delegation is active (tasks flowing). Sidebar opens on node click showing agent snapshot.

**User Flow:**
1. PM opens Agents → "Network" tab.
2. Sees org-chart with live data.
3. Right-click edge → "View delegated tasks" → filtered task list.
4. Click a node → quick-edit panel for that agent.

**Delight detail:**  
When an agent transitions from idle to busy, their node subtly "breathes" (scale pulse animation).

---

### Feature 7 — Smart Inbox with AI Triage

**Category:** 🎯 Strategic Bet | **Impact:** H | **Effort:** H

**What it is:**  
Transform `/inbox` from a notification list into an AI-triaged priority queue. The AI reads each inbox item (approval, mention, task update) and auto-tags it with urgency (🔴 Now / 🟡 Today / 🟢 Later) and intent (Action needed / FYI / Blocked). PM sees a pre-sorted, pre-labeled inbox.

**UI Pattern:**  
Three vertical lanes (kanban-style): "Now", "Today", "Later". Items auto-populate into lanes based on AI scoring. Each item shows: source agent, summary (not raw title), urgency reason ("Aria is blocked — client response needed"), and CTA button. The AI summarization appears as a soft italic line below the item title.

**User Flow:**
1. PM opens Inbox → sees pre-triaged lanes (not a flat chronological list).
2. "Now" lane has 2 critical items: a blocked task + a time-sensitive approval.
3. PM clicks the blocked task → one-click "Unblock" which messages the relevant agent.
4. At end of day, "Later" items auto-roll to next day or snooze.

**Why it's a strategic bet:**  
Requires AI scoring pipeline. High engineering complexity but creates a fundamentally new interaction model.

---

### Feature 8 — Task Breakdown Generator (In-Context)

**Category:** 🏃 Quick Win | **Impact:** H | **Effort:** L

**What it is:**  
Inside any task detail view, a "✨ Break down with AI" button generates a numbered sub-task list from the task description using the configured AI model. User sees a preview, can edit, then confirms — creating child tasks with one click.

**UI Pattern:**  
The button appears in the task action bar. On click, a popover/sheet shows the AI-generated list as editable chips. Each chip has a checkbox (include/exclude), an editable text field, and an assignee picker (human or agent). "Create X tasks" confirm button at the bottom.

**User Flow:**
1. User creates a task: "Build authentication module".
2. Clicks "✨ Break down".
3. AI returns: 1. Design auth schema, 2. Implement OAuth2 flow, 3. Write tests, 4. Deploy to staging.
4. User unchecks #4 (handles manually), then clicks "Create 3 tasks."
5. Sub-tasks appear as children in the board view.

**Why it feels premium:**  
Removes the biggest friction in PM — decomposing work. Feels like having a staff engineer next to you.

---

### Feature 9 — Board "Live Execution Canvas"

**Category:** 🎯 Strategic Bet | **Impact:** H | **Effort:** H

**What it is:**  
Transform the Board detail page from a static config form into a visual execution canvas. Show the board's configured workflow as a flowchart (trigger → agent steps → approval gates → completion), with live "current position" highlighted — like a Gantt meets a circuit board.

**UI Pattern:**  
A read-only swimlane diagram: rows = pipeline stages (Ingest, Process, Approve, Deliver). Each stage has a node showing: step name, responsible agent avatar, status (pending/running/done/blocked), and timestamp. The active node glows with a pulsing ring. Arrows between nodes animate when data is flowing.

**User Flow:**
1. PM opens a board that's currently executing.
2. Sees the pipeline: Step 1 (Webhook received) ✅ → Step 2 (Aria: processing) 🔄 → Step 3 (Approval needed) ⏳
3. Click Step 3 → expands to show the pending approval with inline approve/reject.
4. After approval, watches Step 4 activate in real time.

**Delight detail:**  
Completed stages show a small confetti burst (CSS only, no library needed) when they turn green.

**Why it's a strategic bet:**  
Requires significant orchestration data modeling. Extremely differentiating for operational AI teams.

---

### Feature 10 — Skill Recommendation Engine

**Category:** ⚡ High Leverage | **Impact:** M | **Effort:** M

**What it is:**  
When creating or editing an agent, the system recommends skills based on the agent's role, description, and current task backlog. Skills are shown as suggestion chips: "Recommended for a Marketing Lead: SEO Analysis, Content Generation, Analytics Reporting." One-click to add.

**UI Pattern:**  
In the agent edit panel (currently a form with a skill picker), add a "Recommended Skills" section above the picker. Chips are styled differently from selected skills (dashed border vs. solid). A small tooltip explains *why* the skill was recommended ("3 tasks in queue require Content Generation").

**User Flow:**
1. User creates agent with role "Marketing Lead."
2. System shows 4 recommended skills in a "Suggestions" chip group.
3. User clicks to add 3 of them.
4. The skill picker below reflects the selection.

**Why it feels premium:**  
Reduces the cognitive load of skill configuration. Makes the system feel like it "knows" the user's goals.

---

### Feature 11 — Memory Timeline (Agent Memory UX)

**Category:** ⚡ High Leverage | **Impact:** M | **Effort:** M

**What it is:**  
Transform the Memory page from a flat list into a visual timeline showing when each memory was written, what triggered it (task ID, conversation ID), and an importance score. Users can "pin" key memories (so agents prioritize them) and "archive" stale ones.

**UI Pattern:**  
A vertical timeline (similar to the Activity page but richer). Each memory entry shows: timestamp, source context (task/chat), content preview, and a relevance score bar (filled based on how recently/frequently the memory was accessed). Pinned memories float to the top with a 📌 icon.

**User Flow:**
1. User opens Memory for a specific agent.
2. Sees timeline: 3 months of memories, organized chronologically.
3. Notices a stale memory from January about an old client → archives it.
4. Pins "Always respond in formal tone for client Acme Corp."
5. Agent's next response to Acme is automatically more formal.

**Why it feels premium:**  
Makes agent memory legible and controllable. No other PM tool surfaces this. Creates trust in AI by making it auditable.

---

### Feature 12 — Session Replay Viewer

**Category:** 🎯 Strategic Bet | **Impact:** M | **Effort:** H

**What it is:**  
For any completed agent session, a "Replay" mode shows a step-by-step playback of what the agent did — tool calls, decisions made, data read/written — as an annotated transcript with timestamps. Think rrweb meets agent observability.

**UI Pattern:**  
A two-panel layout: left = step list (numbered, collapsible), right = detail view for the selected step. Each step shows: action type (tool call / decision / output), the input/output, any errors, and elapsed time. A "playback bar" at the bottom allows scrubbing through the session timeline.

**User Flow:**
1. PM sees a task that completed unexpectedly.
2. Opens the session that produced it.
3. Clicks "Replay" → sees step-by-step what the agent did.
4. Identifies step 7: agent made a wrong assumption about the task due to an ambiguous brief.
5. PM annotates step 7 with "Improve prompt" → creates a linked issue/task.

**Why it's a strategic bet:**  
Critical for trust, debugging, and compliance. Deeply differentiating for enterprise buyers.

---

### Feature 13 — Project Health Score Card

**Category:** 🏃 Quick Win | **Impact:** H | **Effort:** L

**What it is:**  
Every project gets an AI-generated "Health Score" (0–100) displayed as a circular score badge on the project card and in the project header. The score factors in: completion rate, overdue task count, agent activity level, and client feedback recency. Hovering the badge shows a breakdown.

**UI Pattern:**  
The circular `ProgressCircle` component (already in the codebase at `components/progress-circle.tsx`) can be styled into the health badge. Color: green (80–100), amber (50–79), red (<50). On hover: a small popover lists the 4 contributing factors with individual mini-scores.

**User Flow:**
1. PM opens Projects list → sees health badges on every project card.
2. One project shows a red badge (34). Hover → "3 overdue tasks, no agent activity in 5 days, last client check-in: 12 days ago."
3. Click "Fix" CTA in the popover → opens a prioritized action list: "Assign agent, follow up with client, reschedule milestone."
4. PM takes actions → health score updates on next refresh.

**Why it feels premium:**  
Executives and PMs want one number that tells them if a project is healthy. Delivering that with AI transparency is a key premium differentiator.

---

## Part 3 — Prioritization Matrix

| # | Feature | Impact | Effort | Category | Priority |
|---|---|---|---|---|---|
| 1 | Live Agent Pulse Panel | H | L | 🏃 Quick Win | **P0** |
| 2 | Approval Triage Mode | H | L | 🏃 Quick Win | **P0** |
| 13 | Project Health Score Card | H | L | 🏃 Quick Win | **P0** |
| 8 | Task Breakdown Generator | H | L | 🏃 Quick Win | **P0** |
| 3 | Contextual AI Sidebar | H | M | ⚡ High Leverage | **P1** |
| 4 | Activity Feed Diff View | M | M | ⚡ High Leverage | **P1** |
| 5 | Agent Workload Heatmap | H | M | ⚡ High Leverage | **P1** |
| 6 | Agent Network Navigator | M | M | ⚡ High Leverage | **P1** |
| 10 | Skill Recommendation Engine | M | M | ⚡ High Leverage | **P1** |
| 11 | Memory Timeline | M | M | ⚡ High Leverage | **P2** |
| 7 | Smart Inbox with AI Triage | H | H | 🎯 Strategic Bet | **P2** |
| 9 | Board Live Execution Canvas | H | H | 🎯 Strategic Bet | **P3** |
| 12 | Session Replay Viewer | M | H | 🎯 Strategic Bet | **P3** |

---

## Part 4 — Quick Wins Sprint (Recommended First 2 Weeks)

Focus on the four **P0** features. All are additive (no breaking changes), use existing component primitives, and create immediate "wow" moments for first-time users.

### Sprint Plan

**Week 1:**
- [ ] **Feature 1** — Live Agent Pulse Panel on Dashboard
  - Uses existing `status` field + `last_active_at` from agents table
  - Leverages existing `usePooledProjectsRealtime` / `RealtimeProvider` hook
  - New component: `AgentPulseStrip` on the dashboard page
- [ ] **Feature 13** — Project Health Score Card
  - Uses existing `ProgressCircle` component
  - New server action: `getProjectHealthScore(projectId)` — computed from existing data
  - Overlay on existing `ProjectCard` component

**Week 2:**
- [ ] **Feature 2** — Approval Triage Mode
  - New URL param: `/approvals?mode=triage`
  - New `ApprovalsTriageView` component alongside existing `ApprovalsClient`
  - Keyboard shortcuts handled by a `useHotkeys` hook
- [ ] **Feature 8** — Task Breakdown Generator
  - New `TaskBreakdownButton` in task detail actions
  - Calls existing AI chat infrastructure with a structured prompt
  - Renders result in a `Sheet` popover with editable chips

---

## Part 5 — Design Principles for AI-Native PM

These principles should guide all future UX decisions in PMS:

1. **Agents should feel alive, not static.** Every surface where an agent appears should signal its current state — not just a badge, but an implicit awareness of what it's doing.

2. **Human time is precious; AI should reduce friction, not shift it.** Bulk operations, keyboard shortcuts, and one-click actions are table stakes. Triage modes and smart defaults reduce click cost.

3. **Transparency builds trust.** Every AI action should be reviewable, revertable, and explainable. Surface diffs, memory timelines, session replays — make the black box legible.

4. **Context should travel with you.** AI assistance shouldn't require a context switch. The AI drawer, in-context summaries, and pre-loaded chat contexts mean the user never has to mentally re-orient.

5. **Health and risk should be visible without being overwhelming.** Health scores, urgency tagging, and workload heatmaps surface signal at a glance. Never make the PM hunt for "is this okay?"

---

*This document is a design proposal only. No implementation has been performed. All component names and UI patterns are illustrative and should be validated with user research before development.*
