# Dev Actions — Next.js AI Agents Guide

Date: 2026-03-01
Source: `docs/reports/researcher-nextjs-ai-agents-guide.md`

## Scope implemented

Implemented the requested top actions with minimal practical edits:

1. Fixed dead `.next-docs` guidance in `AGENTS.md` and related repo notes.
2. Added `next-devtools-mcp` integration in `.mcp.json`.
3. Enriched `AGENTS.md` with PMS-specific execution conventions.

## Changes made

### 1) AGENTS docs/source-of-truth cleanup

- Replaced outdated `AGENTS.md` block that hardcoded `./.next-docs` root.
- Added explicit guidance:
  - PMS runs `next@16.1.6`
  - prefer `node_modules/next/dist/docs` if present
  - fallback to `https://nextjs.org/docs` when bundled docs are unavailable
- Added delimiters:
  - `<!-- BEGIN:nextjs-agent-rules -->`
  - `<!-- END:nextjs-agent-rules -->`
- Added practical local checklist and Next MCP usage note.

Related docs touch:
- `.gitignore` comment updated to clarify `.next-docs/` is legacy/optional codemod output path.

### 2) next-devtools-mcp integration/config

Updated `.mcp.json` with:

```json
"next-devtools": {
  "command": "cmd",
  "args": ["/c", "npx", "-y", "next-devtools-mcp@latest"]
}
```

Kept existing MCP servers intact (`supabase`, `chrome-devtools`).

### 3) PMS-specific AGENTS conventions

Added concise conventions in `AGENTS.md` for:
- route groups (`app/(auth)`, `app/(dashboard)`)
- route-level `*-client.tsx` client wrapper pattern
- auth helpers (`getPageOrganization`, `requireAuth`, `requireOrgMember`)
- cache invalidation policy (`invalidateCache.*`)
- UI extension/reuse guidance

## Setup/usage notes added

- New doc: `docs/guides/nextjs-ai-agents.md`
  - how to run dev server and use `next-devtools`
  - dev-only MCP endpoint reminder
  - docs fallback strategy for current Next version

## Validation checks

Ran in workspace root:

1. `npx tsc --noEmit` ✅ (exit code 0)
2. `npm run build` ✅ (exit code 0)

Build notes:
- Next build completed successfully.
- Existing warning observed: deprecated `middleware` file convention (use `proxy`) — pre-existing, not modified in this task.
- Existing Sentry auth-token warnings in build output — pre-existing env/config state.

## Files changed

- `AGENTS.md`
- `.mcp.json`
- `.gitignore`
- `docs/guides/nextjs-ai-agents.md` (new)
- `docs/reports/dev-nextjs-ai-agents-guide-actions.md` (new)

## Git status

Implementation complete locally; ready to commit/push.
