# Weekly Reports Module — Design Document

**Date:** 2026-02-10
**Status:** Approved

---

## Overview

A Reports feature inside PMS that lets team members create structured weekly status reports covering all active projects. Reports are used in weekly meetings between the PM team and the CEO. The system pre-fills data from previous reports and from existing project/task/deliverable data to keep report creation under 15 minutes.

## Key Decisions

- **One new sidebar item:** "Reports" (between Clients and AI Chat)
- **"My Actions" dropped:** action items are tasks on the existing tasks page
- **Anyone can create, view, edit** any report — no restrictions
- **No export:** everything consumed in-app
- **Financials pulled from deliverables** — no separate manual entry
- **No draft saving:** wizard is all-or-nothing
- **No notification on publish:** only action-item notifications
- **AI features** use the existing AI infrastructure

---

## Database Schema

### 4 New Tables

**`reports`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| created_by | uuid | FK → profiles |
| title | text | Auto-generated, editable |
| period_type | enum | weekly / monthly / custom |
| period_start | date | |
| period_end | date | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`report_projects`** — per-project data snapshot for each report
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| report_id | uuid | FK → reports |
| project_id | uuid | FK → projects |
| status | enum | on_track / behind / at_risk / halted / completed |
| previous_status | enum | Nullable, for comparison indicators |
| client_satisfaction | enum | satisfied / neutral / dissatisfied |
| previous_satisfaction | enum | Nullable, for comparison |
| progress_percent | integer | 0–100 |
| previous_progress | integer | Nullable, for delta display |
| narrative | text | Rich text (HTML) |
| team_contributions | jsonb | Array of {member_id, contribution_text} |
| tasks_completed | integer | Auto-calculated at report creation |
| tasks_in_progress | integer | Auto-calculated |
| tasks_overdue | integer | Auto-calculated |
| financial_notes | text | Optional notes about financials |

**`report_risks`** — blockers and risks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| report_id | uuid | FK → reports |
| project_id | uuid | FK → projects, nullable |
| type | enum | blocker / risk |
| description | text | |
| severity | enum | low / medium / high / critical |
| status | enum | open / mitigated / resolved |
| mitigation_notes | text | Nullable |
| originated_report_id | uuid | FK → reports, tracks origin |

**`report_highlights`** — highlights and decisions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| report_id | uuid | FK → reports |
| project_id | uuid | FK → projects, nullable |
| type | enum | highlight / decision |
| description | text | |

### Existing Table Modifications

**`tasks`** — add columns:
| Column | Type | Notes |
|--------|------|-------|
| source_report_id | uuid | FK → reports, nullable. Set when task is created as a report action item |

A `report-action` organization tag is also created to tag these tasks for easy filtering.

### Attachments

Report attachments use the existing `project_files` infrastructure and Supabase Storage. A new `report_attachments` join table links files to `report_projects`:

**`report_attachments`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| report_project_id | uuid | FK → report_projects |
| file_name | text | |
| file_path | text | Supabase Storage path |
| file_size | bigint | |
| content_type | text | |
| uploaded_by | uuid | FK → profiles |
| created_at | timestamptz | |

---

## Report Wizard

5-step wizard following the same pattern as the existing project creation wizard (multi-step modal/page with progress indicator).

### Step 1: Report Scope

- Period type toggle: **Weekly** (default) | Monthly | Custom
- Weekly: shows "Feb 3 – 9, 2026" with left/right arrows to shift weeks
- Monthly: month/year picker
- Custom: two date pickers
- Auto-generated title (e.g. "Weekly Report — Feb 3-9, 2026"), editable
- Project selector: checkboxes with "All Active" toggle. Defaults to all active projects. Shows project name + client name.

### Step 2: Project Status & Team

Collapsible card per selected project, all expanded by default.

Each card contains:
- **Status dropdown** (On Track / Behind / At Risk / Halted / Completed) — if changed from previous, shows "was [Previous]" badge
- **Client satisfaction** radio group — same change indicator
- **Progress slider** 0–100% — shows "+X% from last week" if changed
- **Task stats** (read-only): auto-calculated from the tasks table for the report period. "12 completed, 5 in progress, 2 overdue"
- **Team members**: loaded from project membership, each with a text input for their contribution
- **Narrative**: Tiptap rich text editor with "AI Assist" button
- **Attachments**: file upload via existing Supabase Storage infrastructure

**Pre-filled from last report:** status, satisfaction, progress, team members (with empty contribution text — contribution is period-specific).

### Step 3: Financials (Read-Only)

Pulled fresh from the project's deliverables each time — no manual entry, no carry-over.

- **Portfolio-wide totals banner** at top: total contract value, total paid, total outstanding
- **Per-project collapsible card**: table of deliverables with title, value, due date, status, payment status
- **Auto-calculated project summary**: total value, paid amount, unpaid amount
- **Financial notes**: one text field per project for comments (this does carry over)

### Step 4: Risks & Blockers

Two sections: "Current Blockers" and "Future Risks"

- Unresolved items from the previous report auto-populate with a "Carried over" badge
- Each item is an editable card: description, severity dropdown, status dropdown, project dropdown (optional), mitigation notes
- "Add Blocker" / "Add Risk" buttons for new entries
- Can mark carried-over items as "Resolved" or "Mitigated" inline
- **"AI Suggest" button**: passes projects marked Behind/At Risk + their narratives to AI, returns 2-3 suggested risks as dismissable cards

### Step 5: Highlights & Review

- **Highlights**: dynamic list of text inputs + optional project link. "AI Suggest" button generates suggestions from completed tasks and status improvements.
- **Decisions Needed**: text input + required project link. These render prominently on the detail page.
- **Action Items Review (read + update only)**: fetches open tasks tagged as report action items. Shows description, assignee, due date, priority, "Open for X weeks" badge. User can toggle status inline. No "Add" button — this is a review step only.

### Publish

- Saves all report data
- Creates notifications for any action item assignees (existing items that changed status)
- Redirects to the published report detail page

---

## Report Detail Page (`/reports/[id]`)

Document-style scrollable page. Long-form reading layout, not a card dashboard.

### Layout (top to bottom)

1. **Header band**: title, period dates, author name + avatar, published date, "Edit" button (reopens wizard with all data pre-filled)

2. **Portfolio Summary bar**: horizontal strip — total projects, on track count, behind count, at risk count, total portfolio value, total collected. Each with week-over-week change indicators.

3. **Per-project sections**: each project gets a full-width section:
   - Project name as heading + status badge (colored) + change indicator
   - Client satisfaction badge + change indicator
   - Progress bar with percentage and delta
   - Task stats: completed, in progress, overdue
   - Team contributions list
   - Narrative (rendered rich text)
   - Financials sub-section: deliverables table with values and payment statuses + project totals
   - Attachments: thumbnail grid with lightbox

4. **Risks & Blockers**: table — description, type, severity (color-coded), status, project, mitigation notes. Resolved items with strikethrough.

5. **Highlights**: bullet list

6. **Decisions Needed**: visually prominent amber/yellow background cards

7. **Action Items**: table with assignee, due date, priority, status, "Open for X weeks" badge (yellow at 2+, red at 4+). **"Add Action Item" button** for post-meeting creation — creates a task with `source_report_id` and `report-action` tag, notifies assignee.

### Week-over-Week Indicators

Everywhere a value can be compared to the previous report:
- Status: green arrow if improved, red if worsened, gray if same
- Progress: "+15% from last week"
- New items: "New this week" badge
- Action items: "Open for 3 weeks" badge

---

## Reports List Page (`/reports`)

- "Create Report" button top-right
- List sorted newest first
- Each row: title, period dates, author + avatar, project count, status summary (colored pills: "3 On Track, 1 Behind")
- Filter bar: date range picker, author dropdown
- Search: searches title and narrative text
- Click row → `/reports/[id]`

---

## Carry-Over Logic

When the wizard opens, it finds the most recent report for the org and pre-fills:

1. **Projects**: same projects selected. New active projects added with blank fields.
2. **Status / Satisfaction / Progress**: copied as current values. Previous values stored for comparison.
3. **Team members**: same members pre-selected, contribution text left empty (period-specific).
4. **Financials**: pulled fresh from deliverables — no carry-over needed.
5. **Financial notes**: carried over.
6. **Risks & Blockers**: unresolved items (status = open) copied with `originated_report_id` preserved. Resolved items dropped.
7. **Highlights / Decisions**: NOT carried over (period-specific).
8. **Action Items**: fetched live from tasks table (open tasks with `source_report_id`), weeks-open calculated from `created_at`.

First-ever report: all active projects selected, blank fields.

---

## AI Features

### Wizard AI (3 touchpoints)

All use existing `lib/actions/ai.ts` infrastructure:

1. **Narrative AI Assist (Step 2)**: user types rough bullets → AI returns polished paragraph. Context: project name, task stats, bullet points.
2. **Risk Suggest (Step 4)**: sends projects marked Behind/At Risk + narratives → returns 2-3 suggested risks as dismissable cards.
3. **Highlights Suggest (Step 5)**: sends status improvements, completed task counts, resolved blockers → returns suggested highlight bullets.

### AI Chat Integration

Extend `lib/actions/ai-context.ts` to include report data as context. No new UI — the existing AI Chat gains the ability to answer report-related queries like:
- "Which projects have been behind for 3+ weeks?"
- "Summarize outstanding invoices"
- "List all open action items for [person]"
- "Compare this week vs last week"

---

## Notifications

Uses existing `inbox_items` system. **No notification on report publish.**

- **Action item assigned** → assignee notified: "You were assigned an action item in Weekly Report — Feb 3-9"
- **Action item overdue** → assignee notified (triggered on report page load or via edge function)
- **Due tomorrow reminder** → assignee notified (same trigger)

---

## Sidebar

One new item added between Clients and AI Chat:
- **Reports** — icon: FileText or ClipboardList from Lucide

---

## File Structure (New Files)

```
app/(dashboard)/reports/
  page.tsx                    # Reports list
  loading.tsx                 # Skeleton
  [id]/
    page.tsx                  # Report detail
    loading.tsx               # Skeleton

components/reports/
  ReportWizard.tsx            # Main wizard container
  ReportWizardStep1.tsx       # Scope
  ReportWizardStep2.tsx       # Project status & team
  ReportWizardStep3.tsx       # Financials
  ReportWizardStep4.tsx       # Risks & blockers
  ReportWizardStep5.tsx       # Highlights & review
  ReportDetail.tsx            # Detail page layout
  ReportProjectSection.tsx    # Per-project section in detail
  ReportFinancials.tsx        # Financials display
  ReportRisksTable.tsx        # Risks & blockers table
  ReportActionItems.tsx       # Action items table + add button
  ReportListItem.tsx          # Row in reports list
  StatusBadge.tsx             # Status with change indicator
  ChangeIndicator.tsx         # Week-over-week comparison display

lib/actions/
  reports.ts                  # Report CRUD, carry-over logic
  report-projects.ts          # Report project data
  report-risks.ts             # Risks & blockers
  report-highlights.ts        # Highlights & decisions
  report-ai.ts                # AI assist for narratives, risks, highlights

components/skeletons/
  ReportsListSkeleton.tsx
  ReportDetailSkeleton.tsx

supabase/migrations/
  YYYYMMDD_create_reports_tables.sql
```
