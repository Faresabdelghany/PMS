# Sara Design Fix Report

**Date:** 2026-02-23  
**Engineer:** Sara (Senior Frontend Developer)  
**Status:** ✅ ALL 4 DESIGN FIXES APPLIED — Build passes (0 TypeScript errors)

---

## DESIGN FIX 1 — Page wrapper consistency ✅ FIXED

**Target wrapper:** `<div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">`

| Page | Status | Action |
|------|--------|--------|
| `app/(dashboard)/agents/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |
| `app/(dashboard)/agents/communication/page.tsx` | ✅ Already correct | No change needed |
| `app/(dashboard)/approvals/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |
| `app/(dashboard)/gateways/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |
| `app/(dashboard)/boards/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |
| `app/(dashboard)/skills/marketplace/page.tsx` | ✅ Fixed | Added wrapper div around `<SkillsMarketplaceClient>` |
| `app/(dashboard)/tags/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |
| `app/(dashboard)/activity/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |
| `app/(dashboard)/custom-fields/page.tsx` | ✅ Fixed | Replaced `flex flex-col flex-1` with correct wrapper |

---

## DESIGN FIX 2 — AgentDetailPanel header/footer match TaskDetailPanel ✅ FIXED

**File:** `components/agents/AgentDetailPanel.tsx`

**Changes:**
- `SheetContent`: Removed `overflow-y-auto` from SheetContent (scroll stays on inner div) — matches `p-0 flex flex-col` pattern
- `SheetHeader` padding: `p-6 pb-4` → `px-5 pt-5 pb-4` — matches TaskDetail header padding pattern
- Added `flex-shrink-0` to SheetHeader to prevent flex shrinking
- `SheetTitle` now has explicit `text-base font-semibold leading-snug` class — matches TaskDetail title style
- Inner content div: `p-6` → `px-5 py-4` — consistent horizontal padding
- Loading skeleton: `p-6` → `px-5 py-4` — consistent
- Footer remains: `border-t border-border p-4 flex items-center justify-end gap-2` — already correct

---

## DESIGN FIX 3 — Tasks page tab underline style ✅ VERIFIED (already correct)

**File:** `app/(dashboard)/tasks/page.tsx`

**Status:** The tasks page already had the correct tab underline pattern:
```tsx
className="relative -mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 
  text-sm font-medium text-muted-foreground 
  data-[state=active]:border-primary data-[state=active]:text-foreground 
  bg-transparent shadow-none"
```
This matches the design system spec (`border-b-2 border-primary` on active state). No change required.

---

## DESIGN FIX 4 — No hardcoded colors ✅ FIXED

**Search scope:** All MC components and pages

**Findings:**
- `components/priority-badge.tsx`: `rgb(228, 228, 231)` used for inactive SVG bars → replaced with `var(--border)` CSS variable
- `app/(dashboard)/tags/tags-client.tsx`: Hex values are **data** (tag color swatches for user selection) — intentional, not CSS styling
- `login-form.tsx`, `signup-form.tsx`: Google OAuth button SVG `fill` colors — **brand colors**, not replaceable with CSS variables  
- `syntax-highlighter-lazy.tsx`: `bg-[#282c34]` — code editor dark theme color, acceptable for this specific context

**Fixed:** `components/priority-badge.tsx` — 2 instances of `rgb(228, 228, 231)` → `var(--border)`

---

## Build Verification

```
✓ Compiled successfully in 32.0s
✓ Running TypeScript — 0 errors
✓ Build exit code: 0
```
