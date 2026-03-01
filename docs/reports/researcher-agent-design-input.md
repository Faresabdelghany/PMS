# Researcher Agent — UX Design Input

**Date:** 2026-02-28  
**Author:** Design Subagent  
**Status:** Ideation / Design Input — No Implementation  
**Scope:** Dedicated Researcher Agent surface within PMS (Next.js + Supabase + shadcn/ui + Phosphor icons)

---

## 0. Context & Purpose

PMS already has 18 agents, an approvals workflow, gateway infrastructure, and an `agent_events` + `agent_activities` feed. The Researcher Agent is a **specialist-tier agent** that accepts an open-ended research question, conducts multi-source scanning, assembles an evidence board, and produces a one-pager report with a traceable decision log. It differs from the existing AI Chat in that it operates **asynchronously, leaves a permanent record, and makes its reasoning legible**.

**Primary users:**
- Project Managers: "Does this client belong in a different segment?"
- Product leads: "What do competitors charge for feature X?"
- Executives: "Should we pursue market Y?"

**Core design promise:** The user asks a question and gets back a defensible answer — not just text, but a structured artifact with sources, confidence scores, and a visible chain of reasoning.

---

## 1. Information Architecture

```
/agents/researcher/
├── (list)            → Research Runs index
│   ├── Active runs (live progress)
│   └── Completed runs (archived)
│
├── new/              → Intake form (Research Brief)
│
└── [runId]/
    ├── overview      → Live progress + status banner
    ├── evidence/     → Evidence Board (sources + findings)
    ├── one-pager/    → Synthesized report
    └── trace/        → Decision Trace (step-by-step reasoning log)
```

**Sidebar placement:** Under Agents → sub-item "Researcher" (specialist badge). On mobile collapses to the Agents group. Nav label: "Researcher". Icon: `MagnifyingGlass` (Phosphor).

**Data model sketch (no implementation):**
```
research_runs           → id, org_id, title, question, scope_params, status, created_by, agent_id, started_at, completed_at
research_sources        → id, run_id, url, title, source_type, retrieved_at, relevance_score, raw_excerpt
research_findings       → id, run_id, source_id, claim, confidence (low/medium/high), category, supporting_quotes[]
research_one_pager      → id, run_id, summary, sections (jsonb), confidence_overall, generated_at
research_trace_steps    → id, run_id, step_order, action_type, description, metadata (jsonb), timestamp
```

---

## 2. Key Screens & Components

---

### 2.1 Research Runs Index (`/agents/researcher`)

**Purpose:** Overview of all research activity for the org. Entry point and status dashboard.

**Layout:**
- `PageHeader` title="Researcher" with "New Research" CTA button (primary) top-right
- Two tabs: **Active** | **Completed**
- Card grid (responsive 1→2→3 cols)

**Run Card anatomy:**
```
┌─────────────────────────────────────────────┐
│ [🔍] Research Question (truncated 2 lines)  │
│ ─────────────────────────────────────────── │
│ Status badge  ·  Started 4h ago             │
│ Progress bar (active only)                  │
│ [12 sources] [8 findings] [3 sections]      │
│ Requested by: [avatar] Fares                │
└─────────────────────────────────────────────┘
```

**Status badges** (consistent with PMS status system):
- 🟡 `queued` — Waiting for agent availability
- 🔵 `scanning` — Agent actively retrieving sources
- 🟠 `synthesizing` — Agent building findings and one-pager
- ✅ `completed` — Full report available
- 🔴 `failed` — Error during run
- ⏸️ `paused` — Awaiting user clarification

**Interaction:** Click card → navigates to `/agents/researcher/[runId]/overview`.

**Empty state:** "No research runs yet. Ask a question and the Researcher agent will build you a sourced, structured answer." + "New Research" button.

---

### 2.2 Intake Screen (`/agents/researcher/new`)

**Purpose:** Define the research question, scope, and constraints before the agent starts. This is the contract between user and agent.

**Layout:** Centered form card (max-w-2xl), consistent with project creation wizard aesthetic. **Not** a multi-step wizard — single focused page to reduce friction.

**Fields:**

#### Research Question (required)
- Large textarea, placeholder: "What are you trying to understand or decide?"
- Character limit: 500. Live count shown.
- Example hint below: *e.g. "What do top-3 agency PM tools charge for client portals, and what does each include?"*

#### Research Type (required)
Radio group of 4 types with icons:
| Type | Icon | When to use |
|------|------|-------------|
| **Competitive** | `Trophy` | Analyze competitors, pricing, positioning |
| **Market** | `ChartLine` | Market size, trends, buyer behavior |
| **Technical** | `Code` | Stack choices, architecture tradeoffs |
| **Stakeholder** | `UsersThree` | Client/team background, org signals |

#### Scope (optional accordion — collapsed by default)
- **Source types**: Checkboxes — Web Search, Academic papers, Company websites, News, Social media
- **Date range**: "Limit to content from" — dropdown: Any time / Past 6 months / Past 1 year / Custom
- **Language**: Default "English only" (single select)
- **Depth**: Slider — Quick (5–10 sources) · Standard (15–25) · Deep (40+ sources, longer runtime)
- **Confidence threshold**: Minimum confidence to include a finding (Low/Medium/High)

#### Context (optional)
- **Link to project**: Combobox → existing PMS project. Findings and the one-pager will be attached to that project.
- **Link to task**: Combobox → existing task. Creates a subtask chain under it.
- **Free context**: Text field — "Any background the agent should know before starting."

#### Urgency
- Toggle: **Async (run in background)** / **Watch live (stay on page)**
- Async adds to queue; Watch live opens overview page immediately.

**Submit button:** "Start Research" — triggers agent dispatch, navigates to overview page.

**Estimated time hint:** Based on depth selection: "~3–5 minutes for Standard depth."

---

### 2.3 Overview Screen (`/agents/researcher/[runId]/overview`)

**Purpose:** Live status and progress during active runs. Entry hub for all sub-views on completion.

**Layout:** Split — left sidebar navigation for sub-pages (Evidence / One-Pager / Trace) + main content area.

**Status Banner (top of main content):**
```
┌──────────────────────────────────────────────────────────┐
│ 🔵 SCANNING  ·  Started 2m ago  ·  Est. 4 min remaining │
│ ━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░  62%                 │
│ [Pause]  [Cancel]                                        │
└──────────────────────────────────────────────────────────┘
```
- Progress % calculated from: sources_retrieved / target_sources + synthesis_steps_done
- Status transitions animate smoothly (no full page reload)

**Live Activity Feed (primary content when active):**
A vertical timeline of `research_trace_steps` updating in real-time via Supabase Realtime:
```
  12:04:31  🔍  Queried: "client portal PM tools pricing 2025"
  12:04:38  📄  Retrieved source: notion.so/blog/...  [relevance: 0.87]
  12:04:39  📄  Retrieved source: linear.app/pricing  [relevance: 0.92]
  12:04:45  ⚡  Finding extracted: "Linear charges $8/seat for basic, no client portal tier"
  12:04:47  ⚠️  Low relevance source skipped: reddit.com/r/...  [0.31]
  12:05:02  🧪  Evaluating source credibility: clickup.com
```

Each entry has:
- Timestamp (relative when fresh, absolute on hover)
- Action icon (color-coded: blue=retrieval, green=finding, yellow=skip, red=error, purple=synthesis)
- Terse description
- Expandable detail (click to expand metadata / raw excerpt)

**Summary stats strip (below feed):**
```
Sources checked: 14    Sources accepted: 11    Findings: 8    Skipped: 3
```

**Completion state (after `status = completed`):**
- Banner becomes green ✅ "Complete — Report ready"
- Three action cards replace the feed:
  1. **Evidence Board** → 11 sources, 8 findings
  2. **One-Pager Report** → 3 sections, ~450 words
  3. **Decision Trace** → 22 reasoning steps

---

### 2.4 Evidence Board (`/agents/researcher/[runId]/evidence`)

**Purpose:** Show all sources retrieved and findings extracted. Allows user to validate, reject, or annotate evidence before accepting the one-pager.

**Layout:** Two-panel split — Sources list (left, 40%) + Finding detail (right, 60%).

#### Left Panel: Sources List

Filter bar:
- Source type chips: All | Web | Academic | News | Company
- Sort: Relevance (default) | Date | Domain

Source card:
```
┌─────────────────────────────────────────────┐
│ 🌐  linear.app/pricing                       │
│ Linear — Pricing & Plans                     │
│ Relevance: ████████░░  0.92  ·  4 findings  │
│ Retrieved 2026-02-28 12:04                  │
│ [View findings] [Open URL]                  │
└─────────────────────────────────────────────┘
```
- Color-left-border: green (high relevance) / yellow (medium) / red (low, kept because content matched)
- Rejected sources shown with strikethrough and "Skipped — low relevance" label

#### Right Panel: Findings from Selected Source

When a source is selected:
- Source URL + title header with favicon
- Excerpt block: the raw retrieved snippet (monospace, scrollable, max 400px tall)
- Findings extracted from this source as cards:

```
┌─────────────────────────────────────────────┐
│ Finding                              🟢 HIGH │
│ ─────────────────────────────────────────── │
│ Linear's Business plan ($16/seat) does not  │
│ include a client-facing portal or external  │
│ stakeholder view.                           │
│ ─────────────────────────────────────────── │
│ Category: Competitive pricing               │
│ Quote: "...no external access for clients   │
│ in Business..."                             │
│ [Accept] [Reject] [Edit claim] [Annotate]   │
└─────────────────────────────────────────────┘
```

**Confidence badges:**
- 🟢 HIGH — Multiple corroborating sources, direct quote
- 🟡 MEDIUM — Single source, reasonable inference
- 🔴 LOW — Indirect, estimated, or dated

**User actions on findings:**
- **Accept**: finding moves to "Accepted" bucket (green indicator). One-pager uses only accepted findings.
- **Reject**: finding excluded. Reason prompt (optional): "Outdated / Off-topic / Inaccurate / Other"
- **Edit claim**: inline edit to refine the extracted claim while preserving source link
- **Annotate**: free-text note attached to finding (visible in trace)

**Bulk actions bar (appears when 2+ findings checked):**
- Accept all / Reject all / Export selected

**Evidence summary strip (top of right panel, visible always):**
```
Total findings: 8   Accepted: 6   Pending: 2   Rejected: 0
Confidence breakdown: 🟢 3  🟡 4  🔴 1
```

---

### 2.5 One-Pager Report (`/agents/researcher/[runId]/one-pager`)

**Purpose:** The synthesized, human-readable deliverable. Structured, concise, shareable.

**Layout:** Document layout (max-w-3xl centered, generous line-height), similar to the existing Report Detail page style.

**One-Pager Anatomy:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [RESEARCH TYPE badge]  [CONFIDENCE: 84%]
  Research Question
  ──────────────────────────────────────
  Does Linear/Asana/ClickUp offer client 
  portals, and what does each include?
  
  Generated: 2026-02-28 · by Researcher Agent
  Based on: 6 accepted findings · 11 sources
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Executive Summary (3–4 sentences)
Auto-generated paragraph. Each sentence has a footnote 
marker [1] linked to the supporting finding.

## Key Findings
Bullet list, each item:
  • Finding claim [1][3]  —  🟢 HIGH confidence

## Competitive Comparison (if type=Competitive)
  Auto-rendered comparison table from finding categories.

## Nuances & Caveats
  • Sources skewed toward 2024–2025 data
  • No direct pricing confirmation for Asana enterprise tier

## Recommended Next Steps
  (AI-suggested, editable by user)
  1. Book demo with ClickUp to confirm client portal specs
  2. Create task: design PMS client portal MVP

## Sources
  [1] linear.app/pricing — Retrieved 2026-02-28
  [2] clickup.com/pricing — Retrieved 2026-02-28
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Overall confidence score:**
- Prominent % at top. Computed from: average confidence of accepted findings, penalized for low source count or narrow source diversity.
- Tooltip explains: "84% confidence — 6 high-confidence findings from 4 distinct domains."

**Interaction patterns on one-pager:**
- **Footnote hover**: hovering `[1]` shows a tooltip with the source title + excerpt snippet — no need to switch to Evidence tab
- **Inline regeneration**: each section has a `↻ Regenerate` icon (appears on hover). Regenerates only that section, not the full report.
- **Edit mode toggle**: "Edit" button switches all sections to TipTap rich-text editors. Changes are saved as user amendments.
- **Export**: "Copy as Markdown" | "Save to Notes" (creates a PMS Note) | "Attach to Task" (creates attachment on linked task)
- **Share**: generates read-only link (org members only, MVP scope)

**Regeneration after evidence changes:**
If the user accepted/rejected findings on the Evidence Board, a banner appears: "Your evidence board changed. [Regenerate report] to incorporate your updates." — prevents stale one-pagers.

---

### 2.6 Decision Trace (`/agents/researcher/[runId]/trace`)

**Purpose:** Full step-by-step log of every decision the agent made. Enables auditability, trust-building, and debugging.

**This is the "show your work" screen — critical for user trust in the agent.**

**Layout:** Vertical timeline, full-width, chronological. Similar to the existing `AgentEventTimeline` component but richer.

**Step card:**
```
  ┌─ Step 7 of 22 ─────────────────── 12:04:45 ─┐
  │ ⚡ FINDING_EXTRACTED                          │
  │                                               │
  │ Claim: "Linear Business has no client portal" │
  │                                               │
  │ Source: linear.app/pricing (relevance: 0.92)  │
  │ Confidence assigned: HIGH                     │
  │ Reason: Direct quote found; single source but │
  │         primary domain, no contradictory data │
  │                                               │
  │ [▼ Raw metadata]                              │
  └───────────────────────────────────────────────┘
```

**Step action types** (with distinct icons and colors):
| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `query_formed` | `MagnifyingGlass` | blue | Search query constructed |
| `source_retrieved` | `Globe` | blue | URL fetched |
| `source_skipped` | `XCircle` | gray | Low relevance rejection |
| `finding_extracted` | `Lightbulb` | green | Claim extracted from source |
| `finding_rejected` | `Trash` | red | Finding below confidence threshold |
| `conflict_detected` | `Warning` | orange | Two sources contradict each other |
| `conflict_resolved` | `CheckCircle` | green | How conflict was resolved |
| `synthesis_started` | `Spinner` | purple | Beginning report generation |
| `section_drafted` | `TextT` | purple | One-pager section written |
| `agent_note` | `Note` | gray | Agent's internal reasoning note |
| `user_annotation` | `PencilSimple` | yellow | User added annotation |

**Conflict cards** (when `conflict_detected`):
```
  ⚠️ CONFLICT DETECTED — Step 14
  ────────────────────────────────
  Source A (clickup.com): "Client portal included in all plans"
  Source B (g2.com review): "Client view requires $100/mo add-on"
  
  Resolution: Favored official pricing page (Source A).
  Source B likely outdated (2023). Confidence: MEDIUM.
```

**Filter / Search in trace:**
- Filter by step type (chips)
- Search by keyword within descriptions
- Jump to step: number input

**Export trace:** "Download as JSON" for developer debugging or audit submission.

---

## 3. End-to-End User Flow

```
User opens /agents/researcher
         │
         ▼
   [Index: no runs yet]
         │
         ▼
   Clicks "New Research"
         │
         ▼
   Intake Form (/agents/researcher/new)
   ┌─────────────────────────────────┐
   │ Research question + type +      │
   │ scope + context + urgency       │
   └─────────────────────────────────┘
         │ Submit → agent dispatched
         ▼
   Overview (/agents/researcher/[runId]/overview)
         │
   ┌─────┴──────────────────────────┐
   │       STATUS: scanning         │
   │  Live activity feed streams    │
   │  sources + findings in real-time│
   └─────┬──────────────────────────┘
         │ (agent event: status→synthesizing)
         ▼
   Status banner → "Synthesizing…"
   Trace keeps streaming (synthesis steps)
         │ (agent event: status→completed)
         ▼
   Status banner → "✅ Complete"
   Three CTA cards appear
         │
   ┌─────┴───────────────┬────────────────────┐
   ▼                     ▼                    ▼
Evidence Board    One-Pager Report      Decision Trace
(validate)        (read + share)        (audit)
   │
   │ User rejects 2 findings
   ▼
"Report stale" banner appears on One-Pager
   │
   │ User clicks "Regenerate report"
   ▼
One-Pager regenerates (synthesis only, no re-scan)
   │
   │ User clicks "Save to Notes" or "Attach to Task"
   ▼
PMS artifact created (Note or task attachment)
   │
   │ Optional: User clicks "Add to task"
   ▼
Linked task gets subtask: "Review researcher findings"
```

**Alternative flows:**
- **Async mode**: User submits, returns to whatever they were doing. Inbox notification fires on completion: "Researcher Agent completed: [run title]". Click → overview.
- **Pause flow**: User clicks Pause → status set to `paused`. Agent stops. Resume available. Useful when early findings reveal the question needs refinement.
- **Clarification needed**: Agent emits `status=paused` + `agent_note` asking user a question (e.g., "Should I include 2023 pricing data?"). User responds inline in overview → agent resumes.

---

## 4. Timeline / Activity Visibility (Trust Layer)

The Researcher Agent must earn trust through radical transparency. Everything it does should be observable.

### What appears in the PMS-wide Activity Feed (agent_activities / agent_events):

| Event | Visible to whom | Entry text |
|-------|----------------|------------|
| Run started | All org members | "Researcher agent started: [question truncated]" |
| Status change | All org members | "Researcher: scanning → synthesizing" |
| Run completed | Run requester + project members (if linked) | "Researcher completed: [run title]. 8 findings, 84% confidence." |
| Run failed | Run requester | "Researcher failed: [error summary]" |
| Finding accepted/rejected by user | Run requester | "You accepted/rejected finding on [run title]" |
| One-pager regenerated | Run requester | "One-pager regenerated after evidence changes" |

### What appears in the Research Run's own trace (always visible to run requester):
- Every source fetched, with relevance score
- Every source skipped, with reason
- Every finding extracted, with confidence reasoning
- Every conflict detected and how it was resolved
- Every synthesis section drafted
- Every user action (accept/reject/annotate)

### What appears in a linked Task's timeline (if run is linked):
- Agent event: "Researcher agent started research linked to this task"
- Agent event: "Researcher completed — [N] findings, [confidence]%. View one-pager →"
- Agent event: "User attached research one-pager to this task"

### Trust signals rendered throughout the UI:
1. **Confidence scores** on every finding and the overall one-pager (not hidden)
2. **Source count and diversity** ("4 distinct domains") — breadth indicator
3. **Skipped sources list** — what was seen but excluded (and why)
4. **Timestamp granularity** — every step shows seconds-level precision
5. **Conflict visibility** — contradictions are surfaced, not smoothed over
6. **User control** — Accept/Reject/Edit findings before consuming the one-pager

---

## 5. Information Architecture & Interaction Patterns

### IA Principles for Researcher Agent

1. **Progressive disclosure**: Raw data (Evidence Board) → Synthesis (One-Pager) → Meta-reasoning (Trace). User can go as deep as they want, but the summary is always the default view.

2. **Permanent artifacts**: Every run is a permanent record. Research runs are never auto-deleted. This makes the agent's work part of the org's knowledge base.

3. **Editable outputs**: The one-pager is a starting point, not a final doc. User ownership is preserved.

4. **Non-blocking by default**: Async mode means the agent doesn't interrupt the user. Push notification on completion.

### Core Interaction Patterns

| Pattern | Usage |
|---------|-------|
| **Live streaming timeline** | Overview page during active scan — Supabase Realtime subscription to `research_trace_steps` |
| **Two-panel explore** | Evidence Board — source list + detail panel, common PM tool pattern |
| **Footnote-hover citation** | One-pager — inline references without tab-switching |
| **Inline regeneration** | Per-section regeneration in one-pager — scoped, fast |
| **Optimistic UI for accept/reject** | Evidence Board — immediate visual feedback before server confirm |
| **Banners for state dependencies** | "Evidence changed → regenerate one-pager" — clear causality |
| **Confidence color system** | 🟢 HIGH / 🟡 MEDIUM / 🔴 LOW — consistent throughout all views |
| **Expandable raw data** | Every trace step and source has a "▼ Raw metadata" accordion |

### Navigation Between Sub-Views

Sticky left sidebar tabs on the run detail:
```
┌───────────────┐
│ ← All Runs    │
│               │
│ Overview      │  (active: bold, left accent border)
│ Evidence  (8) │  (badge shows count)
│ One-Pager     │
│ Trace    (22) │
└───────────────┘
```
Counts update in real-time. Badge turns orange when stale (evidence changed but one-pager not regenerated).

---

## 6. MVP vs V1 UX Scope

### MVP Scope (Minimum to ship)

**Goal:** Researcher agent works end-to-end. User can ask a question, see it run, and get a one-pager.

| Screen | MVP Scope |
|--------|-----------|
| **Index** | Simple list (no grid). Status and title. No filters. |
| **Intake** | Question field + Research Type. No scope accordion, no project linking. |
| **Overview** | Progress bar + status banner. Simple text feed (no icons, no expand). Manual refresh (no real-time). |
| **Evidence Board** | Flat list of findings. Accept/Reject only. No source-level grouping. No user edit of claims. |
| **One-Pager** | Auto-generated text + source list. No per-section regeneration. No footnote hover. Plain text, no edit mode. |
| **Trace** | Full chronological log (no icons, no filtering). Read-only. |
| **Activity** | Single event in org feed: "Researcher completed: [title]" |

**MVP excludes:**
- Real-time streaming (polling every 10s is acceptable)
- Conflict detection surfacing
- Evidence Board two-panel split (single list)
- Inline one-pager regeneration after evidence changes
- Export / share / "Save to Notes"
- Linked tasks/projects
- Clarification/pause flow
- Confidence score computation display

---

### V1 Scope (Full Design)

Everything in MVP, plus:

| Enhancement | V1 Addition |
|------------|-------------|
| **Index** | Card grid, status filters, search, estimated time |
| **Intake** | Full scope accordion, context linking (project/task), urgency toggle, estimated runtime |
| **Overview** | Real-time streaming, expand-per-step, summary stats strip, conflict surfacing |
| **Evidence Board** | Two-panel split, source filtering by type/relevance, per-finding confidence, inline claim editing, bulk accept/reject |
| **One-Pager** | Footnote-hover citations, per-section regeneration, TipTap edit mode, Export (Markdown/Note/Task attach), Share link, stale-evidence banner |
| **Trace** | Step type icons + colors, keyword search, filter by type, conflict cards, JSON export |
| **Activity** | Rich events in agent_events feed + linked task timeline, inbox notification on completion |
| **Trust signals** | Confidence %, source diversity count, skipped sources list, conflict surfacing |

---

## 7. Five UX Failure Modes & Guardrails

---

### Failure Mode 1: The Black Box Problem
**Scenario:** Agent completes in 2 minutes and returns a confident one-pager. User has no idea how it got there. They either blindly trust it or don't trust it at all.

**Risk:** Credibility collapse. A single bad finding that slips through destroys confidence in all future runs.

**Guardrail:**
- Evidence Board is always accessible and **shown first** on completion (default tab, not One-Pager).
- Overall confidence score is prominent on the one-pager with a tooltip explaining how it was computed.
- "Based on X findings from Y distinct sources" is always shown — no hiding the basis.
- Decision Trace is one click away, never buried.

---

### Failure Mode 2: Stale One-Pager (Diverged Evidence)
**Scenario:** User reviews evidence, rejects 3 findings as outdated. Then reads the one-pager — which still includes those rejected findings. Contradiction creates confusion.

**Risk:** User loses trust in both the evidence board and the one-pager. Feels like the UI is lying.

**Guardrail:**
- One-pager tracks a `based_on_version` hash of accepted findings.
- When findings change (accept/reject), one-pager tab badge turns orange and a persistent banner renders: "Evidence changed since this report was generated. [Regenerate] to incorporate your updates."
- Regeneration is scoped (synthesis only, no re-scan) — fast enough to not block.
- Old one-pager is grayed out / "stale" visually until regenerated.

---

### Failure Mode 3: Overconfident Output on Sparse Evidence
**Scenario:** Agent finds only 3 sources (e.g., niche technical question), extracts 2 findings, and presents a one-pager with an "82% confidence" score. User treats it as authoritative.

**Risk:** Confidence number misleads. User makes a decision on thin evidence.

**Guardrail:**
- Confidence score has a **minimum source count floor**: if fewer than 5 accepted sources, the score is automatically capped at 60% and a warning badge is shown: "⚠️ Low source coverage — treat findings as directional, not conclusive."
- Evidence summary always shows source count prominently (not just in trace).
- One-pager "Nuances & Caveats" section is **mandatory** — agent must populate it; it cannot be empty.
- For MVP, if source count < 3 at completion, run shows a "Shallow scan" warning on the card.

---

### Failure Mode 4: Runaway / Hung Research Run
**Scenario:** Agent starts scanning, hits an unexpected loop or slow external source, and the run shows "scanning" for 45 minutes with no progress. User doesn't know if it's working or frozen.

**Risk:** User frustration. Wasted compute. No sense of control.

**Guardrail:**
- **Timeout enforcement**: Each scan has a max runtime configured by depth (Quick: 5min, Standard: 10min, Deep: 25min). Exceeding timeout → auto-set `status=failed` with reason "Run timed out."
- **Progress staleness detection**: If no new `research_trace_steps` in > 90 seconds, the overview shows a "⚠️ Agent seems stuck. [Cancel] or [Wait 60s more]" inline alert.
- **Pause control**: User can pause at any time — agent saves partial state (sources + findings collected so far). Partial results remain usable.
- **Cancel confirmation**: Canceling prompts "Cancel run? Partial findings will be saved." — prevents accidental cancel.

---

### Failure Mode 5: Finding Overload (Cognitive Overwhelm)
**Scenario:** Deep scan returns 40+ sources and 60+ findings. Evidence Board becomes a wall of text. User spends 20 minutes trying to review findings and gives up without accepting/rejecting anything. One-pager is generated from unreviewed (and potentially noisy) data.

**Risk:** The review step — key to user ownership and trust — is skipped entirely. Agent output is consumed uncritically.

**Guardrail:**
- **Default view on Evidence Board is findings grouped by category** (not a flat list), collapsed to 3 per category. "Show all [12]" expand per group — reduces visual noise.
- **Agent pre-selects** high-confidence findings as "Suggested" (pre-checked) and low-confidence as "Review needed" (highlighted). User can batch-accept all suggested ones in one click.
- **"Quick Review" mode**: A streamlined card-swipe UI for mobile-first review — one finding at a time, ✅ Accept / ❌ Reject / ⏩ Skip. Reduces 60 findings to ~4 minutes of review.
- **Progressive one-pager**: If user hasn't reviewed evidence, one-pager shows a "Review Evidence" nudge at top but is still readable — the agent uses all findings by default, pending review.
- **Finding count warnings**: Intake form warns at >Deep depth: "Deep scans return many findings. Plan 10–15 min for evidence review."

---

## 8. Design Tokens & Component Alignment

For consistency with the existing PMS design system:

| Element | Aligned with |
|---------|-------------|
| Page layout | Existing `PageHeader` + `flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg` wrapper |
| Icons | Phosphor Icons (SSR variants) — `MagnifyingGlass`, `Globe`, `Lightbulb`, `Warning`, `CheckCircle`, `XCircle`, `Spinner`, `TextT`, `Note`, `PencilSimple`, `Trophy`, `ChartLine`, `Code`, `UsersThree` |
| Badges / confidence | Extend existing badge variants: `confidence-high` (green), `confidence-medium` (yellow), `confidence-low` (red) |
| Status dots | Reuse Sessions page status dot pattern (green/yellow/gray) + add blue for `scanning` |
| Cards | shadcn/ui `Card` with `CardHeader` / `CardContent` — no custom styling needed |
| Tabs | shadcn/ui `Tabs` for Evidence Board sub-views |
| Sheets | shadcn/ui `Sheet` for expanded source detail (mobile) |
| Timeline | Extend `AgentEventTimeline` component with richer step types |
| Forms | React Hook Form + Zod, same pattern as all other PMS forms |
| Toast / alerts | Existing toast system for "Run completed" / "Regeneration needed" |
| Progress bar | shadcn/ui `Progress` component |
| Realtime | Supabase Realtime on `research_trace_steps` table subscription |

---

## 9. Open Questions for Product Decision

1. **Who can run research?** All org members, or only agents of researcher type? If user-initiated only in MVP, does the researcher agent ever self-trigger (e.g., when a project is created)?

2. **Privacy of runs**: Are runs org-wide visible or private to requester by default? (MVP: org-wide. V1: toggle privacy per run.)

3. **Source credibility model**: Does PMS maintain a domain credibility allowlist/blocklist, or is it fully LLM-judged per run?

4. **Cost display**: Should the UI show estimated or actual token cost per run? (Ties into Agent Cost Dashboard from product analyst roadmap.)

5. **Agent identity**: Is the Researcher a single org-wide agent instance, or can each user instantiate their own? (Recommendation: single specialist agent, per PMS hierarchy — `agent_type = specialist`, `role = researcher`.)

6. **Conflict resolution policy**: When two sources contradict, does the agent decide automatically (and log it in trace) or always surface it to user as a `paused` state requiring human resolution?

7. **One-pager format templates**: Should research type (Competitive / Market / Technical / Stakeholder) drive different section structures in the one-pager, or is a single flexible format sufficient for MVP?

---

*End of design input. This document is ideation-only and contains no implementation code.*
