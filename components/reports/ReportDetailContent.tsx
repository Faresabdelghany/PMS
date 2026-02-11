"use client"

import { useState, useCallback, useMemo, useTransition, startTransition } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { QuickCreateModalLayout } from "@/components/QuickCreateModalLayout"
import { GenericPicker, DatePicker } from "@/components/project-wizard/steps/StepQuickCreate"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { createReportActionItem } from "@/lib/actions/reports"
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
import { X } from "@phosphor-icons/react/dist/ssr/X"

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

const ACTION_PRIORITY_OPTIONS = [
  { id: "no-priority", label: "No priority" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
]

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  todo: { label: "To Do", color: "text-muted-foreground", Icon: Circle },
  "in-progress": { label: "In Progress", color: "text-blue-600", Icon: Clock },
  done: { label: "Done", color: "text-emerald-600", Icon: CheckCircle },
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

type OrgMember = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

type ActionItem = {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  end_date: string | null
  created_at: string
  assignee: { id: string; full_name: string; avatar_url: string | null } | null
  project: { id: string; name: string } | null
}

interface ReportDetailContentProps {
  report: any
  organizationMembers: OrgMember[]
  actionItems: ActionItem[]
}

// ============================================
// Main Component
// ============================================

export function ReportDetailContent({ report, organizationMembers, actionItems }: ReportDetailContentProps) {
  const router = useRouter()
  const [showMeta, setShowMeta] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [, startTabTransition] = useTransition()

  // Action item modal state
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionTitle, setActionTitle] = useState("")
  const [actionDescription, setActionDescription] = useState("")
  const [actionAssignee, setActionAssignee] = useState<{ id: string; name: string; avatar?: string | null } | undefined>(undefined)
  const [actionPriority, setActionPriority] = useState<{ id: string; label: string }>(ACTION_PRIORITY_OPTIONS[1])
  const [actionDueDate, setActionDueDate] = useState<Date | undefined>(undefined)

  // Flat data from report
  const risks = report.report_risks || []
  const highlights = (report.report_highlights || []).filter((h: any) => h.type === "highlight")
  const decisions = (report.report_highlights || []).filter((h: any) => h.type === "decision")
  const statusConfig = PROJECT_STATUS_CONFIG[report.status as ReportProjectStatus] ?? PROJECT_STATUS_CONFIG.on_track
  const satisfactionConfig = SATISFACTION_CONFIG[report.client_satisfaction as ClientSatisfaction] ?? SATISFACTION_CONFIG.satisfied

  const breadcrumbs = [
    { label: "Reports", href: "/reports" },
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

  // Convert org members to picker format
  const assigneeOptions = useMemo(() =>
    organizationMembers.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatarUrl,
    })),
    [organizationMembers]
  )

  const handleAddActionItem = useCallback(async () => {
    if (!actionTitle.trim() || !report.project?.id) {
      toast.error("Please provide a task name")
      return
    }

    setActionLoading(true)
    const result = await createReportActionItem({
      reportId: report.id,
      projectId: report.project.id,
      name: actionTitle.trim(),
      description: actionDescription.trim() || undefined,
      assigneeId: actionAssignee?.id || undefined,
      priority: actionPriority.id === "no-priority" ? "medium" : actionPriority.id,
      dueDate: actionDueDate ? actionDueDate.toISOString().split("T")[0] : undefined,
    })
    setActionLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Action item created")
    setShowActionModal(false)
    setActionTitle("")
    setActionDescription("")
    setActionAssignee(undefined)
    setActionPriority(ACTION_PRIORITY_OPTIONS[1])
    setActionDueDate(undefined)
    startTransition(() => router.refresh())
  }, [actionTitle, actionDescription, actionAssignee, actionPriority, actionDueDate, report.id, report.project, router])

  const openActionModal = useCallback(() => {
    setShowActionModal(true)
  }, [])

  const closeActionModal = useCallback(() => {
    setShowActionModal(false)
  }, [])

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

                {/* Narrative */}
                {report.narrative && (
                  <section>
                    <h3 className="text-base font-semibold mb-3">Summary</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {report.narrative}
                    </p>
                  </section>
                )}

                {/* Financial Notes */}
                {report.financial_notes && (
                  <section>
                    <h3 className="text-base font-semibold mb-3">Financial Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {report.financial_notes}
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
                    <h3 className="text-base font-semibold">Action Items</h3>
                    {report.project && (
                      <Button variant="outline" size="sm" onClick={openActionModal}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Action Item
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Tasks created from this report appear on the Tasks page with a &quot;report-action&quot; tag.
                  </p>

                  {actionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                      <p className="text-sm text-muted-foreground">No action items yet.</p>
                      {report.project && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={openActionModal}>
                          <Plus className="h-3.5 w-3.5" />
                          Create first action item
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {actionItems.map((item) => {
                        const taskStatusConfig = TASK_STATUS_CONFIG[item.status] || TASK_STATUS_CONFIG.todo
                        const StatusIcon = taskStatusConfig.Icon
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                          >
                            <StatusIcon className={cn("h-4 w-4 shrink-0", taskStatusConfig.color)} />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", item.status === "done" && "line-through text-muted-foreground")}>
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                {item.priority && (
                                  <span className="capitalize">{item.priority}</span>
                                )}
                                {item.end_date && (
                                  <>
                                    <span className="text-muted-foreground/40">&middot;</span>
                                    <span>Due {new Date(item.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {item.assignee && (
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage
                                  src={getOptimizedAvatarUrl(item.assignee.avatar_url, 24) || undefined}
                                  alt={item.assignee.full_name}
                                />
                                <AvatarFallback className="text-[9px]">
                                  {item.assignee.full_name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <Badge variant="outline" className={cn("text-xs shrink-0", taskStatusConfig.color)}>
                              {taskStatusConfig.label}
                            </Badge>
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
                  <aside className="flex flex-col gap-10 p-4 pt-8 lg:sticky lg:self-start">
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

        {/* Add Action Item Modal */}
        <QuickCreateModalLayout
          open={showActionModal}
          onClose={closeActionModal}
          onSubmitShortcut={handleAddActionItem}
        >
          {/* Context row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {report.project && (
                <div className="bg-background flex gap-2 h-7 items-center px-2 py-1 rounded-lg border border-border text-xs">
                  <Folder className="size-4 text-muted-foreground" />
                  <span className="truncate max-w-[160px] font-medium text-foreground">
                    {report.project.name}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeActionModal}
              className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2 w-full shrink-0 mt-1">
            <div className="flex gap-1 h-10 items-center w-full">
              <input
                type="text"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder="Action item title"
                className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="w-full">
            <textarea
              value={actionDescription}
              onChange={(e) => setActionDescription(e.target.value)}
              placeholder="Briefly describe this action item..."
              rows={3}
              className="w-full text-sm leading-6 text-foreground placeholder:text-muted-foreground outline-none bg-transparent border-none p-0 resize-none"
            />
          </div>

          {/* Properties row */}
          <div className="flex flex-wrap gap-2.5 items-start w-full shrink-0">
            {/* Assignee */}
            {assigneeOptions.length > 0 && (
              <GenericPicker
                items={assigneeOptions}
                onSelect={setActionAssignee}
                selectedId={actionAssignee?.id}
                placeholder="Assign owner..."
                renderItem={(item) => (
                  <div className="flex items-center gap-2 w-full">
                    {item.avatar ? (
                      <Image
                        src={item.avatar}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {item.name.charAt(0)}
                      </div>
                    )}
                    <span className="flex-1">{item.name}</span>
                  </div>
                )}
                trigger={
                  <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <div className="size-4 rounded-full bg-background flex items-center justify-center text-[10px] font-medium">
                      {actionAssignee?.name.charAt(0) ?? "?"}
                    </div>
                    <span className="font-medium text-foreground text-sm leading-5">
                      {actionAssignee?.name ?? "Assignee"}
                    </span>
                  </button>
                }
              />
            )}

            {/* Due date */}
            <DatePicker
              date={actionDueDate}
              onSelect={setActionDueDate}
              trigger={
                <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                  <CalendarBlank className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground text-sm leading-5">
                    {actionDueDate ? format(actionDueDate, "dd/MM/yyyy") : "Due date"}
                  </span>
                </button>
              }
            />

            {/* Priority */}
            <GenericPicker
              items={ACTION_PRIORITY_OPTIONS}
              onSelect={setActionPriority}
              selectedId={actionPriority?.id}
              placeholder="Set priority..."
              renderItem={(item) => (
                <div className="flex items-center gap-2 w-full">
                  <span className="flex-1">{item.label}</span>
                </div>
              )}
              trigger={
                <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                  <ChartBar className="size-4 text-muted-foreground" />
                  <span className="font-medium text-foreground text-sm leading-5">
                    {actionPriority?.label ?? "Priority"}
                  </span>
                </button>
              }
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end mt-auto w-full pt-4 shrink-0">
            <Button type="button" onClick={handleAddActionItem} disabled={actionLoading} className="h-10 px-4 rounded-xl">
              {actionLoading ? "Creating..." : "Create Action Item"}
            </Button>
          </div>
        </QuickCreateModalLayout>
      </div>
    </div>
  )
}

const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)
