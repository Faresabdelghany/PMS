# Reviewer Fix: app-sidebar.tsx

**Date:** 2026-03-01  
**Commit:** `4f5c4c3`  
**Status:** ✅ Pushed to main

## Issues Found

### 1. Literal `\n` characters in `footerItems` array
The regex edit that removed items from `footerItems` left literal backslash-n sequences instead of actual newlines, producing malformed JavaScript syntax that survived only because the JS parser treated them as whitespace in that context.

### 2. Orphaned `models` NavItemId
`models` was present in:
- `NavItemId` type union
- `preloadHandlers` record
- `navItemIcons` record

But was **not** in the `navItems` array, `getHrefForNavItem`, or `isItemActive`. Dead code left behind from a prior removal pass.

## What Was Fixed

1. Replaced literal `\n` with proper newlines in `footerItems`.
2. Removed `models` from `NavItemId`, `preloadHandlers`, and `navItemIcons`.

## Verification

- `tsc --noEmit` passes with exit code 0.
- Boards, Board Groups, Templates, and Help confirmed fully removed.
- All remaining nav items have consistent entries across type, icons, routes, preloaders, and active-state checks.
