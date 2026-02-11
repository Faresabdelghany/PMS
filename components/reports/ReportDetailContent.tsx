"use client"

import { useState, useCallback, useMemo, useTransition, startTransition } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { TaskQuickCreateModal } from "@/components/tasks/TaskQuickCreateModal"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { cn } from "@/lib/utils"

import { LinkSimple } from "@phosphor-icons/react/dist/ssr/LinkSimple"
import { SquareHalf } from "@phosphor-icons/react/dist/ssr/SquareHalf"
import { PencilSimpleLine } from "@phosphor-icons/react/dist/ssr/PencilSimpleLine"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { ArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp"
import { ArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown"
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { UserCircle } from "@phosphor-icons/react/dist/ssr/UserCircle"
import { ChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle"
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"
import { Folder } from "@phosphor-icons/react/dist/ssr/Folder"
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut"

import type { ReportProjectStatus, ClientSatisfaction, RiskSeverity, RiskStatus } from "@/lib/supabase/types"

// ============================================
// Constants
// ============================================

const PROJECT_STATUS_CONFIG: Record<ReportProjectStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "text-emerald-700", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  behind: { label: "Behind", color: "text-yellow-700", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  at_risk: { label: "At Risk", color: "text-red-700", bg: "bg-red-100 dark:bg-red-900/30" },
  halted: { label: "Halted", color: "text-gray-700", bg: "bg-gray-100 dark:bg-gray-900/30" },
  completed: { label: "Completed", color: "text-blue-700", bg: "bg-blue-100 dark:bg-blue-900/30" },
}

const SATISFACTION_CONFIG: Record<ClientSatisfaction, { label: string; color: string }> = {
  satisfied: { label: "Satisfied", color: "text-emerald-600" },
  neutral: { label: "Neutral", color: "text-yellow-600" },
  dissatisfied: { label: "Dissatisfied", color: "text-red-600" },
}

const SEVERITY_CONFIG: Record<RiskSeverity, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  critical: { label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
}

const RISK_STATUS_CONFIG: Record<RiskStatus, { label: string; color: string; decoration?: string }> = {
  open: { label: "Open", color: "text-red-600" },
  mitigated: { label: "Mitigated", color: "text-yellow-600" },
  resolved: { label: "Resolved", color: "text-green-600", decoration: "line-through" },
}

const PERIOD_TYPE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
}

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  todo: { label: "To Do", color: "text-muted-foreground", Icon: Circle },
  "in-progress": { label: "In Progress", color: "text-blue-600", Icon: Clock },
  done: { label: "Done", color: "text-emerald-600", Icon: CheckCircle },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  low: { label: "Low", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  "no-priority": { label: "None", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
}

// ============================================
// Helpers
// ============================================

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const startMonth = s.toLocaleString("en-US", { month: "long" })
  const endMonth = e.toLocaleString("en-US", { month: "long" })
  if (startMonth === endMonth) {
    return `${startMonth} ${s.getDate()} \u2013 ${e.getDate()}, ${s.getFullYear()}`
  }
  return `${startMonth} ${s.getDate()} \u2013 ${endMonth} ${e.getDate()}, ${s.getFullYear()}`
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function StatusChangeIndicator({ current, previous }: { current: string; previous: string | null }) {
  if (!previous || current === previous) {
    return <span className="text-xs text-muted-foreground">no change</span>
  }

  const statusOrder: Record<string, number> = {
    completed: 5, on_track: 4, behind: 2, at_risk: 1, halted: 0,
    satisfied: 3, neutral: 2, dissatisfied: 1,
  }
  const currentVal = statusOrder[current] ?? 0
  const previousVal = statusOrder[previous] ?? 0

  if (currentVal > previousVal) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
        <ArrowUp className="h-3 w-3" /> was {PROJECT_STATUS_CONFIG[previous as ReportProjectStatus]?.label || previous}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
      <ArrowDown className="h-3 w-3" /> was {PROJECT_STATUS_CONFIG[previous as ReportProjectStatus]?.label || previous}
    </span>
  )
}

function ProgressDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === undefined) return null
  const delta = current - previous
  if (delta === 0) return null
  return (
    <span className={cn("text-xs ml-2", delta > 0 ? "text-emerald-600" : "text-red-600")}>
      {delta > 0 ? "+" : ""}{delta}% from last week
    </span>
  )
}

// ============================================
// Types
// ============================================

type OrganizationMember = {
  id: string
  user_id: string
  role: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

type ActionItem = {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  end_date: string | null
  tag: string | null
  created_at: string
  assignee: { id: string; full_name: string; avatar_url: string | null } | null
  project: { id: string; name: string } | null
}

interface ReportDetailContentProps {
  report: any
  organizationMembers: OrganizationMember[]
  actionItems: ActionItem[]
  /** When rendered under a project, use project-scoped breadcrumbs */
  projectId?: string
  organizationTags?: { id: string; name: string; color: string }[]
  projectWorkstreams?: { id: string; name: string }[]
}

// ============================================
// Main Component
// ============================================

export function ReportDetailContent({
  report,
  organizationMembers,
  actionItems,
  projectId,
  organizationTags = [],
  projectWorkstreams = [],
}: ReportDetailContentProps) {
  const router = useRouter()
  const [showMeta, setShowMeta] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [, startTabTransition] = useTransition()

  // Flat data from report
  const risks = report.report_risks || []
  const highlights = (report.report_highlights || []).filter((h: any) => h.type === "highlight")
  const decisions = (report.report_highlights || []).filter((h: any) => h.type === "decision")
  const statusConfig = report.status in PROJECT_STATUS_CONFIG
    ? PROJECT_STATUS_CONFIG[report.status as ReportProjectStatus]
    : (console.warn(`[Report ${report.id}] Unknown status: "${report.status}"`),
       { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted" })
  const satisfactionConfig = report.client_satisfaction in SATISFACTION_CONFIG
    ? SATISFACTION_CONFIG[report.client_satisfaction as ClientSatisfaction]
    : (console.warn(`[Report ${report.id}] Unknown satisfaction: "${report.client_satisfaction}"`),
       { label: "Unknown", color: "text-muted-foreground" })

  const effectiveProjectId = projectId || report.project?.id
  const breadcrumbs = effectiveProjectId
    ? [
        { label: "Projects", href: "/projects" },
        { label: report.project?.name || "Project", href: `/projects/${effectiveProjectId}` },
        { label: report.title },
      ]
    : [
        { label: "Projects", href: "/projects" },
        { label: report.title },
      ]

  const copyLink = useCallback(async () => {
    if (!navigator.clipboard) {
      toast.error("Clipboard not available")
      return
    }
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }, [])

  const handleEdit = useCallback(() => {
    setShowWizard(true)
  }, [])

  // Build TaskQuickCreateModal project data
  const modalProjects = useMemo(() => {
    if (!effectiveProjectId || !report.project) return []
    return [{
      id: effectiveProjectId,
      name: report.project.name,
      workstreams: projectWorkstreams,
    }]
  }, [effectiveProjectId, report.project, projectWorkstreams])

  const handleTaskCreated = useCallback(() => {
    setShowTaskModal(false)
    startTransition(() => router.refresh())
  }, [router])

  // Financial data
  const financialTotalValue = report.financial_total_value ?? 0
  const financialPaid = report.financial_paid_amount ?? 0
  const financialInvoiced = report.financial_invoiced_amount ?? 0
  const financialUnpaid = report.financial_unpaid_amount ?? 0
  const financialCurrency = report.financial_currency || "USD"
  const hasFinancialData = financialTotalValue > 0 || financialPaid > 0 || financialInvoiced > 0 || financialUnpaid > 0

  // Overdue detection for action items
  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <div className="hidden sm:block">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Copy link" onClick={copyLink}>
            <LinkSimple className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={!showMeta}
            aria-label={showMeta ? "Collapse meta panel" : "Expand meta panel"}
            className={showMeta ? "bg-muted" : ""}
            onClick={() => startTabTransition(() => setShowMeta((v) => !v))}
          >
            <SquareHalf className="h-4 w-4" weight="duotone" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col bg-background px-2 my-0 rounded-b-lg min-w-0 border-t">
        <div className="px-4">
          <div className="mx-auto w-full max-w-7xl">
            <div
              className={cn(
                "mt-0 grid grid-cols-1 gap-15",
                showMeta && "lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]"
              )}
            >
              {/* Main Content Column - Single Flow Layout */}
              <div className="space-y-8 pt-4 pb-8">
                {/* Report Header */}
                <section className="mt-4 space-y-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-semibold text-foreground leading-tight">{report.title}</h1>
                      <Badge variant="secondary" className="border-none bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {PERIOD_TYPE_LABELS[report.period_type] || report.period_type}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit report"
                      className="rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={handleEdit}
                    >
                      <PencilSimpleLine className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span>{formatDateRange(report.period_start, report.period_end)}</span>
                    <span className="text-muted-foreground/40">|</span>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={getOptimizedAvatarUrl(report.author?.avatar_url, 40) || undefined}
                          alt={report.author?.full_name || ""}
                        />
                        <AvatarFallback className="text-[10px]">
                          {report.author?.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{report.author?.full_name || "Unknown"}</span>
                    </div>
                    <span className="text-muted-foreground/40">|</span>
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                </section>

                {/* Project Status Card */}
                {report.project && (
                  <section className="rounded-lg border">
                    <div className="flex items-center justify-between p-6 pb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/projects/${report.project.id}`}
                          className="text-lg font-semibold hover:underline underline-offset-4 inline-flex items-center gap-1.5"
                        >
                          {report.project.name}
                          <ArrowSquareOut className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusConfig.bg, statusConfig.color)}>
                          {statusConfig.label}
                        </span>
                        <StatusChangeIndicator current={report.status} previous={report.previous_status} />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={satisfactionConfig.color}>{satisfactionConfig.label}</span>
                        {report.previous_satisfaction && report.previous_satisfaction !== report.client_satisfaction && (
                          <StatusChangeIndicator current={report.client_satisfaction} previous={report.previous_satisfaction} />
                        )}
                      </div>
                    </div>

                    <div className="px-6 pb-6 space-y-5">
                      {/* Progress */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium">Progress: {report.progress_percent ?? 0}%</span>
                          <ProgressDelta current={report.progress_percent ?? 0} previous={report.previous_progress} />
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${report.progress_percent ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Stats */}
                      <div className="flex gap-4 text-sm">
                        <span className="text-emerald-600">{report.tasks_completed ?? 0} completed</span>
                        <span className="text-blue-600">{report.tasks_in_progress ?? 0} in progress</span>
                        {(report.tasks_overdue ?? 0) > 0 && (
                          <span className="text-red-600">{report.tasks_overdue} overdue</span>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Financial Summary */}
                {(hasFinancialData || report.financial_notes) && (
                  <section>
                    <h3 className="text-base font-semibold mb-3">Financial Summary</h3>
                    {hasFinancialData && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <p className="text-xs text-muted-foreground">Total Value</p>
                          <p className="text-lg font-semibold mt-1">{formatCurrency(financialTotalValue, financialCurrency)}</p>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <p className="text-xs text-emerald-600">Collected</p>
                          <p className="text-lg font-semibold mt-1 text-emerald-700 dark:text-emerald-400">{formatCurrency(financialPaid, financialCurrency)}</p>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <p className="text-xs text-yellow-600">Invoiced</p>
                          <p className="text-lg font-semibold mt-1 text-yellow-700 dark:text-yellow-400">{formatCurrency(financialInvoiced, financialCurrency)}</p>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <p className="text-xs text-red-600">Outstanding</p>
                          <p className="text-lg font-semibold mt-1 text-red-700 dark:text-red-400">{formatCurrency(financialUnpaid, financialCurrency)}</p>
                        </div>
                      </div>
                    )}
                    {report.financial_notes && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {report.financial_notes}
                      </p>
                    )}
                  </section>
                )}

                {/* Narrative */}
                {report.narrative && (
                  <section>
                    <h3 className="text-base font-semibold mb-3">Summary</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {report.narrative}
                    </p>
                  </section>
                )}

                {/* Highlights */}
                {highlights.length > 0 && (
                  <section>
                    <h3 className="text-base font-semibold mb-3">Highlights</h3>
                    <ul className="space-y-2">
                      {highlights.map((h: any) => (
                        <li key={h.id} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{h.description}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Decisions Needed */}
                {decisions.length > 0 && (
                  <section>
                    <h3 className="text-base font-semibold mb-3">Decisions Needed</h3>
                    <div className="space-y-2">
                      {decisions.map((d: any) => (
                        <div
                          key={d.id}
                          className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4"
                        >
                          <div className="flex items-start gap-2">
                            <WarningCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm">{d.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Risks & Blockers */}
                <section>
                  <h3 className="text-base font-semibold mb-3">Risks &amp; Blockers</h3>
                  {risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No risks or blockers reported.</p>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Description</th>
                              <th className="text-left p-3 font-medium w-20">Type</th>
                              <th className="text-left p-3 font-medium w-20">Severity</th>
                              <th className="text-left p-3 font-medium w-20">Status</th>
                              <th className="text-left p-3 font-medium w-32">Mitigation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {risks.map((risk: any) => {
                              const severityConfig = SEVERITY_CONFIG[risk.severity as RiskSeverity]
                              const riskStatusConfig = RISK_STATUS_CONFIG[risk.status as RiskStatus]
                              return (
                                <tr key={risk.id} className={risk.status === "resolved" ? "opacity-60" : ""}>
                                  <td className="p-3">
                                    {risk.description}
                                  </td>
                                  <td className="p-3 capitalize">{risk.type}</td>
                                  <td className="p-3">
                                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", severityConfig?.color)}>
                                      {severityConfig?.label}
                                    </span>
                                  </td>
                                  <td className={cn("p-3 font-medium", riskStatusConfig?.color, riskStatusConfig?.decoration)}>
                                    {riskStatusConfig?.label}
                                  </td>
                                  <td className="p-3 text-muted-foreground">{risk.mitigation_notes || "\u2014"}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile card layout */}
                      <div className="space-y-3 md:hidden">
                        {risks.map((risk: any) => {
                          const severityConfig = SEVERITY_CONFIG[risk.severity as RiskSeverity]
                          const riskStatusConfig = RISK_STATUS_CONFIG[risk.status as RiskStatus]
                          return (
                            <div
                              key={risk.id}
                              className={cn(
                                "rounded-lg border p-4 space-y-2.5",
                                risk.status === "resolved" && "opacity-60",
                              )}
                            >
                              <p className="text-sm font-medium">
                                {risk.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                                  {risk.type}
                                </span>
                                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", severityConfig?.color)}>
                                  {severityConfig?.label}
                                </span>
                                <span className={cn("text-xs font-medium", riskStatusConfig?.color, riskStatusConfig?.decoration)}>
                                  {riskStatusConfig?.label}
                                </span>
                              </div>
                              {risk.mitigation_notes && (
                                <p className="text-xs text-muted-foreground">
                                  {risk.mitigation_notes}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </section>

                {/* Action Items */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">Action Items</h3>
                      <Badge variant="secondary" className="text-xs">{actionItems.length}</Badge>
                    </div>
                    {report.project && (
                      <Button variant="outline" size="sm" onClick={() => setShowTaskModal(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Action Item
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Tasks created from this report appear on the Tasks page with the &quot;Action Item&quot; tag.
                  </p>

                  {actionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                      <p className="text-sm text-muted-foreground">No action items yet.</p>
                      {report.project && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowTaskModal(true)}>
                          <Plus className="h-3.5 w-3.5" />
                          Create first action item
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border divide-y">
                      {actionItems.map((item) => {
                        const taskStatusConfig = TASK_STATUS_CONFIG[item.status] || TASK_STATUS_CONFIG.todo
                        const StatusIcon = taskStatusConfig.Icon
                        const priorityConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG["no-priority"]
                        const isOverdue = item.end_date && item.end_date < today && item.status !== "done"

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => {
                              if (effectiveProjectId) {
                                router.push(`/projects/${effectiveProjectId}?task=${item.id}`)
                              }
                            }}
                          >
                            <StatusIcon className={cn("h-4 w-4 shrink-0", taskStatusConfig.color)} />
                            <span className={cn(
                              "text-sm font-medium truncate min-w-0",
                              item.status === "done" && "line-through text-muted-foreground"
                            )}>
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 ml-auto shrink-0">
                              <Badge variant="secondary" className={cn("text-[10px] font-medium", priorityConfig.color)}>
                                {priorityConfig.label}
                              </Badge>
                              {item.assignee && (
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={getOptimizedAvatarUrl(item.assignee.avatar_url, 24) || undefined}
                                    alt={item.assignee.full_name}
                                  />
                                  <AvatarFallback className="text-[9px]">
                                    {item.assignee.full_name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              {item.end_date && (
                                <span className={cn(
                                  "text-xs whitespace-nowrap",
                                  isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                                )}>
                                  {isOverdue && "Overdue \u2022 "}
                                  {new Date(item.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                              {item.tag && (
                                <Badge variant="outline" className="text-[10px]">
                                  {item.tag}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Meta Panel */}
              {showMeta && (
                <div className="lg:border-l lg:border-border lg:pl-6 animate-in fade-in duration-150">
                  <aside className="flex flex-col gap-10 p-4 pt-8 lg:sticky lg:top-4 lg:self-start">
                    {/* Report Info */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Report Info</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarBlank className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Period</p>
                            <p className="font-medium">{formatDateRange(report.period_start, report.period_end)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Created</p>
                            <p className="font-medium">{new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Author */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Author</h3>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={getOptimizedAvatarUrl(report.author?.avatar_url, 64) || undefined}
                            alt={report.author?.full_name || ""}
                          />
                          <AvatarFallback className="text-xs">
                            {report.author?.full_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{report.author?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{report.author?.email}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Project Info */}
                    {report.project && (
                      <>
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project</h3>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/projects/${report.project.id}`}
                                  className="font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
                                >
                                  {report.project.name}
                                  <ArrowSquareOut className="h-3 w-3 text-muted-foreground" />
                                </Link>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <ChartBar className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusConfig.bg, statusConfig.color)}>
                                  {statusConfig.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator />
                      </>
                    )}

                    {/* Summary Stats */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Summary</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <WarningCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{risks.filter((r: any) => r.status !== "resolved").length} open risks</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{actionItems.filter(a => a.status !== "done").length} open action items</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />

        {/* Edit Wizard */}
        {showWizard && (
          <LazyReportWizard
            onClose={() => setShowWizard(false)}
            onCreate={() => {
              setShowWizard(false)
              startTransition(() => router.refresh())
            }}
            organizationId={report.organization_id}
            editingReportId={report.id}
          />
        )}

        {/* Add Action Item via TaskQuickCreateModal */}
        <TaskQuickCreateModal
          open={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          onTaskCreated={handleTaskCreated}
          context={{ projectId: effectiveProjectId }}
          projects={modalProjects}
          organizationMembers={organizationMembers}
          tags={organizationTags}
          defaultTag="Action Item"
          defaultTagLocked
          sourceReportId={report.id}
        />
      </div>
    </div>
  )
}

const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)
