# Mission Control — Core Messaging Pack
### Marketing · Phase 4 T8 Deliverable

> **Status:** Draft (internal) — not for external publish  
> **Publish gate:** Phase 3 feature stability + Product Analyst T10 sign-off  
> **Source:** `docs/reports/marketing-phase4-t8-growth-narrative.md`

---

## Value Proposition

Mission Control gives engineering teams a single command center to operate, observe, and trust every AI agent running in their stack. Instead of piecing together logs, cron tabs, and Slack pings to know if your agents are healthy, you get live operational status, intelligent retry logic, configurable Definition-of-Done policies, and an audit trail — all without writing bespoke monitoring glue code.

**One-liner:**
> Mission Control: real-time visibility and autonomous reliability for every AI agent you run.

---

## Positioning Statement

**For** engineering leads and product teams **who** operate AI agents in production,  
**Mission Control** is an agent operations platform  
**that** provides real-time visibility, automatic retry, configurable reliability policies, and scheduled run management — without custom monitoring code.  
**Unlike** DIY logging + cron + Slack alerts,  
**Mission Control** makes production-grade agent operations the default, not the exception.

---

## Feature Highlights

### Live Ops Panel
The Live Ops Panel gives you a real-time view of every active agent session in your organization. See which agents are running, which are stalled, and which have hit blockers — without digging through logs. Updates arrive via WebSocket in under a second, so the panel reflects reality rather than a stale snapshot. When something goes wrong, you know immediately.

### Agent Calendar
The Agent Calendar renders your scheduled runs on a weekly grid, giving you a visual map of when agents fire and what their last-known status was. Planning maintenance windows, spotting clustering, or just answering "did it run today?" takes seconds instead of a SQL query. Pause/resume toggles and a manual trigger button give you direct operational control from the calendar itself.

### Auto Retry Loop
Transient failures shouldn't page your team. The Auto Retry loop automatically reattempts failed agent tasks according to configurable escalation rules, logging each attempt with task ID, attempt number, error, and timestamp. When retries are exhausted, it escalates — not silently discards.

### Definition of Done (DoD) Warn Mode
Not all task failures are loud. DoD Warn Mode lets you define what a successful agent run actually means, then flags runs that complete technically but miss your business criteria. DoD policies are seeded per project, results are persisted, and warnings surface in the Live Ops Panel so nothing slips through in silence.

### Memory Explorer *(Phase 3 — preview)*
Memory Explorer will surface the knowledge your agents have accumulated — searchable, filterable, and traceable. Every memory entry shows its source citation, confidence score, and the decision chain that relied on it. Audit agent reasoning, not just agent output.

---

## Before / After

| Scenario | Before | After |
|---|---|---|
| Agent goes stale at 2 AM | Found out from a user the next morning | Heartbeat Protocol flags it within 30s; Live Ops shows a blocker |
| Transient API failure mid-run | Silent failure or custom retry wrapper per agent | Auto Retry handles it; each attempt logged; escalates on exhaustion |
| Agent "succeeds" but produces wrong output | No detection until downstream data is corrupt | DoD policy catches it; warn mode flags it before it propagates |
| New team member needs to know what's scheduled | Read three READMEs and ask Slack | Agent Calendar — one view, all runs, live status |
| PM asks "is the feature working right now?" | "Let me check the logs" — 10 minutes | Live Ops Panel — answer in seconds |
| Pause a scheduled run for maintenance | Edit a database record or comment out a cron | Click pause on the calendar row |

---

## Launch Narrative

AI agents are becoming a core part of modern software products. Teams are shipping them faster than they're building infrastructure to operate them. The result: black-box reliability, bespoke monitoring per-agent, and on-call rotations that baby-sit cron jobs.

Operating AI agents is a discipline, not a side task. Just as APM matured into a category, agent operations needs dedicated tooling. The question isn't "how do we add monitoring to our agent?" — it's "how do we make every agent in our org production-ready by default?"

Mission Control is the ops layer every AI-agent team builds themselves, rebuilt once and available to everyone.

---

## Proof Points

| Claim | Status |
|---|---|
| Real-time Live Ops Panel | ✅ Shipped Phase 1 |
| Agent Calendar week view | ✅ Shipped Phase 1 |
| Auto Retry with escalation | ✅ Shipped Phase 1 |
| DoD warn mode | ✅ Shipped Phase 1 |
| Heartbeat Protocol / stale detection | ✅ Shipped Phase 1 |
| All Tasks cross-project view | ✅ Shipped Phase 1 |
| WebSocket updates <1s | 🔜 Phase 2 |
| Calendar pause/resume + manual trigger | 🔜 Phase 2 |
| Error monitoring in Live Ops Panel | 🔜 Phase 2 |
| Memory Explorer | 🔜 Phase 3 |

---

*Not final copy — will be revised after Phase 3 features stabilize. For full narrative assets, content angles, ICP messaging, and GTM acceptance criteria, see `docs/reports/marketing-phase4-t8-growth-narrative.md`.*
