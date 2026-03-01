# Researcher Agent in PMS — Technical Feasibility Plan (Ideation)

**Date:** 2026-02-28  
**Scope:** Feasibility + architecture options only (no implementation)

## 1) Context and Goal

PMS already has an `agents` system, `agent_events`, `agent_documents`, `agent_decisions`, and task orchestration. A seeded **Researcher** agent exists, but today it behaves as a generic specialist. The goal is to make it a dedicated research pipeline agent that can continuously or on-demand produce high-signal concepts with traceable evidence.

Target output per run:
1. prioritized concepts
2. one-pager recommendation(s)
3. full decision trace (why selected/rejected)

---

## 2) Architecture Options (with tradeoffs)

## Option A — In-process "Research Mode" inside existing agent runtime

**Shape**
- Extend current agent-event pipeline and task orchestration with a new `research_run` flow.
- Researcher executes ingestion, dedupe, scoring, synthesis as one orchestrated chain in existing server/API context.
- Persist results into existing `agent_documents` + `agent_decisions` with minimal new tables.

**Pros**
- Fastest to MVP; least operational overhead.
- Reuses existing auth, RLS, events, notifications, timeline.
- Easier product integration (same Mission Control surfaces).

**Cons**
- Harder to isolate noisy/slow external calls.
- Failure in one stage can impact end-to-end latency.
- Scaling is coupled to app/API scaling.

**Best when**
- You need a 2–4 week MVP and modest run volume.

---

## Option B — Dedicated Research Worker service (recommended)

**Shape**
- Keep PMS app/API as control plane.
- Add async worker (queue-driven) that executes research pipeline stages.
- Worker writes normalized artifacts back to Supabase (`research_*` tables + existing docs/decisions).

**Pros**
- Better reliability and retries for external APIs (Reddit/X/web).
- Cleaner separation of concerns; easier observability and cost control.
- Can scale workers independently from product UI/API.

**Cons**
- More infra complexity (queue, worker deployment, job lifecycle).
- Slightly longer implementation.

**Best when**
- Research is a core capability with recurring runs and growing source volume.

---

## Option C — Hybrid: thin worker + scheduled refresh + on-demand synthesis

**Shape**
- Lightweight ingestion worker periodically collects and normalizes signals.
- User-triggered runs only execute dedupe/scoring/synthesis on pre-collected data + fresh delta.

**Pros**
- Fast UX for on-demand requests.
- Reduces repeated API costs and rate-limit pressure.
- Good compromise of speed vs robustness.

**Cons**
- Requires cache freshness policies and staleness handling.
- More logic around “what is fresh enough.”

**Best when**
- You want responsive UX but cannot yet invest in full data platform.

---

## 3) Data Sources Strategy (Reddit / X / Web Search)

## Source roles
- **Reddit:** pain points, practitioner language, feature complaints, workflow hacks.
- **X (Twitter):** emerging trends, founder/operator narratives, rapid sentiment shifts.
- **Web Search:** broader validation (blogs, docs, competitors, launch posts, forums).

## Access strategy
- Prefer official APIs where practical; otherwise controlled connector abstraction per source.
- Store **raw snippet + metadata + URL + timestamp + author/channel metadata**.
- Persist a normalized canonical record for cross-source scoring.

## Constraints and realities
- **Rate limits:** must use per-source backoff + run budgets.
- **Policy/TOS drift:** source adapters should be replaceable without touching core scoring/synthesis logic.
- **Data quality variance:** noisy/viral content can overpower useful weak signals.
- **Licensing/copyright/privacy:** store references and excerpts, avoid bulk/full-content replication.
- **Deletion/edits:** content mutability means evidence can disappear; preserve decision-time snapshots.

## Practical safeguards
- Per-run fetch caps (e.g., max posts/tweets/URLs).
- Time-window filters by default (e.g., last 30/90 days).
- Language + geography filters configurable by org/workspace.
- Evidence confidence labels (`high`, `medium`, `low`) based on source quality + corroboration.

---

## 4) Pipeline Design

`ingestion -> dedupe -> scoring -> concept synthesis -> one-pager -> decision trace`

## Stage 1: Ingestion
- Inputs: research brief (topic, ICP, market, constraints, time window).
- Fetch from source adapters (Reddit/X/web search).
- Emit normalized `research_signals` records with provenance.

## Stage 2: Dedupe
- URL-level dedupe + semantic near-duplicate clustering.
- Merge duplicates into one cluster with source count and recency spread.
- Retain all provenance links for traceability.

## Stage 3: Scoring
- Compute score dimensions (weighted, configurable):
  - **Pain severity** (explicit urgency/problem cost)
  - **Frequency** (cross-post/source repetition)
  - **Recency** (fresh trend weight)
  - **Buyer relevance** (fit to ICP)
  - **Execution feasibility** (internal capability fit)
  - **Strategic fit** (company roadmap alignment)
- Produce ranked opportunities + uncertainty note.

## Stage 4: Concept synthesis
- Convert top clusters to concept candidates:
  - problem statement
  - target persona
  - solution angle
  - expected impact
  - key risks/open questions

## Stage 5: One-pager generation
- For top N concepts, generate a concise one-pager:
  - context
  - evidence highlights
  - concept
  - success metrics
  - test plan (2–4 week validation)
  - go/no-go criteria

## Stage 6: Decision trace
- Persist:
  - what was considered
  - scoring reasons/weights
  - accepted/rejected concepts
  - final recommendation and confidence
- Link all conclusions to evidence IDs/URLs and generation run ID.

---

## 5) Minimum Schema Changes and Services Needed

Leverage existing tables first (`agents`, `agent_events`, `agent_documents`, `agent_decisions`, `tasks`). Add only minimal research-specific structure.

## Minimal new tables
1. **`research_runs`**
   - run metadata: org, requester, status, brief, started/ended, model, cost/tokens/time
2. **`research_signals`**
   - normalized source item (source_type, external_id/url, title/snippet, author, published_at, raw_metadata)
3. **`research_clusters`**
   - deduped/semantic group with aggregate metrics
4. **`research_scores`**
   - per-cluster score breakdown + final score + weights snapshot
5. **`research_concepts`**
   - synthesized concepts tied to clusters + decision outcome
6. **`research_trace`** (or JSONB column on runs)
   - auditable decision trail for accepted/rejected reasoning

## Minimal service additions
- **Source connector layer** (Reddit/X/web) with unified interface.
- **Research orchestrator** (sync for Option A, async worker for Option B/C).
- **Scoring engine** (deterministic + configurable weights per org).
- **Synthesis generator** (LLM prompt chain with strict schema output).

## Reuse existing PMS assets
- Store one-pagers in `agent_documents` (`doc_type='research'|'report'`).
- Store final decision summary in `agent_decisions` with reference to `research_run_id`.
- Surface lifecycle in `agent_events` and task timeline.

---

## 6) Reliability and Safety Controls

## Reliability
- Idempotent ingestion keys (`source + external_id + org`).
- Retries with exponential backoff and jitter per connector.
- Partial-failure tolerance: pipeline can continue with available sources.
- Run checkpoints per stage for resume/replay.
- Budget guards: max runtime, max tokens, max fetched items.

## Safety & quality
- Prompt-injection-resistant summarization (treat source text as untrusted data).
- Citation-required synthesis: no recommendation without evidence links.
- Confidence gating: low-confidence outputs marked as "needs human review".
- Compliance filters for PII and sensitive content retention.
- Human approval gate before auto-creating roadmap-impacting tasks.

## Auditability
- Immutable run snapshot for decision-time evidence.
- Versioned scoring weights and prompt template IDs.
- Clear “why not chosen” log for rejected concepts.

---

## 7) MVP Plan (2–3 phases, rough effort)

## Phase 1 — Foundations (1.5 to 2.5 weeks)
- Implement Option A or B-lite baseline:
  - `research_runs`, `research_signals`
  - connector abstraction + web search connector first
  - ingestion + basic dedupe + evidence-backed summary
- Output: single research report in `agent_documents`.

**Effort:** 8–12 dev-days

## Phase 2 — Scoring + concepts + trace (2 to 3 weeks)
- Add `research_clusters`, `research_scores`, `research_concepts`.
- Implement weighted scoring and top-concept synthesis.
- Persist decision trace and push summary to `agent_decisions`.
- Add Mission Control visibility for run status and artifacts.

**Effort:** 10–15 dev-days

## Phase 3 — Source expansion + hardening (2 to 3 weeks)
- Add Reddit + X connectors under same adapter contract.
- Add retries/checkpointing, run budgets, confidence thresholds.
- Add monitoring (run success %, latency, evidence coverage, cost/run).

**Effort:** 10–14 dev-days

---

## 8) Recommendation

Use **Option B (Dedicated Research Worker)** as the target architecture, but execute MVP incrementally:
- start with Option A-like simplicity for first milestone if needed,
- converge quickly to worker-based async orchestration before enabling recurring or high-volume research.

This path balances speed to value with long-term reliability, source volatility, and decision traceability requirements.