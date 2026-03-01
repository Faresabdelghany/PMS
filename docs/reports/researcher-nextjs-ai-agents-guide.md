# Next.js AI Agents Guide — PMS Extraction Report

**Source:** https://nextjs.org/docs/app/guides/ai-agents + https://nextjs.org/docs/app/guides/mcp  
**Date:** 2026-03-01  
**Scope:** Research only — no implementation

---

## 1. Key Concepts Relevant to PMS

### AGENTS.md / CLAUDE.md Convention
Next.js 16+ bundles version-matched documentation inside `node_modules/next/dist/docs/`. An `AGENTS.md` file at the project root directs AI coding agents (Claude Code, Cursor, Copilot, etc.) to read these bundled docs instead of relying on stale training data. `CLAUDE.md` simply imports `AGENTS.md` via `@AGENTS.md`.

### Bundled Docs (`node_modules/next/dist/docs/`)
Docs ship with the `next` package itself — no network lookups needed. Agents get version-accurate API references, guides, and file conventions automatically.

### Next.js MCP Server (`next-devtools-mcp`)
Next.js 16+ exposes a built-in MCP endpoint at `/_next/mcp` during development. The `next-devtools-mcp` package connects coding agents to live app state:
- **`get_errors`** — build/runtime/type errors from dev server
- **`get_logs`** — browser console + server output
- **`get_page_metadata`** — routes, components, rendering info per page
- **`get_project_metadata`** — project structure, config, dev server URL
- **`get_server_action_by_id`** — source lookup for Server Actions
- Knowledge base queries, upgrade/migration codemods, Playwright browser testing integration

### Delimited Sections
`<!-- BEGIN:nextjs-agent-rules -->` / `<!-- END:nextjs-agent-rules -->` markers let Next.js own its section while projects add custom instructions outside.

---

## 2. What We Already Do vs. What We're Missing

| Area | PMS Status | Notes |
|------|-----------|-------|
| `AGENTS.md` exists | ✅ Already have it | Contains auto-generated Next.js doc index |
| `CLAUDE.md` exists | ✅ Already have it | Present at root |
| Bundled docs in `node_modules/next/dist/docs/` | ❌ Missing | `Test-Path` returns `False` — likely on older Next.js or docs not bundled in current version |
| `.next-docs/` directory | ❌ Not found | AGENTS.md references `.next-docs` as root but directory doesn't exist |
| `next-devtools-mcp` | ❌ Not set up | No `.mcp.json` found; no MCP integration for live dev-server introspection |
| Custom project rules in AGENTS.md | ❌ Not present | AGENTS.md only has the auto-generated doc index, no PMS-specific coding conventions |
| Delimited section markers | ❌ Missing | No `BEGIN/END:nextjs-agent-rules` markers — risky for future codemod overwrites |

---

## 3. Concrete Adoption Opportunities

### Short Term (1-2 weeks)

1. **Upgrade Next.js to 16.2+** to get bundled docs in `node_modules/next/dist/docs/`. The AGENTS.md index already references `.next-docs` but the actual docs aren't present — this is the root blocker.

2. **Add `next-devtools-mcp` to `.mcp.json`** — single-file config, zero code changes. Gives any MCP-compatible agent live error detection, route introspection, and project metadata during development.

3. **Add PMS-specific coding conventions to AGENTS.md** outside the delimited markers:
   - Dashboard route group conventions (`(auth)`, `(dashboard)`)
   - Client component naming (`*-client.tsx`)
   - Error/loading boundary patterns already established
   - Server Action patterns, if any

4. **Add `BEGIN/END` delimited markers** around the Next.js-managed section so future `npx @next/codemod agents-md` runs don't clobber custom rules.

### Medium Term (1-2 months)

5. **Integrate Playwright MCP** for automated browser verification — agents can check rendered pages, not just code.

6. **Extend AGENTS.md with domain context** — link to PMS-specific docs (API schemas, data models, component library docs) so agents understand the domain, not just Next.js.

7. **Create per-route-group AGENTS.md files** — Next.js agents support hierarchical AGENTS.md. Put auth-specific rules in `app/(auth)/AGENTS.md`, dashboard rules in `app/(dashboard)/AGENTS.md`.

8. **Evaluate `next-devtools-mcp` for CI** — use `get_errors` tool programmatically to catch build/type errors that slip through.

---

## 4. Risks & Anti-Patterns to Avoid

| Risk | Why It Matters |
|------|---------------|
| **Oversized AGENTS.md** | Agents have context limits. Keep it directive, not encyclopedic. Point to docs, don't duplicate them. |
| **Stale `.next-docs` references** | AGENTS.md currently references `.next-docs` which doesn't exist. Agents hitting missing paths waste context on errors. Fix or remove. |
| **No delimiter markers** | Running `npx @next/codemod agents-md --output AGENTS.md` will overwrite custom content without markers. |
| **MCP in production** | `/_next/mcp` is dev-only. Never expose in production — it leaks internal app structure. |
| **Over-relying on agent accuracy** | Bundled docs improve accuracy but agents still hallucinate. Code review remains essential. |
| **Version mismatch** | If `next` version doesn't match docs version, agents get wrong APIs. Pin versions; avoid `latest` in production. |
| **Ignoring the MCP guide's scope** | MCP tools are read-only introspection — they don't replace testing, CI, or monitoring. |

---

## 5. Prioritized Action List (Top 10)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Fix `.next-docs` path — either upgrade Next.js to get bundled docs or update AGENTS.md to remove dead reference | Low | High |
| 2 | Add `BEGIN/END` delimiter markers to AGENTS.md around the Next.js section | Trivial | Medium |
| 3 | Add PMS project conventions to AGENTS.md (route groups, naming, patterns) | Low | High |
| 4 | Create `.mcp.json` with `next-devtools-mcp` config | Trivial | High |
| 5 | Verify Next.js version supports MCP endpoint (`/_next/mcp`); upgrade if needed | Low | High |
| 6 | Add per-route-group AGENTS.md files for `(auth)` and `(dashboard)` | Low | Medium |
| 7 | Document PMS data models / API schemas and link from AGENTS.md | Medium | High |
| 8 | Set up Playwright MCP for agent-driven browser testing | Medium | Medium |
| 9 | Audit current AGENTS.md size — ensure it stays under ~2K tokens for agent efficiency | Trivial | Low |
| 10 | Establish a process to regenerate AGENTS.md on Next.js upgrades (`npx @next/codemod agents-md`) | Low | Medium |

---

## Summary

The guide is narrow but high-leverage: it's about making AI coding agents work *correctly* with Next.js by feeding them version-accurate docs and live app state. PMS already has the file scaffolding (`AGENTS.md`, `CLAUDE.md`) but is missing the actual substance — bundled docs aren't present, MCP isn't configured, and there are no project-specific conventions for agents. The highest-ROI moves are fixing the docs path, adding MCP, and enriching AGENTS.md with PMS domain knowledge.
