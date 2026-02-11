# Project Reports Tab Design

## Summary

Move reports from standalone `/reports` page into project details as a dedicated tab. Each project gets its own reports list, creation wizard with auto-calculated progress/financials, and detail view with action items that sync to My Tasks.

## Architecture

### Changes Overview

1. Add "Reports" tab to `ProjectDetailsPage` (7th tab)
2. Remove standalone `/reports` route and sidebar link
3. Simplify report wizard — project context is implicit
4. Auto-calculate progress from workstreams/tasks (editable)
5. Auto-calculate financial summary from deliverables
6. Rich text (Tiptap) for Highlights, Decisions, Review with AI
7. Action items create tasks with `report-action` tag + `source_report_id`
8. Report detail page at `/projects/[id]/reports/[reportId]`

### Database

No new tables. Existing schema works:
- `reports` — already has `project_id`
- `report_risks`, `report_highlights` — linked via `report_id`
- `tasks.source_report_id` — already links action items to reports

New server actions:
- `getProjectReports(projectId)` — filter reports by project
- `getProjectReportStats(projectId)` — auto-calculate progress + financials

### Data Flow

- Progress = (completed workstreams + completed unassigned tasks) / total
- Financials = sum deliverables grouped by payment_status
- Action items = tasks WHERE source_report_id IS NOT NULL

## UI Components

### Reports Tab
- Table: Title, Period, Status badge, Progress bar, Author avatar, Date
- "New Report" button
- Empty state

### Report Wizard (3 steps)
1. Status & Progress: period, status, satisfaction, auto-progress, narrative (Tiptap + AI)
2. Financials & Risks: deliverable summary cards, financial notes (Tiptap + AI), risks
3. Highlights & Decisions: Tiptap editors with AI, action items, review

### Report Detail Page
- Full report view with all sections
- Action items table with task status
- Edit button → wizard in edit mode
- Progress delta card

## Files to Create/Modify

### New Files
- `components/reports/ProjectReportsTab.tsx` — Reports table in project tab
- `components/reports/ReportWizardTiptapField.tsx` — Tiptap field with AI button
- `components/reports/ReportFinancialSummary.tsx` — Auto-calculated financial cards
- `components/reports/ReportProgressCalculator.tsx` — Auto-progress display
- `app/(dashboard)/projects/[id]/reports/[reportId]/page.tsx` — Report detail route

### Modified Files
- `components/projects/ProjectDetailsPage.tsx` — Add Reports tab
- `app/(dashboard)/projects/[id]/page.tsx` — Fetch reports data
- `lib/actions/reports.ts` — Add project-scoped queries + auto-calc functions
- `lib/actions/report-ai.ts` — Update AI prompts for Tiptap content
- `components/reports/ReportWizard.tsx` — Remove project selection, add Tiptap fields
- `components/reports/ReportWizardStep1.tsx` — Auto-progress, Tiptap narrative
- `components/reports/ReportWizardStep5.tsx` — Tiptap highlights/decisions
- `components/reports/ReportDetailContent.tsx` — Financial summary, action items

### Removed Files
- `app/(dashboard)/reports/page.tsx` — Standalone reports list
- `app/(dashboard)/reports/[id]/page.tsx` — Standalone report detail
- `components/reports/ReportsListContent.tsx` — Standalone list component
