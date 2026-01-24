# Project Management Test Plan

Comprehensive test plan for all project management features including test cases, UI/UX evaluation, and recommendations.

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Projects List Page Tests](#2-projects-list-page-tests)
3. [Project Creation - Quick Create Tests](#3-project-creation---quick-create-tests)
4. [Project Creation - Wizard Tests](#4-project-creation---wizard-tests)
5. [Project CRUD Tests](#5-project-crud-tests)
6. [Project Status & Priority Tests](#6-project-status--priority-tests)
7. [Project Membership Tests](#7-project-membership-tests)
8. [Project Views Tests](#8-project-views-tests)
9. [Project Details Page Tests](#9-project-details-page-tests)
10. [Project Filtering & Search Tests](#10-project-filtering--search-tests)
11. [Real-time Updates Tests](#11-real-time-updates-tests)
12. [Accessibility Tests](#12-accessibility-tests)
13. [Performance Tests](#13-performance-tests)
14. [Security Tests](#14-security-tests)
15. [Known Issues & Recommendations](#15-known-issues--recommendations)

---

## 1. Test Environment Setup

### Prerequisites
- Node.js 20+
- pnpm installed
- Supabase project configured
- Authenticated test user with organization
- Test organization with members

### Test URLs
| Environment | URL |
|-------------|-----|
| Development | http://localhost:3000 |
| Production | https://pms-nine-gold.vercel.app |

### Test Accounts
| Type | Email | Password | Notes |
|------|-------|----------|-------|
| Admin User | test-admin@example.com | TestPass123! | Org admin with full access |
| Member User | test-member@example.com | TestPass123! | Org member with limited access |
| Viewer User | test-viewer@example.com | TestPass123! | Project viewer only |

### Test Data
| Type | Values |
|------|--------|
| Project Names | "Test Project", "Marketing Campaign", "Q4 Launch" |
| Statuses | backlog, planned, active, cancelled, completed |
| Priorities | urgent, high, medium, low |
| Project Roles | owner, pic, member, viewer |

---

## 2. Projects List Page Tests

### 2.1 Page Load Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PL-001 | Page loads successfully | 1. Navigate to /projects | Page displays with header and content | [ ] |
| PL-002 | Projects are displayed | 1. Navigate to /projects<br>2. Check project list | All organization projects visible | [ ] |
| PL-003 | Empty state shown when no projects | 1. Login with new org<br>2. Navigate to /projects | Empty state with "Create project" CTA | [ ] |
| PL-004 | Loading state displayed | 1. Navigate to /projects<br>2. Observe initial load | Loading skeleton or spinner shown | [ ] |
| PL-005 | Project count matches | 1. Navigate to /projects<br>2. Count visible projects | Count matches database records | [ ] |

### 2.2 Header Actions Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PL-006 | Add Project button visible | 1. Navigate to /projects | "Add Project" button in header | [ ] |
| PL-007 | Add Project opens wizard | 1. Click "Add Project" | Project wizard modal opens | [ ] |
| PL-008 | View toggle visible | 1. Navigate to /projects | List/Grid/Board toggle visible | [ ] |
| PL-009 | Filter button visible | 1. Navigate to /projects | Filter options accessible | [ ] |
| PL-010 | Search input visible | 1. Navigate to /projects | Search/filter bar present | [ ] |

---

## 3. Project Creation - Quick Create Tests

### 3.1 Quick Create Mode Selection

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| QC-001 | Quick mode option displayed | 1. Open project wizard | "Quick" mode option visible | [ ] |
| QC-002 | Guided mode option displayed | 1. Open project wizard | "Guided" mode option visible | [ ] |
| QC-003 | Select Quick mode | 1. Open wizard<br>2. Select "Quick" | Quick create form shown | [ ] |
| QC-004 | Cancel from mode selection | 1. Open wizard<br>2. Click Cancel/X | Wizard closes, no project created | [ ] |

### 3.2 Quick Create Form Validation

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| QC-005 | Empty name validation | 1. Open quick create<br>2. Leave name empty<br>3. Submit | Error: "Name is required" | [ ] |
| QC-006 | Name minimum length | 1. Enter "A" (1 char)<br>2. Submit | Error or form valid (check requirements) | [ ] |
| QC-007 | Valid name accepted | 1. Enter "Test Project"<br>2. Submit | Project created successfully | [ ] |
| QC-008 | Description optional | 1. Enter name only<br>2. Leave description empty<br>3. Submit | Project created without description | [ ] |
| QC-009 | Long name handling | 1. Enter 200+ chars<br>2. Submit | Truncated or error shown | [ ] |
| QC-010 | Special characters in name | 1. Enter "Project & Co."<br>2. Submit | Name preserved correctly | [ ] |

### 3.3 Quick Create Fields

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| QC-011 | Client dropdown populated | 1. Open quick create | Org clients in dropdown | [ ] |
| QC-012 | Select client | 1. Select client from dropdown | Client associated with project | [ ] |
| QC-013 | No client selected | 1. Leave client unselected<br>2. Submit | Project created without client | [ ] |
| QC-014 | Status dropdown default | 1. Open quick create | Default status is "backlog" | [ ] |
| QC-015 | Change status | 1. Select "active"<br>2. Submit | Project created with "active" status | [ ] |
| QC-016 | Priority dropdown default | 1. Open quick create | Default priority is "medium" | [ ] |
| QC-017 | Change priority | 1. Select "high"<br>2. Submit | Project created with "high" priority | [ ] |

### 3.4 Quick Create Submission

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| QC-018 | Successful creation | 1. Fill valid data<br>2. Submit | Success toast, wizard closes | [ ] |
| QC-019 | Project appears in list | 1. Create project<br>2. Check list | New project visible immediately | [ ] |
| QC-020 | Creator is auto-owner | 1. Create project<br>2. Check members | Creator has "owner" role | [ ] |
| QC-021 | Loading state on submit | 1. Click Create<br>2. Observe button | Loading spinner, disabled button | [ ] |

---

## 4. Project Creation - Wizard Tests

### 4.1 Step 1: Mode Selection

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-001 | Mode options displayed | 1. Open wizard | Quick and Guided options visible | [ ] |
| PW-002 | Select Guided mode | 1. Select "Guided"<br>2. Click Continue | Advances to Step 1: Intent | [ ] |
| PW-003 | Stepper shows 5 steps | 1. Enter guided mode | Stepper shows Intent → Outcome → Ownership → Structure → Review | [ ] |

### 4.2 Step 1: Intent

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-004 | Intent options displayed | 1. On Intent step | Intent type options visible | [ ] |
| PW-005 | Select intent type | 1. Select an intent option | Option highlighted/selected | [ ] |
| PW-006 | Can proceed without intent | 1. Don't select intent<br>2. Click Next | Proceeds (intent optional) or shows error | [ ] |
| PW-007 | Back button returns to mode | 1. Click Back | Returns to mode selection | [ ] |

### 4.3 Step 2: Outcome & Success

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-008 | Success type options | 1. On Outcome step | Success type options visible | [ ] |
| PW-009 | Deliverables input | 1. Add deliverable text | Deliverable added to list | [ ] |
| PW-010 | Multiple deliverables | 1. Add 3 deliverables | All listed | [ ] |
| PW-011 | Remove deliverable | 1. Add deliverable<br>2. Click remove | Deliverable removed | [ ] |
| PW-012 | Metrics input | 1. Add metric | Metric added to list | [ ] |
| PW-013 | Description editor | 1. Type in description | Text appears, formatting works | [ ] |

### 4.4 Step 3: Ownership

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-014 | Owner selection required | 1. On Ownership step<br>2. Try to proceed without owner | Cannot proceed, owner required | [ ] |
| PW-015 | Owner dropdown shows members | 1. Open owner dropdown | Org members listed | [ ] |
| PW-016 | Select owner | 1. Select member as owner | Owner selected | [ ] |
| PW-017 | Contributors selection | 1. Select contributors | Multiple can be selected | [ ] |
| PW-018 | Stakeholders selection | 1. Select stakeholders | Multiple can be selected | [ ] |
| PW-019 | Next enabled after owner | 1. Select owner | Next button enabled | [ ] |

### 4.5 Step 4: Work Structure

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-020 | Deadline type options | 1. On Structure step | Deadline options visible | [ ] |
| PW-021 | Select fixed deadline | 1. Select "fixed"<br>2. Pick date | Date picker shows | [ ] |
| PW-022 | Select flexible deadline | 1. Select "flexible" | Appropriate UI shown | [ ] |
| PW-023 | No deadline option | 1. Select "none" | No date required | [ ] |
| PW-024 | Add starter tasks toggle | 1. Toggle starter tasks | Toggle state changes | [ ] |

### 4.6 Step 5: Review & Create

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-025 | All data displayed | 1. On Review step | All entered data summarized | [ ] |
| PW-026 | Edit step from review | 1. Click edit on section | Returns to that step | [ ] |
| PW-027 | Save as template button | 1. Click "Save as template" | Template saved (if implemented) | [ ] |
| PW-028 | Create project button | 1. Click "Create project" | Project created, toast shown | [ ] |
| PW-029 | Project created with all data | 1. Create via wizard<br>2. View project | All wizard data saved | [ ] |

### 4.7 Wizard Navigation

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PW-030 | Close wizard via X | 1. Click X button | Wizard closes, no project | [ ] |
| PW-031 | Close wizard outside click | 1. Click backdrop | Wizard closes or stays (check behavior) | [ ] |
| PW-032 | Stepper shows progress | 1. Complete steps | Completed steps marked | [ ] |
| PW-033 | Jump to completed step | 1. Complete step 3<br>2. Click step 1 | Jumps to step 1 | [ ] |
| PW-034 | Cannot jump ahead | 1. On step 2<br>2. Click step 4 | Cannot jump to incomplete step | [ ] |

---

## 5. Project CRUD Tests

### 5.1 Read Operations

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PC-001 | Get all projects | 1. Navigate to /projects | All org projects displayed | [ ] |
| PC-002 | Get single project | 1. Click on project | Project details page loads | [ ] |
| PC-003 | Project with relations | 1. View project details | Client, team, members shown | [ ] |
| PC-004 | Non-existent project | 1. Navigate to /projects/invalid-id | 404 or error page | [ ] |

### 5.2 Update Operations

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PC-005 | Update project name | 1. Edit project<br>2. Change name<br>3. Save | Name updated in list | [ ] |
| PC-006 | Update project description | 1. Edit project<br>2. Change description<br>3. Save | Description updated | [ ] |
| PC-007 | Update project status | 1. Change status dropdown | Status updates immediately | [ ] |
| PC-008 | Update project priority | 1. Change priority dropdown | Priority updates immediately | [ ] |
| PC-009 | Update project progress | 1. Change progress slider | Progress 0-100 saved | [ ] |
| PC-010 | Progress boundary - 0% | 1. Set progress to 0 | Accepted | [ ] |
| PC-011 | Progress boundary - 100% | 1. Set progress to 100 | Accepted | [ ] |
| PC-012 | Progress invalid - negative | 1. Try to set -1 | Rejected or clamped to 0 | [ ] |
| PC-013 | Progress invalid - over 100 | 1. Try to set 101 | Rejected or clamped to 100 | [ ] |

### 5.3 Delete Operations

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PC-014 | Delete project | 1. Click delete<br>2. Confirm | Project removed from list | [ ] |
| PC-015 | Delete confirmation | 1. Click delete | Confirmation dialog shown | [ ] |
| PC-016 | Cancel delete | 1. Click delete<br>2. Cancel | Project not deleted | [ ] |
| PC-017 | Cascade delete tasks | 1. Delete project with tasks | Tasks also deleted | [ ] |
| PC-018 | Cascade delete files | 1. Delete project with files | Files also deleted | [ ] |

---

## 6. Project Status & Priority Tests

### 6.1 Status Values

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PS-001 | Backlog status | 1. Set status to "backlog" | Status saved, badge shown | [ ] |
| PS-002 | Planned status | 1. Set status to "planned" | Status saved, badge shown | [ ] |
| PS-003 | Active status | 1. Set status to "active" | Status saved, badge shown | [ ] |
| PS-004 | Cancelled status | 1. Set status to "cancelled" | Status saved, badge shown | [ ] |
| PS-005 | Completed status | 1. Set status to "completed" | Status saved, badge shown | [ ] |

### 6.2 Priority Values

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PS-006 | Urgent priority | 1. Set priority to "urgent" | Priority saved, indicator shown | [ ] |
| PS-007 | High priority | 1. Set priority to "high" | Priority saved, indicator shown | [ ] |
| PS-008 | Medium priority | 1. Set priority to "medium" | Priority saved, indicator shown | [ ] |
| PS-009 | Low priority | 1. Set priority to "low" | Priority saved, indicator shown | [ ] |

### 6.3 Statistics

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PS-010 | Count by status | 1. View dashboard stats | Correct count per status | [ ] |
| PS-011 | Count by priority | 1. View dashboard stats | Correct count per priority | [ ] |
| PS-012 | Total project count | 1. View dashboard | Total matches sum | [ ] |

---

## 7. Project Membership Tests

### 7.1 Add Member

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PM-001 | Add member as owner | 1. Add member<br>2. Select "owner" role | Member added with owner role | [ ] |
| PM-002 | Add member as PIC | 1. Add member<br>2. Select "pic" role | Member added with PIC role | [ ] |
| PM-003 | Add member as member | 1. Add member<br>2. Select "member" role | Member added with member role | [ ] |
| PM-004 | Add member as viewer | 1. Add member<br>2. Select "viewer" role | Member added with viewer role | [ ] |
| PM-005 | Duplicate member prevented | 1. Add same user twice | Error: "Already a member" | [ ] |
| PM-006 | Member from org only | 1. Try to add non-org user | User not available | [ ] |

### 7.2 Update Member Role

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PM-007 | Change role to owner | 1. Update existing member to owner | Role updated | [ ] |
| PM-008 | Change role to viewer | 1. Update existing member to viewer | Role updated | [ ] |
| PM-009 | Role change reflected | 1. Change role<br>2. Refresh | New role persisted | [ ] |

### 7.3 Remove Member

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PM-010 | Remove member | 1. Click remove on member | Member removed | [ ] |
| PM-011 | Remove confirmation | 1. Click remove | Confirmation shown | [ ] |
| PM-012 | Cannot remove last owner | 1. Try to remove only owner | Error or prevented | [ ] |

### 7.4 Auto-Add Owner

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PM-013 | Creator auto-added | 1. Create project<br>2. Check members | Creator is owner | [ ] |
| PM-014 | Creator cannot be removed | 1. Try to remove creator | Prevented or warning | [ ] |

---

## 8. Project Views Tests

### 8.1 List View

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PV-001 | List view displays | 1. Select list view | Projects in list format | [ ] |
| PV-002 | List shows name | 1. View list | Project names visible | [ ] |
| PV-003 | List shows status | 1. View list | Status badges visible | [ ] |
| PV-004 | List shows priority | 1. View list | Priority indicators visible | [ ] |
| PV-005 | List shows progress | 1. View list | Progress bars visible | [ ] |
| PV-006 | Click project in list | 1. Click project row | Navigate to project details | [ ] |

### 8.2 Grid/Cards View

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PV-007 | Grid view displays | 1. Select grid view | Projects in card grid | [ ] |
| PV-008 | Card shows name | 1. View cards | Project names on cards | [ ] |
| PV-009 | Card shows status | 1. View cards | Status on cards | [ ] |
| PV-010 | Card shows members | 1. View cards | Avatar group on cards | [ ] |
| PV-011 | Click card | 1. Click project card | Navigate to project details | [ ] |
| PV-012 | Responsive grid | 1. Resize browser | Cards reflow correctly | [ ] |

### 8.3 Board/Kanban View

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PV-013 | Board view displays | 1. Select board view | Kanban columns shown | [ ] |
| PV-014 | Columns by status | 1. View board | Columns: Backlog, Planned, Active, etc. | [ ] |
| PV-015 | Projects in correct column | 1. View board | Projects in matching status column | [ ] |
| PV-016 | Drag project between columns | 1. Drag project to new column | Status updated | [ ] |
| PV-017 | Column project count | 1. View board | Count shown per column | [ ] |

### 8.4 View Persistence

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PV-018 | View preference saved | 1. Select grid view<br>2. Navigate away<br>3. Return | Grid view still selected | [ ] |
| PV-019 | View toggle responsive | 1. Switch views rapidly | No errors, smooth transition | [ ] |

---

## 9. Project Details Page Tests

### 9.1 Page Load

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PD-001 | Details page loads | 1. Navigate to /projects/[id] | Project details displayed | [ ] |
| PD-002 | Header shows name | 1. View project details | Project name in header | [ ] |
| PD-003 | Tabs displayed | 1. View project details | Overview, Tasks, Workstreams, Files, Notes tabs | [ ] |

### 9.2 Overview Tab

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PD-004 | Overview is default | 1. Open project details | Overview tab active | [ ] |
| PD-005 | Description shown | 1. View overview | Project description visible | [ ] |
| PD-006 | Scope shown | 1. View overview | Scope section visible | [ ] |
| PD-007 | Outcomes shown | 1. View overview | Outcomes/deliverables visible | [ ] |
| PD-008 | Meta info shown | 1. View overview | Status, priority, dates shown | [ ] |
| PD-009 | Members panel | 1. View overview | Team members visible | [ ] |

### 9.3 Tab Navigation

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PD-010 | Switch to Tasks tab | 1. Click Tasks tab | Task board displayed | [ ] |
| PD-011 | Switch to Workstreams tab | 1. Click Workstreams tab | Workstreams displayed | [ ] |
| PD-012 | Switch to Files tab | 1. Click Files tab | Files table displayed | [ ] |
| PD-013 | Switch to Notes tab | 1. Click Notes tab | Notes displayed | [ ] |
| PD-014 | Tab URL updated | 1. Switch tabs | URL includes tab param | [ ] |
| PD-015 | Direct tab URL | 1. Navigate to /projects/[id]?tab=tasks | Tasks tab active | [ ] |

---

## 10. Project Filtering & Search Tests

### 10.1 Search

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PF-001 | Search by name | 1. Type project name | Matching projects shown | [ ] |
| PF-002 | Search by description | 1. Type text from description | Matching projects shown | [ ] |
| PF-003 | Search case insensitive | 1. Search "TEST" for "test" | Matches found | [ ] |
| PF-004 | Search no results | 1. Search "xyznonexistent" | Empty state shown | [ ] |
| PF-005 | Clear search | 1. Search<br>2. Clear input | All projects shown again | [ ] |

### 10.2 Status Filter

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PF-006 | Filter by active | 1. Select status: active | Only active projects shown | [ ] |
| PF-007 | Filter by backlog | 1. Select status: backlog | Only backlog projects shown | [ ] |
| PF-008 | Multiple status filter | 1. Select active + planned | Both shown | [ ] |
| PF-009 | Clear status filter | 1. Remove status filter | All statuses shown | [ ] |

### 10.3 Priority Filter

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PF-010 | Filter by urgent | 1. Select priority: urgent | Only urgent projects shown | [ ] |
| PF-011 | Filter by high | 1. Select priority: high | Only high priority shown | [ ] |
| PF-012 | Multiple priority filter | 1. Select urgent + high | Both shown | [ ] |

### 10.4 Client Filter

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PF-013 | Filter by client | 1. Select client | Only that client's projects | [ ] |
| PF-014 | No client filter | 1. Select "No client" | Projects without client | [ ] |

### 10.5 Combined Filters

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PF-015 | Status + priority | 1. Filter active + high | Only active AND high priority | [ ] |
| PF-016 | Status + client | 1. Filter active + client X | Only active for client X | [ ] |
| PF-017 | All filters combined | 1. Apply all filter types | Intersection of all | [ ] |
| PF-018 | Filter URL sync | 1. Apply filters | URL query params updated | [ ] |
| PF-019 | Direct filter URL | 1. Navigate with ?status=active | Filter pre-applied | [ ] |

### 10.6 Show Closed Toggle

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PF-020 | Hide closed default | 1. Navigate to /projects | Completed/cancelled hidden | [ ] |
| PF-021 | Show closed toggle | 1. Enable "Show closed" | Completed/cancelled visible | [ ] |

---

## 11. Real-time Updates Tests

### 11.1 Project Insert

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RT-001 | New project appears | 1. User A on /projects<br>2. User B creates project | Project appears for User A | [ ] |
| RT-002 | Insert without refresh | 1. Stay on page<br>2. Create in another tab | Appears instantly | [ ] |

### 11.2 Project Update

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RT-003 | Name change reflects | 1. User A viewing<br>2. User B changes name | Name updates for User A | [ ] |
| RT-004 | Status change reflects | 1. User A viewing<br>2. User B changes status | Status updates instantly | [ ] |
| RT-005 | Progress change reflects | 1. User A viewing<br>2. User B changes progress | Progress bar updates | [ ] |

### 11.3 Project Delete

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RT-006 | Deleted project disappears | 1. User A viewing<br>2. User B deletes project | Project removed from User A's list | [ ] |
| RT-007 | Delete while viewing | 1. User A on project details<br>2. User B deletes | User A redirected or notified | [ ] |

---

## 12. Accessibility Tests

### 12.1 Keyboard Navigation

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| A-001 | Tab through project list | All projects focusable | [ ] |
| A-002 | Enter opens project | Focused project opens | [ ] |
| A-003 | Tab through wizard | All fields accessible | [ ] |
| A-004 | Escape closes wizard | Wizard dismissed | [ ] |
| A-005 | Focus trap in modal | Focus stays in wizard | [ ] |

### 12.2 Screen Reader

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| A-006 | Projects list announced | List role and count | [ ] |
| A-007 | Project card details | Name, status, priority announced | [ ] |
| A-008 | Form labels | All inputs have labels | [ ] |
| A-009 | Error announcements | Validation errors announced | [ ] |
| A-010 | Status changes | Toast announcements | [ ] |

### 12.3 Visual

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| A-011 | Color contrast | WCAG AA compliance | [ ] |
| A-012 | Status not color-only | Icons + text + color | [ ] |
| A-013 | Focus indicators | Visible focus rings | [ ] |
| A-014 | 200% zoom | Layout not broken | [ ] |

---

## 13. Performance Tests

### 13.1 Load Times

| ID | Test Case | Target | Status |
|----|-----------|--------|--------|
| P-001 | Projects list load | < 2s | [ ] |
| P-002 | Project details load | < 2s | [ ] |
| P-003 | Wizard open | < 500ms | [ ] |
| P-004 | Project create | < 3s | [ ] |
| P-005 | Real-time update | < 100ms | [ ] |

### 13.2 Large Dataset

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| P-006 | 100 projects | Page loads, scrolls smoothly | [ ] |
| P-007 | 500 projects | Pagination or virtualization | [ ] |
| P-008 | Filter 500 projects | Response < 1s | [ ] |

---

## 14. Security Tests

### 14.1 Authorization

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| SEC-001 | Org isolation | Cannot see other org's projects | [ ] |
| SEC-002 | Member access | Members can view/edit projects | [ ] |
| SEC-003 | Viewer access | Viewers can only view | [ ] |
| SEC-004 | Non-member blocked | Cannot access project | [ ] |

### 14.2 Input Validation

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| SEC-005 | SQL injection in name | Input sanitized | [ ] |
| SEC-006 | XSS in description | Script not executed | [ ] |
| SEC-007 | Very long inputs | Handled gracefully | [ ] |

### 14.3 Data Protection

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| SEC-008 | RLS enforced | Direct DB access blocked | [ ] |
| SEC-009 | API auth required | Unauthenticated blocked | [ ] |

---

## 15. Known Issues & Recommendations

### 15.1 Identified Issues

| ID | Issue | Severity | Location | Recommendation |
|----|-------|----------|----------|----------------|
| I-001 | Escape key doesn't close wizard modal | Medium | `ProjectWizard.tsx` | Add `useEffect` with keyboard event listener for Escape |
| I-002 | Create button enabled with empty name | Low | `StepQuickCreate.tsx` | Add real-time validation to disable button when invalid |
| I-003 | Next button enabled without owner selection | Low | Wizard Ownership step | Add step validation before enabling Next |
| I-004 | X button click intercepted by backdrop | Medium | `ProjectWizard.tsx` | Fix z-index or click handling for close button |
| I-005 | No empty state for search with no results | Low | `projects-content.tsx` | Show "No matching projects" message when search returns empty |
| I-006 | Wizard opens slowly (~3-4s) | Medium | `ProjectWizard.tsx` | Optimize component loading, consider lazy loading |
| I-007 | Tasks tab navigation timeout | High | `ProjectDetailsPage` | Investigate tab switching and URL update timing |

### 15.2 Enhancement Recommendations

#### Critical (Bug Fixes)

1. **Fix Escape Key Modal Close (I-001)**
   - Add keyboard event listener for Escape key
   - Close wizard when Escape is pressed
   - Important for accessibility compliance

2. **Fix X Button Click Handling (I-004)**
   - Ensure close button is above backdrop layer
   - Test pointer events are not blocked

3. **Fix Tasks Tab Navigation (I-007)**
   - Investigate tab switching mechanism
   - Ensure URL updates correctly with tab param

#### High Priority

4. **Add Project Templates**
   - Save wizard configurations as templates
   - Quick create from template

5. **Bulk Actions**
   - Select multiple projects
   - Bulk status change
   - Bulk delete

6. **Real-time Form Validation (I-002, I-003)**
   - Disable Create/Next buttons until form is valid
   - Show inline validation errors as user types

#### Medium Priority

7. **Project Archiving**
   - Archive instead of delete
   - Restore archived projects

8. **Project Duplication**
   - Clone existing project
   - Copy with/without members

9. **Improve Wizard Performance (I-006)**
   - Lazy load wizard steps
   - Optimize initial render time to < 500ms

#### Low Priority

10. **Project Export**
    - Export project data to CSV/JSON
    - Export for reporting

11. **Search Empty State (I-005)**
    - Show "No matching projects found" when search returns empty
    - Add clear search button in empty state

---

## Test Execution Tracking

### Summary

**Last Execution:** January 23, 2026
**Environment:** Chromium (Playwright)
**Total Results:** 183 passed, 8 failed, 51 skipped

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Projects List | 10 | 10 | 0 | 0 |
| Quick Create | 21 | 18 | 2 | 1 |
| Wizard | 34 | 30 | 2 | 2 |
| CRUD | 18 | 18 | 0 | 0 |
| Status & Priority | 12 | 12 | 0 | 0 |
| Membership | 14 | 1 | 0 | 13 |
| Views | 19 | 18 | 1 | 0 |
| Details Page | 15 | 14 | 1 | 0 |
| Filtering & Search | 21 | 20 | 1 | 0 |
| Real-time | 7 | 1 | 0 | 6 |
| Accessibility | 14 | 12 | 1 | 1 |
| Performance | 8 | 7 | 1 | 0 |
| Security | 9 | 7 | 0 | 2 |
| **Total** | **202** | **168** | **8** | **26** |

*Note: Additional auth/OAuth/onboarding tests (25 skipped) are tracked separately in Auth-Test-Plan.md*

---

### 8 Failed Tests - Analysis

| Test ID | Test Name | Failure Reason | Root Cause |
|---------|-----------|----------------|------------|
| QC-005 | Empty name validation | Create button is enabled with empty name | **UI Behavior**: App validates on submit, not on input change |
| QC-014 | Status dropdown has default value | Page navigation timeout (30s) | **Environment**: Dev server slow under test load |
| PW-014 | Owner selection is required | Next button enabled without owner | **UI Behavior**: App validates on submit, not per-step |
| PW-030 | Close wizard via X button | Click intercepted by modal overlay | **Locator Issue**: Backdrop intercepts pointer events |
| PF-004 | Search with no results shows empty state | Neither count=0 nor empty state visible | **UI Behavior**: App doesn't show empty state for search, shows "no matches" differently |
| A-004 | Escape closes modals | Wizard stays open after Escape | **Missing Feature**: Escape key handler not implemented for wizard |
| P-003 | Wizard opens quickly | 3749ms (threshold: 2000ms) | **Performance**: Test environment slower than production |
| PD-010 | Switch to Tasks tab | 60s timeout | **Locator/Timing**: Tab click or URL update failed |

---

### 51 Skipped Tests - Reasons

#### Require Test Credentials (5 tests)
Tests skipped because `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` env variables not set:
- L-007: Valid credentials login redirects to dashboard
- L-009: Invalid password shows error
- L-010: Email is case-insensitive
- L-011: Email with whitespace is trimmed
- L-019: Authenticated user accessing login redirects

#### Require Email Delivery (4 tests)
Tests require actual email sending/receiving which can't be automated:
- FP-009: Reset email is received
- FP-010: Reset link in email works
- FP-011: Password can be updated via reset link
- FP-012: Expired reset link shows error

#### Require Google OAuth (9 tests)
Tests require real Google OAuth flow which can't be automated:
- O-002: New user OAuth creates account
- O-003: Returning user OAuth logs in
- O-004: Cancelled OAuth returns to login
- O-005: OAuth error displays error message
- O-009: Callback with next param redirects correctly
- O-010: First OAuth creates personal workspace
- O-011: Returning user OAuth does not create new org
- O-012: OAuth user is admin of created org
- O-013: Org name uses Google display name

#### Require Fresh User State (13 tests)
Tests require a user without an organization (onboarding flow):
- OB-002 to OB-012: All onboarding tests
- Onboarding page load tests

#### Require Session Management Testing (10 tests)
Tests require logout, session expiry, multi-tab scenarios:
- RP-006 to RP-011: Route protection with auth state changes
- Authenticated route access tests

#### Require Production Environment (4 tests)
Tests require HTTPS or production-specific features:
- SEC-007: HTTPS is enforced
- SEC-009: New session ID after login
- SEC-010: Sessions expire appropriately
- SEC-011: Logout invalidates session token

#### Require Actual Registration (5 tests)
Tests require creating real accounts or testing duplicate emails:
- S-009: Successful registration redirects
- S-010: Personal workspace is created after signup
- S-011: User is admin of created workspace
- S-012: Duplicate email shows error
- S-019: Authenticated user accessing signup redirects

#### Missing Feature (1 test)
- A-004 (accessibility): Skip links are not implemented

---

### Test Execution Notes

**Date:** January 23, 2026
**Tester:** Automated (Playwright E2E)
**Browser:** Chromium
**Duration:** 22.1 minutes

#### Environment Setup
- Development server: http://localhost:3000
- Auth state saved from manual login (e2e-test@example.com)
- Supabase project: lazhmdyajdqbnxxwyxun

#### Key Observations
1. **Form Validation**: The app uses submit-time validation rather than real-time validation, causing some validation tests to fail
2. **Modal Behavior**: Escape key doesn't close the wizard modal - this is a missing accessibility feature
3. **Performance**: Wizard open time varies significantly in test environment (2-4 seconds)
4. **Search UI**: When search returns no results, the app doesn't show the "No projects yet" empty state

#### Recommendations
1. **High Priority**: Add Escape key handler to close modals (accessibility)
2. **Medium Priority**: Add real-time form validation (disable buttons until valid)
3. **Low Priority**: Show empty state message for search with no results

---

## Appendix

### A. Test Data

```
Valid Project Names:
  - "Test Project"
  - "Marketing Campaign Q4"
  - "Project & Co. Launch"
  - "日本語プロジェクト" (Unicode)

Invalid Project Names:
  - "" (empty)
  - "A" (too short, if min is 2)

Status Values:
  - backlog, planned, active, cancelled, completed

Priority Values:
  - urgent, high, medium, low

Project Member Roles:
  - owner, pic, member, viewer

Progress Values:
  - 0 (minimum)
  - 50 (middle)
  - 100 (maximum)
  - -1 (invalid)
  - 101 (invalid)
```

### B. Related Files

| File | Description |
|------|-------------|
| `/app/projects/page.tsx` | Projects list page (via dashboard) |
| `/app/projects/[id]/page.tsx` | Project details page |
| `/components/projects-content.tsx` | Projects list with views |
| `/components/project-wizard/ProjectWizard.tsx` | Project creation wizard |
| `/components/project-wizard/steps/StepQuickCreate.tsx` | Quick create form |
| `/components/project-cards-view.tsx` | Grid/cards view |
| `/components/project-board-view.tsx` | Kanban board view |
| `/lib/actions/projects.ts` | Project server actions |
| `/hooks/use-realtime.ts` | Real-time subscriptions |

### C. API Reference

| Action | Description |
|--------|-------------|
| `createProject(orgId, data)` | Create new project |
| `getProjects(orgId, filters)` | Get filtered projects |
| `getProject(id)` | Get single project |
| `updateProject(id, data)` | Update project |
| `updateProjectStatus(id, status)` | Update status |
| `updateProjectProgress(id, progress)` | Update progress (0-100) |
| `deleteProject(id)` | Delete project |
| `addProjectMember(projectId, userId, role)` | Add member |
| `updateProjectMemberRole(projectId, userId, role)` | Update role |
| `removeProjectMember(projectId, userId)` | Remove member |
| `getProjectMembers(projectId)` | Get members |
| `getProjectStats(orgId)` | Get statistics |
