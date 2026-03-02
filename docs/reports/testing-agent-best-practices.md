# Testing Agent: Best Practices & Rollout Plan

> Recommendation report for introducing a dedicated Testing Agent into the PMS 6-agent architecture.

## 1. Current State Assessment

| Aspect | Status |
|--------|--------|
| Unit tests | ❌ None (no Jest/Vitest configured) |
| E2E tests | ✅ 20 Playwright specs (auth, CRUD, a11y, security, perf) |
| CI pipelines | ⚠️ Perf-only (Lighthouse, nav-perf, perf-regression) — no test CI |
| Linting | ✅ ESLint |
| Type checking | ✅ TypeScript (`tsc --noEmit`) |

**Key gap:** No unit/integration test layer, no CI pipeline running Playwright, and no agent owns test quality today.

---

## 2. Ideal Position in Pipeline

```
Planner → Dev Agent → Testing Agent → Reviewer → Deploy
                           ↑                |
                           └── fix cycle ───┘
```

**Place the Testing Agent between Dev and Reviewer.** Rationale:

- **Before Reviewer:** The Reviewer shouldn't waste cycles on code that fails tests. Testing Agent acts as a quality gate that catches functional regressions before human/AI review.
- **Feedback loop with Dev:** When tests fail, the Testing Agent sends structured failure reports back to Dev for fixes — the Reviewer never sees broken code.
- **Optional post-Review hook:** For critical paths (auth, billing), run a smoke re-check after Reviewer-approved changes are merged, before deploy.

---

## 3. Responsibilities Split

| Responsibility | Dev Agent | Testing Agent | Reviewer |
|---|---|---|---|
| Write feature code | ✅ | | |
| Write unit tests for new code | ✅ (co-located) | Validates coverage | |
| Write integration/e2e tests | | ✅ | |
| Run full test suite | | ✅ | |
| Report pass/fail + coverage | | ✅ | Reads report |
| Fix failing tests (test bugs) | | ✅ | |
| Fix failing code (app bugs) | ✅ (on escalation) | | |
| Code quality & architecture | | | ✅ |
| Approve/reject merge | | Gates on test pass | ✅ (final) |

**Principle:** Dev writes unit tests alongside code (they know intent). Testing Agent writes integration/e2e tests, runs everything, and owns the "does it work?" question. Reviewer owns "is it good?"

---

## 4. Test Pyramid Strategy for PMS

```
        ╱  E2E (Playwright)  ╲        ~15% of tests
       ╱  Integration (API)   ╲       ~25% of tests
      ╱  Unit (Vitest)         ╲      ~60% of tests
```

### Unit Layer (new — Vitest)
- **Target:** Server actions (`lib/actions/`), utility functions (`lib/`), cache helpers, data transforms
- **Why Vitest:** Fast, ESM-native, works with Next.js, zero-config for TS
- **Owner:** Dev Agent writes, Testing Agent validates coverage ≥ 80% on changed files

### Integration Layer (new — Vitest + MSW or direct DB)
- **Target:** Server action → DB round-trips, API route handlers, auth flows
- **Approach:** Use test DB (Supabase local or SQLite shim) for real queries
- **Owner:** Testing Agent writes and maintains

### E2E Layer (existing — Playwright)
- **Target:** Critical user journeys (already 20 specs — good foundation)
- **Expand:** Task CRUD, real-time updates, org switching, role-based access
- **Owner:** Testing Agent writes new specs, maintains existing

---

## 5. Required Tooling & CI Checks

### New Dependencies
| Tool | Purpose | Priority |
|------|---------|----------|
| `vitest` | Unit + integration tests | P0 (Phase 1) |
| `@vitest/coverage-v8` | Coverage reporting | P0 |
| `msw` | API mocking for integration tests | P1 (Phase 2) |

### CI Pipeline (add to `.github/workflows/`)

```yaml
# tests.yml — runs on every PR
- TypeScript check (tsc --noEmit)
- ESLint
- Vitest (unit + integration) with coverage
- Playwright (e2e) on Chromium only for PRs (full matrix on main)
- Coverage threshold gate (fail if < 80% on changed files)
```

### Quality Gates (block merge if any fail)
1. `tsc --noEmit` passes
2. All Vitest tests pass
3. Coverage on changed files ≥ 80%
4. All Playwright specs pass (Chromium)
5. No accessibility regressions (existing a11y spec)

---

## 6. Updated Definition of Done

Current DoD + these additions:

- [ ] Unit tests written for all new functions/actions (Dev Agent)
- [ ] Integration tests cover new API/DB paths (Testing Agent)
- [ ] E2E test covers new user-facing flow if applicable (Testing Agent)
- [ ] All tests pass in CI
- [ ] Coverage on changed files ≥ 80%
- [ ] Testing Agent signs off with structured report before Reviewer begins

---

## 7. Failure / Retry / Escalation Model

```
Testing Agent runs suite
  │
  ├─ All pass → ✅ Proceed to Reviewer
  │
  ├─ Test failure (likely test bug) → Testing Agent fixes test, re-runs (max 2 retries)
  │
  ├─ App failure (code bug) → Structured report to Dev Agent:
  │     { file, test, error, screenshot/trace }
  │     Dev fixes → re-submit to Testing Agent (max 2 cycles)
  │
  └─ 2 cycles exhausted → Escalate to Reviewer with full context
        Reviewer decides: fix, skip, or defer
```

**Playwright retries:** Already configured (2 retries on CI). Keep this.
**Flaky test policy:** If a test fails then passes on retry, flag it. After 3 flaky occurrences, Testing Agent quarantines it and opens a fix task.

---

## 8. Cost / Performance Tradeoffs

| Factor | Impact | Mitigation |
|--------|--------|------------|
| LLM tokens for Testing Agent | +15-25% per task cycle | Keep prompts focused; don't re-analyze passing code |
| CI runtime (+Vitest) | +30-60s | Vitest is fast; parallel workers |
| CI runtime (+Playwright) | +3-5 min | Run Chromium-only on PRs, full matrix nightly |
| Dev Agent writing unit tests | +10-15% dev time | Saves 2-3x in bug-fix cycles downstream |
| False positives / flaky tests | Agent retry loops waste tokens | Quarantine policy, trace-on-retry |

**Net ROI:** Testing Agent pays for itself if it catches ≥ 1 regression per 5 tasks that would otherwise reach production or require Reviewer back-and-forth.

---

## 9. MVP Rollout Plan

### Phase 1 — Foundation (Week 1-2)
- [ ] Add Vitest + coverage config to repo
- [ ] Create `tests.yml` CI workflow (type check + lint + vitest + playwright chromium)
- [ ] Define Testing Agent prompt/policy (see §10)
- [ ] Testing Agent runs existing Playwright suite on every Dev submission
- [ ] Dev Agent instructed to co-locate unit tests with new code
- **Success metric:** CI pipeline green, 10+ unit tests exist

### Phase 2 — Coverage & Integration (Week 3-4)
- [ ] Testing Agent writes integration tests for server actions
- [ ] Coverage gate enforced (80% on changed files)
- [ ] Flaky test quarantine process active
- [ ] Add MSW for external API mocking
- **Success metric:** 50+ unit tests, 10+ integration tests, coverage gate blocking PRs

### Phase 3 — Full Loop (Week 5-6)
- [ ] Testing Agent auto-generates E2E specs for new user flows
- [ ] Post-merge smoke check on staging
- [ ] Testing Agent produces structured test reports (pass/fail/coverage/flaky)
- [ ] KPI dashboard or log tracking
- **Success metric:** All quality gates active, < 5% flaky rate, zero untested features shipping

---

## 10. Recommended Prompts / Policy for the Testing Agent

### System Prompt (core)

```
You are the Testing Agent for PMS, a Next.js 16 project management app.

Your job: ensure every code change is tested and working before it reaches review.

## What you do:
1. Receive code changes from Dev Agent
2. Run existing test suite (vitest + playwright)
3. Assess test coverage on changed files
4. Write missing integration/e2e tests for new functionality
5. Report results in structured format

## What you DON'T do:
- Rewrite application code (escalate to Dev Agent)
- Make architectural decisions (that's the Reviewer)
- Skip failing tests without documenting why

## Test writing guidelines:
- Unit tests: test behavior, not implementation. No mocking internal modules.
- Integration tests: test server actions with real DB when possible.
- E2E tests: test user journeys, not individual components. Use POM pattern.
- Every test must have a clear assertion. No "smoke" tests that just check page loads.

## Output format (after every run):
{
  "status": "pass" | "fail" | "escalate",
  "summary": "...",
  "unit": { "total": N, "passed": N, "failed": N, "coverage": "X%" },
  "e2e": { "total": N, "passed": N, "failed": N },
  "new_tests_written": ["file1.test.ts", ...],
  "failures": [{ "test": "...", "error": "...", "file": "..." }],
  "recommendation": "proceed" | "fix_needed" | "escalate"
}
```

### Policy Rules

1. **Never approve with failing tests.** No exceptions.
2. **Coverage is mandatory on changed files.** New code without tests goes back to Dev.
3. **Flaky tests get 1 sprint.** After that, fix or delete.
4. **E2E tests are required for user-facing changes.** API-only changes need integration tests.
5. **Testing Agent cannot modify `lib/` or `app/` code.** Only `tests/`, `e2e/`, and test configs.

---

## 11. KPIs to Track

| KPI | Target | Measurement |
|-----|--------|-------------|
| Test pass rate | ≥ 98% | CI logs |
| Coverage on changed files | ≥ 80% | Vitest coverage report |
| Flaky test rate | < 5% | Retry-pass / total runs |
| Bugs caught before review | Track count | Testing Agent reports |
| Dev → Test → Review cycle time | < 30 min | Pipeline timestamps |
| Regressions reaching production | 0 | Post-deploy monitoring |

---

*Report generated 2026-03-02. Review and adapt as the agent architecture evolves.*
