# E2E Test Failures Report

**Date:** 2026-01-28
**Total Failed Tests:** 26
**Test Framework:** Playwright

---

## Summary

Most failures are concentrated in **project-related operations**, suggesting issues with:
- Project details page loading/rendering
- UI element selectors may have changed
- Authentication state not persisting correctly for protected routes
- Timeout issues on slower operations

---

## Failed Tests by Category

### 1. Project Creation - Mode Selection (3 failures)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| QC-001 | Quick mode option displayed | `project-create.spec.ts:14` | The test expects to find a "Quick" mode option in the project creation wizard but it's either not rendering or the selector has changed. |
| QC-002 | Guided mode option displayed | `project-create.spec.ts:22` | Similar to QC-001 - the "Guided" mode option is not being found. This suggests the mode selection step UI may have been modified. |
| QC-004 | Cancel from mode selection closes wizard | `project-create.spec.ts:40` | The cancel button either doesn't exist, has a different label, or the wizard isn't closing properly when clicked. |

**Root Cause Hypothesis:** The project wizard mode selection UI may have been redesigned or the test selectors are outdated.

---

### 2. Project Creation - Submission (1 failure)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| QC-019 | Project appears in list after creation | `project-create.spec.ts:199` | After creating a project, the test checks if it appears in the project list. The project may be created but the list isn't refreshing, or there's a timing issue with real-time updates. |

**Root Cause Hypothesis:** Real-time subscription may not be triggering a UI refresh, or the test isn't waiting long enough for the new project to appear.

---

### 3. Project Wizard - Ownership Step (1 failure)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| PW-014 | Owner selection is required | `project-create.spec.ts:293` | The test verifies that selecting an owner is mandatory. Either the validation isn't working, or the UI for owner selection has changed. |

**Root Cause Hypothesis:** The ownership step in the wizard may have different validation rules or UI structure than expected.

---

### 4. Project CRUD Operations (7 failures)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| PC-002 | Get single project opens details | `project-crud.spec.ts:42` | Clicking a project should navigate to its details page. The navigation may be failing or the details page has loading issues. |
| PC-003 | Project shows relations (client, team, members) | `project-crud.spec.ts:53` | The project details page should display related data. Relations may not be loading from Supabase correctly. |
| PC-005 | Update project name | `project-crud.spec.ts:84` | Editing the project name isn't working - either the edit UI isn't accessible or the save action fails. |
| PC-007 | Update project status | `project-crud.spec.ts:106` | Status dropdown or update functionality is broken. |
| PC-008 | Update project priority | `project-crud.spec.ts:126` | Priority dropdown or update functionality is broken. |
| PC-014 | Delete project | `project-crud.spec.ts:146` | Project deletion isn't completing - either the delete button isn't found or the server action fails. |
| PC-015 | Delete confirmation dialog shown | `project-crud.spec.ts:166` | The confirmation dialog before deletion isn't appearing. |
| PC-016 | Cancel delete keeps project | `project-crud.spec.ts:186` | The cancel button in delete confirmation may not be working. |

**Root Cause Hypothesis:** The project details page (`ProjectDetailsPage.tsx`) may have UI changes that don't match test selectors, or there are issues with the server actions for CRUD operations.

---

### 5. Project Status & Priority Tests (9 failures)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| PS-001 | backlog status | `project-crud.spec.ts:208` | Setting project status to "backlog" fails |
| PS-002 | planned status | `project-crud.spec.ts:208` | Setting project status to "planned" fails |
| PS-003 | active status | `project-crud.spec.ts:208` | Setting project status to "active" fails |
| PS-004 | cancelled status | `project-crud.spec.ts:208` | Setting project status to "cancelled" fails |
| PS-005 | completed status | `project-crud.spec.ts:208` | Setting project status to "completed" fails |
| PS-006 | urgent priority | `project-crud.spec.ts:229` | Setting project priority to "urgent" fails |
| PS-007 | high priority | `project-crud.spec.ts:229` | Setting project priority to "high" fails |
| PS-008 | medium priority | `project-crud.spec.ts:229` | Setting project priority to "medium" fails |
| PS-009 | low priority | `project-crud.spec.ts:229` | Setting project priority to "low" fails |

**Root Cause Hypothesis:** All these tests depend on the status/priority dropdowns working. Since all fail, it's likely a common issue:
- The dropdown component may have changed
- The test selectors don't match the current UI
- There may be an issue navigating to the project details page first

---

### 6. Project Membership Tests (1 failure)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| PM-013 | Creator is auto-added as owner | `project-crud.spec.ts:250` | When creating a project, the creator should automatically be added as the owner. This may be a backend issue or the test can't verify the membership. |

**Root Cause Hypothesis:** Either the auto-add logic in the server action isn't working, or the test can't access the members list to verify.

---

### 7. Project Filtering & Search (3 failures)

| Test ID | Test Name | File | Explanation |
|---------|-----------|------|-------------|
| PF-001 | Search by project name | `project-filters.spec.ts:35` | The search functionality on the projects list page isn't finding projects by name. |
| PF-002 | Search by description | `project-filters.spec.ts:54` | Search by description content isn't working. |
| PF-003 | Search is case insensitive | `project-filters.spec.ts:72` | Case-insensitive search isn't functioning as expected. |

**Root Cause Hypothesis:** The search/filter component on the projects page may have been modified, or the search action isn't returning results correctly.

---

## Recommended Investigation Order

1. **Start with PC-002** - If opening project details fails, it cascades to all other project CRUD tests
2. **Check project wizard UI** - QC-001, QC-002 failures suggest mode selection changed
3. **Verify search component** - PF-001 through PF-003 failures indicate search functionality issues
4. **Review server actions** - Check `lib/actions/projects.ts` for any recent changes

---

## Files to Investigate

| File | Reason |
|------|--------|
| `components/projects/ProjectDetailsPage.tsx` | Most CRUD tests interact with this page |
| `components/project-wizard/` | Mode selection and wizard flow tests failing |
| `components/projects/ProjectsListPage.tsx` | Search and filter tests failing |
| `lib/actions/projects.ts` | Server actions for project operations |
| `e2e/pages/ProjectsPage.ts` | Page object selectors may be outdated |

---

## Next Steps

1. Run a single failing test in debug mode to see what's happening:
   ```bash
   pnpm test:e2e --debug e2e/project-crud.spec.ts -g "PC-002"
   ```

2. Check if the project details page loads correctly manually

3. Compare test selectors with actual UI elements

4. Review recent commits for changes to project-related components
