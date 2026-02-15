"use server"

import { revalidatePath } from "next/cache"
import { requireAuth, requireOrgMember, requireProjectMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import type { TaskWithRelations } from "./tasks"
import type {
  Report,
  ReportInsert,
  ReportRiskInsert,
  ReportHighlightInsert,
  ReportProjectStatus,
  ClientSatisfaction,
  RiskType,
  RiskSeverity,
  RiskStatus,
  ReportHighlightType,
  ReportPeriodType,
  ReportRisk,
  ProfileMinimal,
} from "@/lib/supabase/types"

// ============================================
// Types for wizard data
// ============================================

export type ReportRiskInput = {
  id?: string // present if carried over
  type: RiskType
  description: string
  severity: RiskSeverity
  status: RiskStatus
  mitigation_notes?: string | null
  originated_report_id?: string | null
}

export type ReportHighlightInput = {
  type: ReportHighlightType
  description: string
  sort_order: number
}

export type CreateReportInput = {
  title: string
  period_type: ReportPeriodType
  period_start: string
  period_end: string
  project_id: string | null
  status: ReportProjectStatus
  previous_status?: ReportProjectStatus | null
  client_satisfaction: ClientSatisfaction
  previous_satisfaction?: ClientSatisfaction | null
  progress_percent: number
  previous_progress?: number | null
  narrative?: string | null
  financial_notes?: string | null
  financial_total_value?: number
  financial_paid_amount?: number
  financial_invoiced_amount?: number
  financial_unpaid_amount?: number
  financial_currency?: string
  risks: ReportRiskInput[]
  highlights: ReportHighlightInput[]
}

// ============================================
// Get single report with full relations
// ============================================

export async function getReport(
  reportId: string
): Promise<ActionResult<any>> {
  const { supabase } = await requireAuth()

  // Verify user has access to this report's organization
  const { data: reportCheck, error: reportCheckError } = await supabase
    .from("reports")
    .select("organization_id")
    .eq("id", reportId)
    .single()

  if (reportCheckError || !reportCheck) {
    return { error: "Report not found" }
  }

  try {
    await requireOrgMember(reportCheck.organization_id)
  } catch {
    return { error: "You must be an organization member to view this report" }
  }

  const { data: report, error } = await supabase
    .from("reports")
    .select(`
      *,
      author:profiles!reports_created_by_fkey(id, full_name, email, avatar_url),
      project:projects!reports_project_id_fkey(id, name, client_id, status, progress, currency),
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

  // Calculate task stats for the project
  let tasksCompleted = 0
  let tasksInProgress = 0
  let tasksOverdue = 0

  if (input.project_id) {
    const [completedResult, inProgressResult, overdueResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id)
        .eq("status", "done")
        .gte("updated_at", input.period_start)
        .lte("updated_at", input.period_end + "T23:59:59"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id)
        .eq("status", "in-progress"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id)
        .neq("status", "done")
        .lt("end_date", new Date().toISOString().split("T")[0]),
    ])
    tasksCompleted = completedResult.count ?? 0
    tasksInProgress = inProgressResult.count ?? 0
    tasksOverdue = overdueResult.count ?? 0
  }

  // Create the report with flat fields
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      title: input.title,
      period_type: input.period_type,
      period_start: input.period_start,
      period_end: input.period_end,
      project_id: input.project_id,
      status: input.status,
      previous_status: input.previous_status ?? null,
      client_satisfaction: input.client_satisfaction,
      previous_satisfaction: input.previous_satisfaction ?? null,
      progress_percent: input.progress_percent,
      previous_progress: input.previous_progress ?? null,
      narrative: input.narrative ?? null,
      tasks_completed: tasksCompleted,
      tasks_in_progress: tasksInProgress,
      tasks_overdue: tasksOverdue,
      financial_notes: input.financial_notes ?? null,
      financial_total_value: input.financial_total_value ?? 0,
      financial_paid_amount: input.financial_paid_amount ?? 0,
      financial_invoiced_amount: input.financial_invoiced_amount ?? 0,
      financial_unpaid_amount: input.financial_unpaid_amount ?? 0,
      financial_currency: input.financial_currency ?? "USD",
    } satisfies ReportInsert)
    .select()
    .single()

  if (reportError || !report) {
    return { error: reportError?.message ?? "Failed to create report" }
  }

  // Insert risks and highlights in parallel
  const insertPromises: PromiseLike<any>[] = []

  if (input.risks.length > 0) {
    const reportRisks: ReportRiskInsert[] = input.risks.map((r) => ({
      report_id: report.id,
      type: r.type,
      description: r.description,
      severity: r.severity,
      status: r.status,
      mitigation_notes: r.mitigation_notes ?? null,
      originated_report_id: r.originated_report_id ?? report.id,
    }))
    insertPromises.push(
      supabase.from("report_risks").insert(reportRisks).select()
    )
  }

  if (input.highlights.length > 0) {
    const reportHighlights: ReportHighlightInsert[] = input.highlights.map((h) => ({
      report_id: report.id,
      type: h.type,
      description: h.description,
      sort_order: h.sort_order,
    }))
    insertPromises.push(
      supabase.from("report_highlights").insert(reportHighlights).select()
    )
  }

  await Promise.all(insertPromises)

  if (input.project_id) {
    revalidatePath(`/projects/${input.project_id}`)
  }
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

  // Calculate task stats
  let tasksCompleted = 0
  let tasksInProgress = 0
  let tasksOverdue = 0

  if (input.project_id) {
    const [completedResult, inProgressResult, overdueResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id)
        .eq("status", "done")
        .gte("updated_at", input.period_start)
        .lte("updated_at", input.period_end + "T23:59:59"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id)
        .eq("status", "in-progress"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id)
        .neq("status", "done")
        .lt("end_date", new Date().toISOString().split("T")[0]),
    ])
    tasksCompleted = completedResult.count ?? 0
    tasksInProgress = inProgressResult.count ?? 0
    tasksOverdue = overdueResult.count ?? 0
  }

  // Update report with flat fields
  const { data: report, error: updateError } = await supabase
    .from("reports")
    .update({
      title: input.title,
      period_type: input.period_type,
      period_start: input.period_start,
      period_end: input.period_end,
      project_id: input.project_id,
      status: input.status,
      previous_status: input.previous_status ?? null,
      client_satisfaction: input.client_satisfaction,
      previous_satisfaction: input.previous_satisfaction ?? null,
      progress_percent: input.progress_percent,
      previous_progress: input.previous_progress ?? null,
      narrative: input.narrative ?? null,
      tasks_completed: tasksCompleted,
      tasks_in_progress: tasksInProgress,
      tasks_overdue: tasksOverdue,
      financial_notes: input.financial_notes ?? null,
      financial_total_value: input.financial_total_value ?? 0,
      financial_paid_amount: input.financial_paid_amount ?? 0,
      financial_invoiced_amount: input.financial_invoiced_amount ?? 0,
      financial_unpaid_amount: input.financial_unpaid_amount ?? 0,
      financial_currency: input.financial_currency ?? "USD",
    })
    .eq("id", reportId)
    .select()
    .single()

  if (updateError || !report) {
    return { error: updateError?.message ?? "Failed to update report" }
  }

  // Delete and re-insert risks and highlights
  await Promise.all([
    supabase.from("report_risks").delete().eq("report_id", reportId),
    supabase.from("report_highlights").delete().eq("report_id", reportId),
  ])

  const insertPromises: PromiseLike<any>[] = []

  if (input.risks.length > 0) {
    const reportRisks: ReportRiskInsert[] = input.risks.map((r) => ({
      report_id: reportId,
      type: r.type,
      description: r.description,
      severity: r.severity,
      status: r.status,
      mitigation_notes: r.mitigation_notes ?? null,
      originated_report_id: r.originated_report_id ?? reportId,
    }))
    insertPromises.push(supabase.from("report_risks").insert(reportRisks).select())
  }

  if (input.highlights.length > 0) {
    const reportHighlights: ReportHighlightInsert[] = input.highlights.map((h) => ({
      report_id: reportId,
      type: h.type,
      description: h.description,
      sort_order: h.sort_order,
    }))
    insertPromises.push(supabase.from("report_highlights").insert(reportHighlights).select())
  }

  await Promise.all(insertPromises)

  if (input.project_id) {
    revalidatePath(`/projects/${input.project_id}`)
  }
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
    .select("organization_id, project_id")
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

  if (report.project_id) {
    revalidatePath(`/projects/${report.project_id}`)
  }
  return { data: { success: true } }
}

// ============================================
// Carry-over: Load previous report data
// ============================================

export async function getPreviousReportData(
  orgId: string
): Promise<ActionResult<{
  report: Report | null
  risks: ReportRisk[]
}>> {
  let supabase: Awaited<ReturnType<typeof requireOrgMember>>["supabase"]
  try {
    const ctx = await requireOrgMember(orgId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be an organization member" }
  }

  // Get most recent report
  const { data: prevReport, error } = await supabase
    .from("reports")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_start", { ascending: false })
    .limit(1)
    .single()

  if (error || !prevReport) {
    return { data: { report: null, risks: [] } }
  }

  // Load open/mitigated risks from previous report
  const { data: risks } = await supabase
    .from("report_risks")
    .select("*")
    .eq("report_id", prevReport.id)
    .in("status", ["open", "mitigated"])

  return {
    data: {
      report: prevReport,
      risks: risks ?? [],
    },
  }
}

// ============================================
// Combined wizard data fetch (single round-trip)
// ============================================

export type ReportWizardProject = {
  id: string
  name: string
  status: string
  clientName?: string
}

export type ReportWizardDataResult = {
  projects: ReportWizardProject[]
  actionItems: any[]
  previousReport: {
    report: Report | null
    risks: ReportRisk[]
  }
}

/**
 * Fetches all data the report wizard needs in a single server action call.
 * All DB queries run in parallel using Promise.all.
 */
export async function getReportWizardData(
  orgId: string
): Promise<ActionResult<ReportWizardDataResult>> {
  // Single auth + org membership check
  let supabase: Awaited<ReturnType<typeof requireOrgMember>>["supabase"]
  try {
    const ctx = await requireOrgMember(orgId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be an organization member" }
  }

  // Fetch projects, previous report, and action items in parallel
  const [projectsResult, prevReportResult, actionItemsResult] =
    await Promise.all([
      // Minimal project fields - only what the wizard needs
      supabase
        .from("projects")
        .select("id, name, status, client:clients(name)")
        .eq("organization_id", orgId)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("updated_at", { ascending: false }),
      // Previous report
      supabase
        .from("reports")
        .select("*")
        .eq("organization_id", orgId)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Open action items from past reports
      supabase
        .from("tasks")
        .select(`
          id, name, description, status, priority, end_date, created_at,
          source_report_id,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url),
          project:projects!tasks_project_id_fkey(id, name)
        `)
        .not("source_report_id", "is", null)
        .neq("status", "done")
        .order("created_at", { ascending: true }),
    ])

  // Check for errors
  if (projectsResult.error) return { error: `Failed to load projects: ${projectsResult.error.message}` }
  if (actionItemsResult.error) return { error: `Failed to load action items: ${actionItemsResult.error.message}` }

  // Build active projects list
  const activeProjects: ReportWizardProject[] = (projectsResult.data ?? []).map(
    (p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client?.name ?? undefined,
    })
  )

  // Previous report sub-entities
  const prevReport = prevReportResult.data
  let prevRisks: ReportRisk[] = []

  if (prevReport) {
    const risksResult = await supabase
      .from("report_risks")
      .select("*")
      .eq("report_id", prevReport.id)
      .in("status", ["open", "mitigated"])

    prevRisks = risksResult.data ?? []
  }

  // Calculate weeks open for action items
  const now = new Date()
  const actionItems = (actionItemsResult.data ?? []).map((task: any) => {
    const createdAt = new Date(task.created_at)
    const weeksOpen = Math.floor(
      (now.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    return { ...task, weeks_open: weeksOpen }
  })

  return {
    data: {
      projects: activeProjects,
      actionItems,
      previousReport: {
        report: prevReport ?? null,
        risks: prevRisks,
      },
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
      priority: (["no-priority", "low", "medium", "high", "urgent"].includes(input.priority ?? "")
        ? input.priority
        : "medium") as "no-priority" | "low" | "medium" | "high" | "urgent",
      end_date: input.dueDate ?? null,
      status: "todo",
      tag: "Action Item",
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

  revalidatePath(`/projects/${input.projectId}`)
  return { data: task }
}

// ============================================
// Get action items for a specific report
// ============================================

export async function getReportActionItems(
  reportId: string
): Promise<ActionResult<TaskWithRelations[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      workstream:workstreams(id, name),
      project:projects!tasks_project_id_fkey(id, name)
    `)
    .eq("source_report_id", reportId)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }
  return { data: (data ?? []) as TaskWithRelations[] }
}

// ============================================
// Get open action items (for wizard Step 5)
// ============================================

export async function getOpenActionItems(
  orgId: string
): Promise<ActionResult<any[]>> {
  let supabase: Awaited<ReturnType<typeof requireOrgMember>>["supabase"]
  try {
    const ctx = await requireOrgMember(orgId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be an organization member" }
  }

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

// ============================================
// Get reports for a specific project
// ============================================

export type ProjectReportListItem = {
  id: string
  title: string
  period_type: ReportPeriodType
  period_start: string
  period_end: string
  status: ReportProjectStatus
  progress_percent: number
  tasks_completed: number
  tasks_in_progress: number
  tasks_overdue: number
  created_at: string
  author: ProfileMinimal
}

export async function getProjectReports(
  projectId: string
): Promise<ActionResult<ProjectReportListItem[]>> {
  let supabase: Awaited<ReturnType<typeof requireProjectMember>>["supabase"]
  try {
    const ctx = await requireProjectMember(projectId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be a project member to view reports" }
  }

  const { data: reports, error } = await supabase
    .from("reports")
    .select(`
      id, title, period_type, period_start, period_end, status,
      progress_percent, tasks_completed, tasks_in_progress, tasks_overdue,
      created_at,
      author:profiles!reports_created_by_fkey(id, full_name, email, avatar_url)
    `)
    .eq("project_id", projectId)
    .order("period_start", { ascending: false })

  if (error) return { error: error.message }

  return { data: (reports ?? []) as ProjectReportListItem[] }
}

// ============================================
// Auto-calculate project report stats
// ============================================

export type ProjectReportStats = {
  // Progress from workstreams/tasks
  calculatedProgress: number
  totalWorkstreams: number
  completedWorkstreams: number
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  // Financial from deliverables
  totalValue: number
  paidAmount: number
  invoicedAmount: number
  unpaidAmount: number
  currency: string
}

export async function getProjectReportStats(
  projectId: string
): Promise<ActionResult<ProjectReportStats>> {
  let supabase: Awaited<ReturnType<typeof requireProjectMember>>["supabase"]
  try {
    const ctx = await requireProjectMember(projectId)
    supabase = ctx.supabase
  } catch {
    return { error: "You must be a project member to view report stats" }
  }

  const [
    workstreamsResult,
    tasksResult,
    deliverablesResult,
    projectResult,
  ] = await Promise.all([
    supabase
      .from("workstreams")
      .select("id")
      .eq("project_id", projectId),
    supabase
      .from("tasks")
      .select("id, status, workstream_id, end_date")
      .eq("project_id", projectId),
    supabase
      .from("project_deliverables")
      .select("value, payment_status")
      .eq("project_id", projectId),
    supabase
      .from("projects")
      .select("currency")
      .eq("id", projectId)
      .single(),
  ])

  const workstreams = workstreamsResult.data ?? []
  const tasks = tasksResult.data ?? []
  const deliverables = deliverablesResult.data ?? []
  const currency = projectResult.data?.currency || "USD"

  // Calculate workstream completion (a workstream is "done" if all its tasks are done)
  const workstreamTaskMap = new Map<string, { total: number; done: number }>()
  for (const ws of workstreams) {
    workstreamTaskMap.set(ws.id, { total: 0, done: 0 })
  }
  let rootDone = 0
  let rootTotal = 0
  const today = new Date().toISOString().split("T")[0]

  for (const task of tasks) {
    if (task.workstream_id && workstreamTaskMap.has(task.workstream_id)) {
      const ws = workstreamTaskMap.get(task.workstream_id)!
      ws.total++
      if (task.status === "done") ws.done++
    } else {
      rootTotal++
      if (task.status === "done") rootDone++
    }
  }

  let completedWorkstreams = 0
  for (const [, ws] of workstreamTaskMap) {
    if (ws.total > 0 && ws.done === ws.total) completedWorkstreams++
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === "done").length
  const inProgressTasks = tasks.filter(t => t.status === "in-progress").length
  const overdueTasks = tasks.filter(t => t.status !== "done" && t.end_date && t.end_date < today).length

  // Calculate progress: weighted by workstreams + root tasks
  const totalUnits = workstreams.length + rootTotal
  const completedUnits = completedWorkstreams + rootDone
  const calculatedProgress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0

  // Financial summary from deliverables
  let totalValue = 0
  let paidAmount = 0
  let invoicedAmount = 0
  let unpaidAmount = 0

  for (const d of deliverables) {
    const val = d.value ?? 0
    totalValue += val
    if (d.payment_status === "paid") paidAmount += val
    else if (d.payment_status === "invoiced") invoicedAmount += val
    else unpaidAmount += val
  }

  return {
    data: {
      calculatedProgress,
      totalWorkstreams: workstreams.length,
      completedWorkstreams,
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      totalValue,
      paidAmount,
      invoicedAmount,
      unpaidAmount,
      currency,
    },
  }
}
