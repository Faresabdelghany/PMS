# Mission Control — Growth Narrative Assets
### Phase 4 · Task T8 · Marketing Track

> **Status:** Draft — not for publish. Gated on Phase 3 feature stability.  
> **Date:** 2026-03-01 · **Author:** Marketing (subagent)  
> **Deliverable for:** `docs/marketing/mission-control-narrative.md` (final destination after review)  
> **Reviewed by:** Product Analyst (T10 gate)

---

## 1. Core Value Proposition

> *2–3 sentences for headline, hero copy, or changelog summary.*

Mission Control gives engineering teams a single command center to operate, observe, and trust every AI agent running in their stack. Instead of piecing together logs, cron tabs, and Slack pings to know if your agents are healthy, you get live operational status, intelligent retry logic, configurable Definition-of-Done policies, and an audit trail — all without writing bespoke monitoring glue code.

**One-liner variant (for social / changelog header):**
> Mission Control: real-time visibility and autonomous reliability for every AI agent you run.

---

## 2. Ideal Customer Profile (ICP) — Messaging by Segment

### Segment A — Engineering Lead / Platform Engineer
*Manages a team building or operating AI agents at scale (5–50+ agents, multiple orgs)*

**Pain:** Agents are black boxes. Something breaks at 3 AM and you find out from a user, not a monitor. Retry logic is copy-pasted per-agent. Heartbeat checks are TODO.

**Message:** "Stop flying blind. Mission Control gives you a live ops dashboard, automatic retry with escalation, and heartbeat-based stale detection — so your on-call rotation sleeps instead of babysitting cron jobs."

**Proof points to emphasize:**
- Live Ops Panel updates in <1s (WebSocket, Phase 2)
- Retry loop with configurable escalation path — no one-off scripts needed
- Heartbeat Protocol surfaces stale agents within 30s — before users do

---

### Segment B — Product Manager / AI Product Owner
*Responsible for reliability and business outcomes of agent-powered features*

**Pain:** Can't answer "Is the agent working right now?" without pinging engineering. No visibility into failure rates or task completion trends.

**Message:** "Know what your agents are doing — without a Slack thread. Mission Control's DoD (Definition of Done) policies let you codify what 'done' means for each agent, and the calendar view shows you scheduled runs at a glance."

**Proof points to emphasize:**
- DoD warn mode catches silent failures before they ship to users
- Calendar view — week-level visibility into scheduled agent runs
- Pause/resume + manual trigger controls (Phase 2) — direct control without a deployment

---

### Segment C — Solo Developer / Indie AI Builder
*Building agent-powered products solo or in small teams; speed > ceremony*

**Pain:** Wiring up monitoring, retry, and scheduling takes longer than the agent itself. Wants production-grade ops without building an ops platform.

**Message:** "Ship agents like a platform team, even when you're a team of one. Mission Control's protocol handles retry, heartbeat, and scheduling so you don't have to."

**Proof points to emphasize:**
- Drop-in heartbeat protocol — no external monitoring service needed
- Auto Retry built in — no custom retry wrappers
- All Tasks view across all projects — one place, all agents

---

## 3. Feature Highlight Blurbs

*One paragraph per feature. Suitable for feature pages, docs landing, or changelog entries.*

### 🔴 Live Ops Panel
The Live Ops Panel gives you a real-time view of every active agent session in your organization. See which agents are running, which are stalled, and which have hit blockers — without digging through logs. In Phase 2, updates arrive via WebSocket in under a second, so the panel reflects reality rather than a five-second-old snapshot. When something goes wrong, you know immediately.

### 📅 Agent Calendar
The Agent Calendar renders your scheduled runs on a weekly grid, giving you a visual map of when agents fire and what their last-known status was. Planning maintenance windows, spotting clustering, or just answering "did it run today?" takes seconds instead of a SQL query. Phase 2 adds pause/resume toggles and a manual trigger button per run — direct operational control from the calendar itself.

### 🔁 Auto Retry Loop
Transient failures shouldn't page your team. The Auto Retry loop automatically reattempts failed agent tasks according to configurable escalation rules, logging each attempt with task ID, attempt number, error, and timestamp. When retries are exhausted, it escalates — not silently discards. This turns one-off failure handling from a per-agent implementation chore into an organization-wide policy.

### ✅ Definition of Done (DoD) Warn Mode
Not all task failures are loud. DoD Warn Mode lets you define what a successful agent run actually means, then flags runs that complete technically but miss your business criteria. It's the difference between "the agent finished" and "the agent finished correctly." DoD policies are seeded per project, results are persisted, and warnings surface in the Live Ops Panel so nothing slips through in silence.

### 🧠 Memory Explorer *(Phase 3 — narrative preview)*
Memory Explorer will surface the knowledge your agents have accumulated — searchable, filterable, and traceable. Every memory entry shows its source citation, confidence score, and the decision chain that relied on it. For the first time, you'll be able to answer "why did the agent do that?" by following the provenance trace rather than re-reading logs. Read-only in MVP; designed for auditability before editability.

---

## 4. Differentiation Narrative

### "Before Mission Control" vs "After Mission Control"

| Scenario | Before | After |
|---|---|---|
| **Agent goes stale at 2 AM** | Engineer finds out from a user the next morning. Logs searched manually. | Heartbeat Protocol flags the stale session within 30s. Live Ops Panel shows a blocker. On-call gets a targeted alert, not a mystery. |
| **Transient API failure mid-run** | Agent fails silently or crashes. PM asks "did it run?". Engineer writes a one-off retry wrapper. | Auto Retry reattempts automatically, logs each attempt, escalates if retries exhausted. No custom code. |
| **Agent "succeeds" but produces wrong output** | No one notices until downstream data is corrupt. | DoD policy catches the failure at the policy layer. Warn mode flags it in the panel. Bug is caught before it propagates. |
| **New team member needs to know what's scheduled** | Read three README files and a cron tab. Ask Slack. | Open Agent Calendar. One view, all runs, live status badges. |
| **PM asks "is the feature working right now?"** | "Let me check the logs" — 10 minutes later. | Live Ops Panel. Answer in seconds. No engineering required. |
| **You need to pause a scheduled run for maintenance** | Edit a database record directly or comment out a cron. | Click pause on the calendar row. Click again to resume. |

---

## 5. Launch Story

### Narrative Arc

**Act 1 — The Problem (Relatable Frustration)**
AI agents are becoming a core part of modern software products. Teams are shipping them faster than they're building infrastructure to operate them. The result: black-box reliability, bespoke monitoring per-agent, and on-call rotations that baby-sit cron jobs. Every team reinvents the same wheels: retry logic, heartbeat checks, scheduled run visibility.

**Act 2 — The Insight (Category Framing)**
Operating AI agents is a discipline, not a side task. Just as application performance monitoring matured into a category, agent operations needs dedicated tooling. The question isn't "how do we add monitoring to our agent?" — it's "how do we make every agent in our org production-ready by default?"

**Act 3 — The Product (Mission Control)**
Mission Control is the ops layer every AI-agent team builds themselves, rebuilt once and available to everyone. Live status. Automatic retry. Configurable success definitions. Heartbeat-based stale detection. Scheduled run control. And coming in Phase 3, searchable agent memory with provenance tracing. It's not a logger. It's a command center.

**Act 4 — The Call (Low-friction CTA)**
If you're running AI agents in production — or planning to — Mission Control is where you should start before you write a single line of monitoring code.

---

## 6. Content Angles

*Specific pitches for blog posts, social threads, or changelog entries.*

| Angle | Format | Hook |
|---|---|---|
| **"We stopped babysitting our cron jobs"** | Blog post / case study | Engineering team story — before/after with Mission Control's retry + heartbeat |
| **"What 'done' means when AI is doing the work"** | Thought leadership | DoD as a concept — why "task completed" ≠ "task succeeded" |
| **"The 3 AM test for AI agents"** | Short-form / social | If your agent breaks at 3 AM, who knows first — you or your users? |
| **"Why we built a calendar for AI agents"** | Product story | Calendar view origin — making scheduled work visible to non-engineers |
| **"Agent reliability is a culture problem, not a tooling problem"** | Opinion piece | DoD policies as organizational contracts, not just code |
| **"Retry isn't free"** | Technical post | The hidden cost of silent failures and why escalation matters |
| **"Provenance: the feature AI products are missing"** | Phase 3 preview | Memory Explorer and the "why did it do that?" question |

---

## 7. Positioning Statement (Full)

**For** engineering leads and product teams **who** operate AI agents in production,  
**Mission Control** is an agent operations platform  
**that** provides real-time visibility, automatic retry, configurable reliability policies, and scheduled run management — without custom monitoring code.  
**Unlike** DIY logging + cron + Slack alerts,  
**Mission Control** makes production-grade agent operations the default, not the exception.

---

## 8. Proof Points (At Launch)

*Claims backed by shipped Phase 1 features. Mark Phase 2 items clearly.*

| Claim | Status | Evidence |
|---|---|---|
| Real-time Live Ops Panel | ✅ Phase 1 shipped | Live Ops Panel, reviewer-approved commit `d4d545e` |
| Agent Calendar (week view) | ✅ Phase 1 shipped | Calendar week view, same commit |
| Auto Retry with escalation | ✅ Phase 1 shipped | Retry loop + escalation path |
| DoD warn mode | ✅ Phase 1 shipped | Policy seed + results persistence |
| Heartbeat Protocol (stale detection) | ✅ Phase 1 shipped | Session upsert + stale detection |
| All Tasks cross-project view | ✅ Phase 1 shipped | MyTasksPage "all" mode |
| Live updates <1s (WebSocket) | 🔜 Phase 2 | Replaces 5s polling — T4 |
| Calendar pause/resume + manual trigger | 🔜 Phase 2 | New controls — T5 |
| Error monitoring in Live Ops Panel | 🔜 Phase 2 | Error count badge — T6 |
| Memory Explorer (search + provenance) | 🔜 Phase 3 | UX concept in progress — T7 |

---

## 9. Acceptance Criteria — Go-to-Market Readiness

> These gates must pass before any external publish of Mission Control marketing assets.

- [ ] **Feature accuracy:** All claims in sections 3 and 8 match shipped or committed features. No aspirational copy presented as current.
- [ ] **ICP alignment:** Product Analyst confirms the three ICP segments match actual user research or design intent.
- [ ] **Proof point verification:** Phase 1 production validation (T1) completed — any failed items removed from proof points or marked "in remediation."
- [ ] **Phase 2 claims labeled:** All Phase 2 features clearly marked 🔜 or "coming soon" — not presented as GA.
- [ ] **Phase 3 preview gated:** Memory Explorer copy framed as preview/roadmap only. No commitments on timeline.
- [ ] **No contradictions with DoD spec:** Feature descriptions match actual implemented behavior (verified against `specs/phase1-production-validation/spec.md`).
- [ ] **Legal/brand review:** One pass by someone with brand authority before any external channel publish.
- [ ] **Product Analyst sign-off:** T10 gate passed — narrative aligns with product direction.
- [ ] **Phase 3 completion gate:** Full publish (blog, landing page, changelog) held until Phase 3 ships or Product Analyst explicitly unlocks earlier.

---

## 10. Recommended Next Steps

1. **Product Analyst review (T10):** Validate ICP segments and feature descriptions against product intent.
2. **After T1 (prod validation):** Update proof points table if any Phase 1 items fail validation.
3. **Copy to final destination:** Move/adapt to `docs/marketing/mission-control-narrative.md` after T10 sign-off.
4. **Phase 2 completion:** Upgrade Phase 2 items from 🔜 to ✅ as T3–T6 ship and pass T9 review.
5. **Phase 3 UX handoff (T7):** Use Memory Explorer wireframes to finalize the Phase 3 narrative preview section before any external preview.

---

*Draft — internal only. Not for external distribution until T10 product sign-off and Phase 3 completion gate cleared.*
