# SonarQube Code Quality Issues

**Scan Date:** February 4, 2026
**Total Issues:** 80
**Total Technical Debt:** 2 days 3 hours

## Summary

- **Critical Code Smells:** 73
- **Major Code Smells:** 2
- **Major Bugs:** 1
- **Total Effort:** 2d 3h

## Issue Categories

### Cognitive Complexity (41 issues)
Functions that are too complex and need to be broken down or simplified.

### Function Nesting (27 issues)
Code nested more than 4 levels deep, making it hard to read and maintain.

### Void Operator Usage (6 issues)
Unnecessary use of `void` operator that reduces code clarity.

### DOM API Issues (2 issues)
Prefer `.dataset` over direct attribute manipulation.

### Duplicate Literals in SQL (12 issues)
String literals duplicated in SQL migration files.

### Direct Function Passing (1 issue)
Function passed directly to `.map()` without proper handling.

---

## Issues by File

### app/api/ai/chat/route.ts (4 issues)

#### 1. High Cognitive Complexity (Line 11)
- **Severity:** Critical Code Smell
- **Effort:** 8min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. Void Operator Usage (Line 53)
- **Severity:** Critical Code Smell
- **Effort:** 5min
- **Issue:** Remove this use of the "void" operator
- **Category:** Intentionality, Maintainability
- **Tags:** confusing, type-dependent

#### 3. High Cognitive Complexity (Line 164)
- **Severity:** Critical Code Smell
- **Effort:** 18min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 4. Very High Cognitive Complexity (Line 743)
- **Severity:** Critical Code Smell
- **Effort:** 57min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 67 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### app/auth/callback/route.ts (1 issue)

#### 1. High Cognitive Complexity (Line 6)
- **Severity:** Critical Code Smell
- **Effort:** 6min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/app-sidebar.tsx (1 issue)

#### 1. Deep Function Nesting (Line 183)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/clients-content.tsx (1 issue)

#### 1. High Cognitive Complexity (Line 249)
- **Severity:** Critical Code Smell
- **Effort:** 8min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/color-theme-provider.tsx (2 issues)

#### 1. DOM API - removeAttribute (Line 80)
- **Severity:** Major Code Smell
- **Effort:** 5min
- **Issue:** Prefer `.dataset` over `removeAttribute(…)`
- **Category:** Consistency, Maintainability
- **Tags:** api, dom

#### 2. DOM API - setAttribute (Line 82)
- **Severity:** Major Code Smell
- **Effort:** 5min
- **Issue:** Prefer `.dataset` over `setAttribute(…)`
- **Category:** Consistency, Maintainability
- **Tags:** api, dom

---

### components/project-board-view.tsx (2 issues)

#### 1. Deep Function Nesting (Line 105)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. Deep Function Nesting (Line 152)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/project-timeline.tsx (8 issues)

#### 1-8. Deep Function Nesting (Lines 181, 195, 205, 224, 250, 292, 305)
- **Severity:** Critical Code Smell (all)
- **Effort:** 20min each (140min total)
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/project-wizard/steps/StepQuickCreate.tsx (2 issues)

#### 1. High Cognitive Complexity (Line 213)
- **Severity:** Critical Code Smell
- **Effort:** 15min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. High Cognitive Complexity (Line 355)
- **Severity:** Critical Code Smell
- **Effort:** 13min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/projects-content.tsx (1 issue)

#### 1. Deep Function Nesting (Line 272)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/projects/AddFileModal.tsx (1 issue)

#### 1. High Cognitive Complexity (Line 80)
- **Severity:** Critical Code Smell
- **Effort:** 12min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/projects/CreateWorkstreamModal.tsx (1 issue)

#### 1. High Cognitive Complexity (Line 122)
- **Severity:** Critical Code Smell
- **Effort:** 6min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/projects/WorkstreamTab.tsx (6 issues)

#### 1-4. Deep Function Nesting (Lines 178, 196, 255, 438)
- **Severity:** Critical Code Smell (all)
- **Effort:** 20min each (80min total)
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 5. Deep Function Nesting (Line 268)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 6. Very High Cognitive Complexity (Line 865)
- **Severity:** Critical Code Smell
- **Effort:** 28min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 38 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### components/tasks/TaskQuickCreateModal.tsx (1 issue)

#### 1. High Cognitive Complexity (Line 263)
- **Severity:** Critical Code Smell
- **Effort:** 9min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### e2e/pages/ProjectWizardPage.ts (1 issue)

#### 1. High Cognitive Complexity (Line 527)
- **Severity:** Critical Code Smell
- **Effort:** 6min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### hooks/use-ai-chat.ts (7 issues)

#### 1. High Cognitive Complexity (Line 81)
- **Severity:** Critical Code Smell
- **Effort:** 8min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. Very High Cognitive Complexity (Line 225)
- **Severity:** Critical Code Smell
- **Effort:** 36min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 46 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 3. Deep Function Nesting (Line 351)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 4. High Cognitive Complexity (Line 468)
- **Severity:** Critical Code Smell
- **Effort:** 20min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 30 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 5-7. Deep Function Nesting (Lines 505, 575, 604)
- **Severity:** Critical Code Smell (all)
- **Effort:** 20min each (60min total)
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### hooks/use-persisted-ai-chat.ts (6 issues)

#### 1. High Cognitive Complexity (Line 138)
- **Severity:** Critical Code Smell
- **Effort:** 8min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. Very High Cognitive Complexity (Line 314)
- **Severity:** Critical Code Smell
- **Effort:** 39min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 49 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 3. High Cognitive Complexity (Line 628)
- **Severity:** Critical Code Smell
- **Effort:** 22min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 32 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 4-6. Deep Function Nesting (Lines 658, 727, 753)
- **Severity:** Critical Code Smell (all)
- **Effort:** 20min each (60min total)
- **Issue:** Refactor this code to not nest functions more than 4 levels deep
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### hooks/use-project-files-realtime.ts (1 issue)

#### 1. Direct Function Passing (Line 54)
- **Severity:** Major Bug
- **Effort:** 5min
- **Issue:** Do not pass function `transformFile` directly to `.map(…)`
- **Category:** Intentionality, Reliability, Maintainability
- **Tags:** array, callback

---

### lib/actions/ai-helpers.ts (1 issue)

#### 1. High Cognitive Complexity (Line 10)
- **Severity:** Critical Code Smell
- **Effort:** 18min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### lib/actions/auth.ts (2 issues)

#### 1. Void Operator Usage (Line 126)
- **Severity:** Critical Code Smell
- **Effort:** 5min
- **Issue:** Remove this use of the "void" operator
- **Category:** Intentionality, Maintainability
- **Tags:** confusing, type-dependent

#### 2. Void Operator Usage (Line 146)
- **Severity:** Critical Code Smell
- **Effort:** 5min
- **Issue:** Remove this use of the "void" operator
- **Category:** Intentionality, Maintainability
- **Tags:** confusing, type-dependent

---

### lib/actions/execute-ai-action.ts (1 issue)

#### 1. Extremely High Cognitive Complexity (Line 43)
- **Severity:** Critical Code Smell
- **Effort:** 1h 22min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 92 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload
- **Note:** This is the most complex function in the codebase

---

### lib/actions/files.ts (1 issue)

#### 1. Void Operator Usage (Line 354)
- **Severity:** Critical Code Smell
- **Effort:** 5min
- **Issue:** Remove this use of the "void" operator
- **Category:** Intentionality, Maintainability
- **Tags:** confusing, type-dependent

---

### lib/actions/import.ts (2 issues)

#### 1. High Cognitive Complexity (Line 29)
- **Severity:** Critical Code Smell
- **Effort:** 18min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. Very High Cognitive Complexity (Line 102)
- **Severity:** Critical Code Smell
- **Effort:** 35min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 45 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### lib/actions/notes.ts (1 issue)

#### 1. Void Operator Usage (Line 219)
- **Severity:** Critical Code Smell
- **Effort:** 5min
- **Issue:** Remove this use of the "void" operator
- **Category:** Intentionality, Maintainability
- **Tags:** confusing, type-dependent

---

### lib/actions/projects/crud.ts (1 issue)

#### 1. High Cognitive Complexity (Line 17)
- **Severity:** Critical Code Smell
- **Effort:** 21min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 31 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### lib/actions/tasks.ts (3 issues)

#### 1. Very High Cognitive Complexity (Line 321)
- **Severity:** Critical Code Smell
- **Effort:** 31min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 41 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 2. High Cognitive Complexity (Line 477)
- **Severity:** Critical Code Smell
- **Effort:** 9min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

#### 3. High Cognitive Complexity (Line 723)
- **Severity:** Critical Code Smell
- **Effort:** 11min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### lib/actions/workstreams.ts (2 issues)

#### 1. Void Operator Usage (Line 99)
- **Severity:** Critical Code Smell
- **Effort:** 5min
- **Issue:** Remove this use of the "void" operator
- **Category:** Intentionality, Maintainability
- **Tags:** confusing, type-dependent

#### 2. High Cognitive Complexity (Line 189)
- **Severity:** Critical Code Smell
- **Effort:** 9min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### lib/transforms/project-details.ts (1 issue)

#### 1. High Cognitive Complexity (Line 45)
- **Severity:** Critical Code Smell
- **Effort:** 18min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### lib/utils/activity-formatter.ts (1 issue)

#### 1. High Cognitive Complexity (Line 4)
- **Severity:** Critical Code Smell
- **Effort:** 11min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### supabase/functions/check-deadlines/index.ts (1 issue)

#### 1. High Cognitive Complexity (Line 34)
- **Severity:** Critical Code Smell
- **Effort:** 6min
- **Issue:** Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed
- **Category:** Adaptability, Maintainability
- **Tag:** brain-overload

---

### supabase/migrations/20260122000001_initial_schema.sql (3 issues)

#### 1. Duplicate Literal (Line 13)
- **Severity:** Critical Code Smell
- **Effort:** 4min
- **Issue:** Define a constant instead of duplicating this literal 3 times
- **Category:** Adaptability, Maintainability
- **Tag:** design

#### 2. Duplicate Literal (Line 14)
- **Severity:** Critical Code Smell
- **Effort:** 4min
- **Issue:** Define a constant instead of duplicating this literal 3 times
- **Category:** Adaptability, Maintainability
- **Tag:** design

#### 3. Duplicate Literal (Line 28)
- **Severity:** Critical Code Smell
- **Effort:** 4min
- **Issue:** Define a constant instead of duplicating this literal 5 times
- **Category:** Adaptability, Maintainability
- **Tag:** design

---

### supabase/migrations/20260122000003_storage.sql (9 issues)

#### 1-9. Duplicate Literals (Lines 9, 13, 14, 14, 14, 15, 17, 19, 211)
- **Severity:** Critical Code Smell (all)
- **Effort:** 4min each (36min total)
- **Issue:** Define constants instead of duplicating literals (3-7 times each)
- **Category:** Adaptability, Maintainability
- **Tag:** design

---

### supabase/migrations/20260130000003_workflow_statuses.sql (5 issues)

#### 1-5. Duplicate Literals (Lines 7, 7, 7, 10, 10)
- **Severity:** Critical Code Smell (all)
- **Effort:** 4min each (20min total)
- **Issue:** Define constants instead of duplicating literals (4-6 times each)
- **Category:** Adaptability, Maintainability
- **Tag:** design

---

### supabase/migrations/20260203000001_task_comments.sql (1 issue)

#### 1. Duplicate Literal (Line 246)
- **Severity:** Critical Code Smell
- **Effort:** 4min
- **Issue:** Define a constant instead of duplicating this literal 5 times
- **Category:** Adaptability, Maintainability
- **Tag:** design

---

## Recommended Refactoring Priority

### 🔴 Critical Priority (Address First)

1. **lib/actions/execute-ai-action.ts:43** - Complexity 92 (1h 22min)
2. **app/api/ai/chat/route.ts:743** - Complexity 67 (57min)
3. **hooks/use-persisted-ai-chat.ts:314** - Complexity 49 (39min)
4. **hooks/use-ai-chat.ts:225** - Complexity 46 (36min)
5. **lib/actions/import.ts:102** - Complexity 45 (35min)

### 🟡 High Priority

- All functions with Cognitive Complexity > 25
- All deeply nested code (>4 levels)
- Files with multiple issues (project-timeline.tsx, WorkstreamTab.tsx, use-ai-chat.ts)

### 🟢 Medium Priority

- Void operator removals (quick wins, 5min each)
- DOM API improvements (5min each)
- Remaining cognitive complexity issues (15-25)

### 🔵 Low Priority

- SQL duplicate literals (can be addressed during next migration refactor)

---

## Refactoring Strategies

### For High Cognitive Complexity
1. **Extract helper functions** - Break complex logic into smaller, named functions
2. **Use early returns** - Reduce nesting with guard clauses
3. **Extract to separate files** - Large functions handling multiple concerns
4. **Simplify conditionals** - Use lookup tables or strategy patterns

### For Deep Nesting
1. **Extract nested logic** - Move inner functions to module level
2. **Use async/await** - Flatten promise chains
3. **Array methods** - Replace loops with map/filter/reduce
4. **Early exits** - Return early to reduce nesting

### For Void Operator
Replace `void functionCall()` with:
- `functionCall()` if return value is intentionally ignored
- Store return value if it might be useful later
- Add TypeScript `@ts-expect-error` comment if truly necessary

### For DOM API Issues
Replace:
```typescript
element.removeAttribute('data-theme')
element.setAttribute('data-theme', 'dark')
```
With:
```typescript
delete element.dataset.theme
element.dataset.theme = 'dark'
```

---

## Next Steps

1. **Review top 5 critical issues** and plan refactoring approach
2. **Create tickets** for each high-priority refactoring task
3. **Set up pre-commit hooks** to prevent new complexity issues
4. **Configure SonarQube** to block PRs with Critical issues
5. **Refactor incrementally** - tackle 2-3 issues per sprint

---

*Generated from SonarQube scan on February 4, 2026*
