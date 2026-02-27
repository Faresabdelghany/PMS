# Dev Report: Skills Marketplace Sync Fix

**Date:** 2026-02-27  
**Scope:** Minimal safe fix for marketplace catalog/state sync

## What was implemented

### 1) Replaced hardcoded 8-skill behavior with dynamic catalog source
- Added `getMarketplaceSkills(orgId)` in `lib/actions/skills.ts`.
- Implemented gateway catalog fetch logic that tries common skills/tools endpoints:
  - `/api/skills`
  - `/api/skills/list`
  - `/skills`
  - `/api/tools`
  - `/tools`
- Catalog parsing supports multiple response shapes (`array`, `{skills}`, `{tools}`, `{data}`) and normalizes to a catalog type.

### 2) Merged org-specific installed/enabled state from Supabase
- Added merge logic by skill name (case-insensitive):
  - Catalog metadata is source of truth for display metadata.
  - Existing Supabase row preserves org state (`installed`, `enabled`, `config`, real DB `id`).
- Orphaned org skills (present in Supabase but missing from catalog) are retained in output.
- Deduping enforced by name.

### 3) Preserved filters/categories and prevented duplicates
- Marketplace client continues deriving categories dynamically from returned skills.
- Removed fixed union category typing so new categories render naturally.
- Added safe color mappings for new categories (`nodes`, `media`) without UI rewrites.

### 4) Added graceful fallback when source unavailable
- Added static fallback catalog (`FALLBACK_SKILL_CATALOG`) in `lib/actions/skills.ts` (14 entries, >8).
- If gateway is unavailable or no endpoint responds, marketplace uses fallback and sets `degraded: true`.
- Added subtle banner in client when fallback mode is active.

### 5) Fixed install/uninstall for catalog-only rows
- Catalog-only skills have synthetic IDs (`catalog-*`) until installed.
- In marketplace client:
  - If synthetic ID, install/uninstall uses `upsertSkill(orgId, ...)`.
  - If real DB ID, uses existing `updateSkill(id, ...)`.
- This keeps installed indicators accurate and creates real Supabase rows when needed.

## Files changed

1. `lib/actions/skills.ts`
2. `app/(dashboard)/skills/marketplace/page.tsx`
3. `app/(dashboard)/skills/marketplace/marketplace-client.tsx`
4. `docs/reports/dev-skills-marketplace-sync.md`

## Validation

- ✅ `npm run build` passes (includes TypeScript check).
- ✅ Marketplace data source now returns dynamic gateway catalog when available.
- ✅ Fallback catalog is 14 skills, ensuring count >8 even when gateway is unavailable.
- ✅ Installed indicators remain driven by org Supabase state via merge overlay.

## Notes

- `seedDefaultSkills` was kept for backward compatibility but now seeds from fallback catalog (not old hardcoded-8 list).
- Scope intentionally limited to marketplace catalog/state sync, no unrelated UI restructuring.
