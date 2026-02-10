"use server"

import { revalidatePath } from "next/cache"
import { requireAuth, requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import type {
  Report,
  ReportInsert,
  ReportProject,
  ReportProjectInsert,
  ReportRisk,
  ReportRiskInsert,
  ReportHighlight,
  ReportHighlightInsert,
  ReportProjectStatus,
  ClientSatisfaction,
  RiskType,
  RiskSeverity,
  RiskStatus,
  ReportHighlightType,
  ReportPeriodType,
  TeamContributionEntry,
  ProfileMinimal,
} from "@/lib/supabase/types"

// ============================================
// Types for wizard data
// ============================================

export type ReportProjectInput = {
  project_id: string
  status: ReportProjectStatus
  previous_status?: ReportProjectStatus | null
  client_satisfaction: ClientSatisfaction
  previous_satisfaction?: ClientSatisfaction | null
  progress_percent: number
  previous_progress?: number | null
  narrative?: string | null
  team_contributions: TeamContributionEntry[]
  financial_notes?: string | null
  sort_order: number
}

export type ReportRiskInput = {
  id?: string // present if carried over
  project_id?: string | null
  type: RiskType
  description: string
  severity: RiskSeverity
  status: RiskStatus
  mitigation_notes?: string | null
  originated_report_id?: string | null
}

export type ReportHighlightInput = {
  project_id?: string | null
  type: ReportHighlightType
  description: string
  sort_order: number
}

export type CreateReportInput = {
  title: string
  period_type: ReportPeriodType
  period_start: string
  period_end: string
  projects: ReportProjectInput[]
  risks: ReportRiskInput[]
  highlights: ReportHighlightInput[]
}

export type ReportListItem = Report & {
  author: ProfileMinimal
  project_count: number
  status_summary: Record<ReportProjectStatus, number>
}

// ============================================
// Get reports list
// ============================================

export async function getReports(
  orgId: string
): Promise<ActionResult<ReportListItem[]>> {
  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member to view reports" }
  }

  const { supabase } = await requireAuth()

  const { data: reports, error } = await supabase
    .from("reports")
    .select(`
      *,
      author:profiles!reports_created_by_fkey(id, full_name, email, avatar_url),
      report_projects!report_projects_report_id_fkey(project_id, status)
    `)
    .eq("organization_id", orgId)
    .order("period_start", { ascending: false })

  if (error) return { error: error.message }

  const items: ReportListItem[] = (reports ?? []).map((r: any) => {
    const statusSummary: Record<ReportProjectStatus, number> = {
      on_track: 0,
      behind: 0,
      at_risk: 0,
      halted: 0,
      completed: 0,
    }
    for (const rp of r.report_projects || []) {
      statusSummary[rp.status as ReportProjectStatus]++
    }
    return {
      id: r.id,
      organization_id: r.organization_id,
      created_by: r.created_by,
      title: r.title,
      period_type: r.period_type,
      period_start: r.period_start,
      period_end: r.period_end,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: r.author,
      project_count: (r.report_projects || []).length,
      status_summary: statusSummary,
    }
  })

  return { data: items }
}

// ============================================
// Get single report with full relations
// ============================================

export async function getReport(
  reportId: string
): Promise<ActionResult<any>> {
  const { supabase } = await requireAuth()

  const { data: report, error } = await supabase
    .from("reports")
    .select(`
      *,
      author:profiles!reports_created_by_fkey(id, full_name, email, avatar_url),
      report_projects!report_projects_report_id_fkey(
        *,
        project:projects!report_projects_project_id_fkey(id, name, client_id, status, progress, currency),
        attachments:report_attachments!report_attachments_report_project_id_fkey(*)
      ),
      report_risks!report_risks_report_id_fkey(*),
      report_highlights!report_highlights_report_id_fkey(*)
    `)
    .eq("id", reportId)
    .single()

  if (error) return { error: error.message }

  return { data: report }
}

// ============================================
// Create report (publish)
// ============================================

export async function createReport(
  orgId: string,
  input: CreateReportInput
): Promise<ActionResult<Report>> {
  const { user, supabase } = await requireAuth()

  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member to create reports" }
  }

  // 1. Create the report
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      title: input.title,
      period_type: input.period_type,
      period_start: input.period_start,
      period_end: input.period_end,
    } satisfies ReportInsert)
    .select()
    .single()

  if (reportError || !report) {
    return { error: reportError?.message ?? "Failed to create report" }
  }

  // 2. Calculate task stats for each project in parallel
  const taskStatsPromises = input.projects.map(async (p) => {
    const periodStart = input.period_start
    const periodEnd = input.period_end

    const [completedResult, inProgressResult, overdueResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.project_id)
        .eq("status", "done")
        .gte("updated_at", periodStart)
        .lte("updated_at", periodEnd + "T23:59:59"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.project_id)
        .eq("status", "in-progress"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.project_id)
        .neq("status", "done")
        .lt("end_date", new Date().toISOString().split("T")[0]),
    ])

    return {
      project_id: p.project_id,
      tasks_completed: completedResult.count ?? 0,
      tasks_in_progress: inProgressResult.count ?? 0,
      tasks_overdue: overdueResult.count ?? 0,
    }
  })

  const taskStats = await Promise.all(taskStatsPromises)
  const statsMap = new Map(taskStats.map((s) => [s.project_id, s]))

  // 3. Insert report projects
  const reportProjects: ReportProjectInsert[] = input.projects.map((p) => {
    const stats = statsMap.get(p.project_id)
    return {
      report_id: report.id,
      project_id: p.project_id,
      status: p.status,
      previous_status: p.previous_status ?? null,
      client_satisfaction: p.client_satisfaction,
      previous_satisfaction: p.previous_satisfaction ?? null,
      progress_percent: p.progress_percent,
      previous_progress: p.previous_progress ?? null,
      narrative: p.narrative ?? null,
      team_contributions: JSON.parse(JSON.stringify(p.team_contributions)),
      tasks_completed: stats?.tasks_completed ?? 0,
      tasks_in_progress: stats?.tasks_in_progress ?? 0,
      tasks_overdue: stats?.tasks_overdue ?? 0,
      financial_notes: p.financial_notes ?? null,
      sort_order: p.sort_order,
    }
  })

  // 4. Insert risks
  const reportRisks: ReportRiskInsert[] = input.risks.map((r) => ({
    report_id: report.id,
    project_id: r.project_id ?? null,
    type: r.type,
    description: r.description,
    severity: r.severity,
    status: r.status,
    mitigation_notes: r.mitigation_notes ?? null,
    originated_report_id: r.originated_report_id ?? report.id,
  }))

  // 5. Insert highlights
  const reportHighlights: ReportHighlightInsert[] = input.highlights.map((h) => ({
    report_id: report.id,
    project_id: h.project_id ?? null,
    type: h.type,
    description: h.description,
    sort_order: h.sort_order,
  }))

  // Insert all sub-entities in parallel
  const insertPromises: PromiseLike<any>[] = []

  if (reportProjects.length > 0) {
    insertPromises.push(
      supabase.from("report_projects").insert(reportProjects).select()
    )
  }
  if (reportRisks.length > 0) {
    insertPromises.push(
      supabase.from("report_risks").insert(reportRisks).select()
    )
  }
  if (reportHighlights.length > 0) {
    insertPromises.push(
      supabase.from("report_highlights").insert(reportHighlights).select()
    )
  }

  await Promise.all(insertPromises)

  revalidatePath("/reports")
  return { data: report }
}

// ============================================
// Update report
// ============================================

export async function updateReport(
  reportId: string,
  input: CreateReportInput
): Promise<ActionResult<Report>> {
  const { supabase } = await requireAuth()

  // Get report to verify org membership
  const { data: existing, error: fetchError } = await supabase
    .from("reports")
    .select("organization_id")
    .eq("id", reportId)
    .single()

  if (fetchError || !existing) {
    return { error: "Report not found" }
  }

  try {
    await requireOrgMember(existing.organization_id)
  } catch {
    return { error: "You must be an organization member to edit reports" }
  }

  // Update report header
  const { data: report, error: updateError } = await supabase
    .from("reports")
    .update({
      title: input.title,
      period_type: input.period_type,
      period_start: input.period_start,
      period_end: input.period_end,
    })
    .eq("id", reportId)
    .select()
    .single()

  if (updateError || !report) {
    return { error: updateError?.message ?? "Failed to update report" }
  }

  // Delete existing sub-entities and re-insert (simpler than diffing)
  await Promise.all([
    supabase.from("report_projects").delete().eq("report_id", reportId),
    supabase.from("report_risks").delete().eq("report_id", reportId),
    supabase.from("report_highlights").delete().eq("report_id", reportId),
  ])

  // Re-insert (same logic as create, task stats recalculated)
  const taskStatsPromises = input.projects.map(async (p) => {
    const [completedResult, inProgressResult, overdueResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.project_id)
        .eq("status", "done")
        .gte("updated_at", input.period_start)
        .lte("updated_at", input.period_end + "T23:59:59"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.project_id)
        .eq("status", "in-progress"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.project_id)
        .neq("status", "done")
        .lt("end_date", new Date().toISOString().split("T")[0]),
    ])
    return {
      project_id: p.project_id,
      tasks_completed: completedResult.count ?? 0,
      tasks_in_progress: inProgressResult.count ?? 0,
      tasks_overdue: overdueResult.count ?? 0,
    }
  })

  const taskStats = await Promise.all(taskStatsPromises)
  const statsMap = new Map(taskStats.map((s) => [s.project_id, s]))

  const reportProjects: ReportProjectInsert[] = input.projects.map((p) => {
    const stats = statsMap.get(p.project_id)
    return {
      report_id: reportId,
      project_id: p.project_id,
      status: p.status,
      previous_status: p.previous_status ?? null,
      client_satisfaction: p.client_satisfaction,
      previous_satisfaction: p.previous_satisfaction ?? null,
      progress_percent: p.progress_percent,
      previous_progress: p.previous_progress ?? null,
      narrative: p.narrative ?? null,
      team_contributions: JSON.parse(JSON.stringify(p.team_contributions)),
      tasks_completed: stats?.tasks_completed ?? 0,
      tasks_in_progress: stats?.tasks_in_progress ?? 0,
      tasks_overdue: stats?.tasks_overdue ?? 0,
      financial_notes: p.financial_notes ?? null,
      sort_order: p.sort_order,
    }
  })

  const reportRisks: ReportRiskInsert[] = input.risks.map((r) => ({
    report_id: reportId,
    project_id: r.project_id ?? null,
    type: r.type,
    description: r.description,
    severity: r.severity,
    status: r.status,
    mitigation_notes: r.mitigation_notes ?? null,
    originated_report_id: r.originated_report_id ?? reportId,
  }))

  const reportHighlights: ReportHighlightInsert[] = input.highlights.map((h) => ({
    report_id: reportId,
    project_id: h.project_id ?? null,
    type: h.type,
    description: h.description,
    sort_order: h.sort_order,
  }))

  const insertPromises: PromiseLike<any>[] = []
  if (reportProjects.length > 0) {
    insertPromises.push(supabase.from("report_projects").insert(reportProjects).select())
  }
  if (reportRisks.length > 0) {
    insertPromises.push(supabase.from("report_risks").insert(reportRisks).select())
  }
  if (reportHighlights.length > 0) {
    insertPromises.push(supabase.from("report_highlights").insert(reportHighlights).select())
  }

  await Promise.all(insertPromises)

  revalidatePath("/reports")
  revalidatePath(`/reports/${reportId}`)
  return { data: report }
}

// ============================================
// Delete report
// ============================================

export async function deleteReport(
  reportId: string
): Promise<ActionResult<{ success: boolean }>> {
  const { supabase } = await requireAuth()

  const { data: report, error: fetchError } = await supabase
    .from("reports")
    .select("organization_id")
    .eq("id", reportId)
    .single()

  if (fetchError || !report) {
    return { error: "Report not found" }
  }

  try {
    await requireOrgMember(report.organization_id)
  } catch {
    return { error: "You must be an organization member to delete reports" }
  }

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", reportId)

  if (error) return { error: error.message }

  revalidatePath("/reports")
  return { data: { success: true } }
}

// ============================================
// Carry-over: Load previous report data
// ============================================

export async function getPreviousReportData(
  orgId: string
): Promise<ActionResult<{
  report: Report | null
  projects: ReportProject[]
  risks: ReportRisk[]
}>> {
  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member" }
  }

  const { supabase } = await requireAuth()

  // Get most recent report
  const { data: prevReport, error } = await supabase
    .from("reports")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_start", { ascending: false })
    .limit(1)
    .single()

  if (error || !prevReport) {
    return { data: { report: null, projects: [], risks: [] } }
  }

  // Load sub-entities from previous report in parallel
  const [projectsResult, risksResult] = await Promise.all([
    supabase
      .from("report_projects")
      .select("*")
      .eq("report_id", prevReport.id)
      .order("sort_order"),
    supabase
      .from("report_risks")
      .select("*")
      .eq("report_id", prevReport.id)
      .in("status", ["open", "mitigated"]),
  ])

  return {
    data: {
      report: prevReport,
      projects: projectsResult.data ?? [],
      risks: risksResult.data ?? [],
    },
  }
}

// ============================================
// Create action item (task from report)
// ============================================

export async function createReportActionItem(input: {
  reportId: string
  projectId: string
  name: string
  description?: string
  assigneeId?: string
  priority?: string
  dueDate?: string
}): Promise<ActionResult<any>> {
  const { user, supabase } = await requireAuth()

  // Get report org for notification
  const { data: report } = await supabase
    .from("reports")
    .select("organization_id")
    .eq("id", input.reportId)
    .single()

  if (!report) return { error: "Report not found" }

  // Get max sort_order for the project
  const { data: lastTask } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("project_id", input.projectId)
    .is("workstream_id", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single()

  const sortOrder = lastTask ? lastTask.sort_order + 1 : 0

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: input.projectId,
      name: input.name,
      description: input.description ?? null,
      assignee_id: input.assigneeId ?? null,
      priority: (input.priority as any) ?? "medium",
      end_date: input.dueDate ?? null,
      status: "todo",
      tag: "report-action",
      source_report_id: input.reportId,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Notify assignee if assigned
  if (input.assigneeId && input.assigneeId !== user.id) {
    const { notify } = await import("./notifications")
    await notify({
      orgId: report.organization_id,
      userIds: [input.assigneeId],
      actorId: user.id,
      type: "task_update",
      title: `assigned you an action item: "${input.name}"`,
      taskId: task.id,
      projectId: input.projectId,
      metadata: { reportId: input.reportId },
    })
  }

  revalidatePath(`/reports/${input.reportId}`)
  revalidatePath(`/projects/${input.projectId}`)
  return { data: task }
}

// ============================================
// Get open action items (for wizard Step 5)
// ============================================

export async function getOpenActionItems(
  orgId: string
): Promise<ActionResult<any[]>> {
  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member" }
  }

  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, name, description, status, priority, end_date, created_at,
      source_report_id,
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url),
      project:projects!tasks_project_id_fkey(id, name)
    `)
    .not("source_report_id", "is", null)
    .neq("status", "done")
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }

  // Calculate weeks open
  const now = new Date()
  const items = (data ?? []).map((task: any) => {
    const createdAt = new Date(task.created_at)
    const weeksOpen = Math.floor(
      (now.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    return { ...task, weeks_open: weeksOpen }
  })

  return { data: items }
}
