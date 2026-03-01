# Product Analysis: Skills Marketplace Shows Only 8 Skills

**Date:** 2026-02-27  
**Analyst:** Product Analyst (subagent)  
**Severity:** Medium — feature gap, not a crash  

## Executive Summary

The Skills Marketplace page (`/skills/marketplace`) displays exactly **8 hardcoded skills** seeded from a static `DEFAULT_SKILLS` array in `lib/actions/skills.ts`. OpenClaw exposes **46+ skills** at runtime (web_search, browser, tts, exec, nodes, canvas, etc.), but PMS has zero integration with OpenClaw's actual skill inventory. The page is entirely self-referential — it reads/writes a Supabase `skills` table that was populated once from the hardcoded list and never syncs with the real gateway.

## Root Cause Trace

| Layer | File | Finding |
|-------|------|---------|
| Page server component | `app/(dashboard)/skills/marketplace/page.tsx` | Calls `getSkills(orgId)` → Supabase. If empty, calls `seedDefaultSkills(orgId)` which inserts exactly 8 rows. |
| Data action | `lib/actions/skills.ts` | `DEFAULT_SKILLS` array — 8 entries. `getSkills()` reads only from Supabase `skills` table. No OpenClaw API call anywhere. |
| Client component | `marketplace-client.tsx` | Pure display. Receives `initialSkills` prop. Filters/search work correctly on whatever data it gets. No issues here. |
| OpenClaw integration | **None** | No code in the codebase fetches the list of available skills from the OpenClaw gateway. The gateway exposes tools (skills) dynamically — the PMS never queries them. |

## Why Exactly 8?

The `DEFAULT_SKILLS` constant in `lib/actions/skills.ts` (line ~30-87) contains exactly 8 entries:
1. Web Search
2. Code Execution
3. File Management
4. Browser Control
5. Slack Integration
6. GitHub Integration
7. Email
8. Database Query

`seedDefaultSkills()` inserts these once per org. After that, the count never changes unless a user manually adds skills (which the UI doesn't support).

## Missing OpenClaw Skills (partial list)

Based on the tool definitions available to agents at runtime: `exec`, `process`, `web_search`, `web_fetch`, `browser`, `canvas`, `nodes`, `message`, `tts`, `image`, `subagents`, plus ~35 more from the OpenClaw skills system (camera, screen recording, location, notifications, dialog control, PDF generation, etc.).

## Impact

- Users see a misleadingly small marketplace — appears incomplete
- Installed/enabled state is disconnected from what OpenClaw actually has active
- No way to discover or install new skills added to OpenClaw

## Recommended Fix

See `specs/skills-marketplace-sync/spec.md` for the full design. In short:
1. Add a gateway API endpoint or use an existing OpenClaw API to list all available skills
2. On marketplace page load, fetch full skill catalog from gateway, merge with org's Supabase state (installed/enabled)
3. Replace `DEFAULT_SKILLS` seeding with dynamic catalog fetch
4. Keep Supabase as the org-specific state store (installed, enabled, config overrides)
