# Testing Report: Install Playwright Test Agents

**Date:** 2026-03-02  
**Author:** Subagent (OpenClaw)  
**Repo:** `C:\Users\Fares\Downloads\PMS`

---

## Summary

Playwright Test Agents (`planner`, `generator`, `healer`) were successfully installed and integrated into the PMS repository using the Claude Code loop.

---

## Commands Run

```bash
# Initialize Playwright Test Agent definitions for Claude Code
npx playwright init-agents --loop=claude
```

Output:
```
🎭 Using project "chromium" as a primary project
🌱 e2e\seed.spec.ts        - default environment seed file
🤖 .claude\agents\playwright-test-generator.md  - agent definition
🤖 .claude\agents\playwright-test-healer.md     - agent definition
🤖 .claude\agents\playwright-test-planner.md    - agent definition
🔧 .mcp.json               - mcp configuration
✅ Done.
```

---

## Files Created / Changed

| File | Action | Notes |
|------|--------|-------|
| `.claude/agents/playwright-test-planner.md` | Created | Agent definition with MCP browser tools |
| `.claude/agents/playwright-test-generator.md` | Created | Agent definition for test generation |
| `.claude/agents/playwright-test-healer.md` | Created | Agent definition for healing failing tests |
| `.mcp.json` | Updated | MCP config updated with `playwright-test` server |
| `e2e/seed.spec.ts` | Created/Updated | PMS-specific seed test (replaces default stub) |
| `specs/.gitkeep` | Created | Directory for Markdown test plans |
| `docs/reports/testing-install-playwright-test-agents.md` | Created | This report |

---

## Agent Definitions

All three agent definitions live in `.claude/agents/` and are automatically picked up by Claude Code as sub-agents.

### `playwright-test-planner`
- **Model:** sonnet
- **Tools:** Browser navigation, snapshot, screenshot, `planner_setup_page`, `planner_save_plan`, file reading tools
- **Purpose:** Explores the running app and produces a structured Markdown test plan in `specs/`

### `playwright-test-generator`
- **Model:** sonnet
- **Tools:** Browser navigation, snapshot, `browser_run_code` (runs Playwright tests), file writing tools
- **Purpose:** Reads a Markdown plan from `specs/` and writes executable `.spec.ts` files into `e2e/`

### `playwright-test-healer`
- **Model:** sonnet
- **Tools:** Browser navigation, snapshot, `browser_run_code`, file reading/writing tools
- **Purpose:** Runs a failing test, inspects the live UI, patches locators/assertions, re-runs until passing

---

## Seed Test

`e2e/seed.spec.ts` — bootstraps agent context with:
- Navigation to `/login`
- Title assertion
- Visibility of the sign-in button

All generated tests should import from `./fixtures` (which provides PMS page objects) and follow this seed as a template.

---

## Planner → Generator → Healer Workflow for PMS

### Step 1 — Run Planner

In Claude Code, invoke:

```
Use the playwright-test-planner agent.
Generate a test plan for [feature, e.g. "project creation"].
Use e2e/seed.spec.ts as the seed test.
The app runs at http://localhost:3000.
Save the plan to specs/project-creation.md.
```

The planner will:
1. Navigate the running PMS app at `localhost:3000`
2. Explore the relevant user flow
3. Write a structured Markdown plan to `specs/project-creation.md`

### Step 2 — Run Generator

```
Use the playwright-test-generator agent.
Generate Playwright tests from specs/project-creation.md.
Use e2e/seed.spec.ts as the seed and e2e/fixtures.ts for imports.
Save tests under e2e/project-creation/
```

The generator will:
1. Read the Markdown plan
2. Navigate the app to verify selectors live
3. Write `.spec.ts` files using PMS fixtures

### Step 3 — Run Healer (on failure)

```
Use the playwright-test-healer agent.
Heal failing test: e2e/project-creation/add-project.spec.ts
```

The healer will:
1. Run the failing test and capture output
2. Navigate the live app to find current element state
3. Patch locators, waits, or assertions
4. Re-run until passing or mark skipped if functionality is broken

### Local Validation

```bash
# Start the dev server first
npm run dev

# Run all e2e tests
npm run test:e2e

# Run only the seed test to verify environment
npx playwright test e2e/seed.spec.ts
```

---

## Pre-requisites

- Dev server must be running (`npm run dev` or against staging URL)
- MCP server `playwright-test` is configured in `.mcp.json`
- Claude Code with `--dangerously-skip-permissions` for unattended runs

---

## Existing Tests

No existing tests were modified. All existing `e2e/*.spec.ts` files remain intact.
