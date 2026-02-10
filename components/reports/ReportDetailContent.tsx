"use client"

import { useState, useCallback, useTransition, startTransition } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
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

const RISK_STATUS_CONFIG: Record<RiskStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "text-red-600" },
  mitigated: { label: "Mitigated", color: "text-yellow-600" },
  resolved: { label: "Resolved", color: "text-green-600 line-through" },
}

const PERIOD_TYPE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
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
  const [activeTab, setActiveTab] = useState("overview")
  const [, startTabTransition] = useTransition()

  // Action item dialog state
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionForm, setActionForm] = useState({
    projectId: "",
    name: "",
    description: "",
    assigneeId: "",
    priority: "medium",
    dueDate: "",
  })

  const reportProjects = report.report_projects || []
  const risks = report.report_risks || []
  const highlights = (report.report_highlights || []).filter((h: any) => h.type === "highlight")
  const decisions = (report.report_highlights || []).filter((h: any) => h.type === "decision")

  // Portfolio summary calculations
  const statusCounts: Record<string, number> = {}
  for (const rp of reportProjects) {
    statusCounts[rp.status] = (statusCounts[rp.status] || 0) + 1
  }

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

  const handleAddActionItem = useCallback(async () => {
    if (!actionForm.name.trim() || !actionForm.projectId) {
      toast.error("Please provide a task name and select a project")
      return
    }

    setActionLoading(true)
    const result = await createReportActionItem({
      reportId: report.id,
      projectId: actionForm.projectId,
      name: actionForm.name.trim(),
      description: actionForm.description.trim() || undefined,
      assigneeId: actionForm.assigneeId || undefined,
      priority: actionForm.priority,
      dueDate: actionForm.dueDate || undefined,
    })
    setActionLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Action item created")
    setShowActionDialog(false)
    setActionForm({ projectId: "", name: "", description: "", assigneeId: "", priority: "medium", dueDate: "" })
    startTransition(() => router.refresh())
  }, [actionForm, report.id, router])

  const openActionDialog = useCallback(() => {
    // Pre-select first project if only one
    if (reportProjects.length === 1) {
      setActionForm(prev => ({ ...prev, projectId: reportProjects[0].project?.id || "" }))
    }
    setShowActionDialog(true)
  }, [reportProjects])

  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      {/* Header Row - matches ProjectDetailsPage */}
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
            onClick={() => startTransition(() => setShowMeta((v) => !v))}
          >
            <SquareHalf className="h-4 w-4" weight="duotone" />
          </Button>
        </div>
      </div>

      {/* Content Area - matches ProjectDetailsPage */}
      <div className="flex flex-1 flex-col bg-background px-2 my-0 rounded-b-lg min-w-0 border-t">
        <div className="px-4">
          <div className="mx-auto w-full max-w-7xl">
            <div
              className={cn(
                "mt-0 grid grid-cols-1 gap-15",
                showMeta && "lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]"
              )}
            >
              {/* Main Content Column */}
              <div className="space-y-6 pt-4">
                {/* Report Header - mirrors ProjectHeader */}
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
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
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

                {/* Tabs - matches ProjectDetailsPage tab system */}
                <Tabs value={activeTab} onValueChange={(value) => startTabTransition(() => setActiveTab(value))}>
                  <TabsList className="w-full gap-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="projects">Projects</TabsTrigger>
                    <TabsTrigger value="risks">Risks &amp; Blockers</TabsTrigger>
                    <TabsTrigger value="actions">Action Items</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview">
                    <div className="space-y-10">
                      {/* Portfolio Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Projects</p>
                          <p className="text-2xl font-semibold mt-1">{reportProjects.length}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">On Track</p>
                          <p className="text-2xl font-semibold mt-1 text-emerald-600">{statusCounts["on_track"] || 0}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Behind / At Risk</p>
                          <p className="text-2xl font-semibold mt-1 text-red-600">
                            {(statusCounts["behind"] || 0) + (statusCounts["at_risk"] || 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
                          <p className="text-2xl font-semibold mt-1 text-blue-600">{statusCounts["completed"] || 0}</p>
                        </div>
                      </div>

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

                      {/* Empty state when no highlights or decisions */}
                      {highlights.length === 0 && decisions.length === 0 && (
                        <p className="text-sm text-muted-foreground">No highlights or decisions recorded for this report.</p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Projects Tab */}
                  <TabsContent value="projects">
                    <div className="space-y-6">
                      {reportProjects.length === 0 && (
                        <p className="text-sm text-muted-foreground">No projects included in this report.</p>
                      )}
                      {reportProjects.map((rp: any) => {
                        const statusConfig = PROJECT_STATUS_CONFIG[rp.status as ReportProjectStatus]
                        const satisfactionConfig = SATISFACTION_CONFIG[rp.client_satisfaction as ClientSatisfaction]
                        const teamContributions: any[] = Array.isArray(rp.team_contributions)
                          ? rp.team_contributions
                          : []

                        return (
                          <section key={rp.id} className="rounded-lg border">
                            {/* Project Header */}
                            <div className="flex items-center justify-between p-6 pb-4">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold">{rp.project?.name || "Unknown Project"}</h3>
                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusConfig?.bg, statusConfig?.color)}>
                                  {statusConfig?.label}
                                </span>
                                <StatusChangeIndicator current={rp.status} previous={rp.previous_status} />
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className={satisfactionConfig?.color}>{satisfactionConfig?.label}</span>
                                {rp.previous_satisfaction && rp.previous_satisfaction !== rp.client_satisfaction && (
                                  <StatusChangeIndicator current={rp.client_satisfaction} previous={rp.previous_satisfaction} />
                                )}
                              </div>
                            </div>

                            <div className="px-6 pb-6 space-y-5">
                              {/* Progress */}
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-sm font-medium">Progress: {rp.progress_percent}%</span>
                                  <ProgressDelta current={rp.progress_percent} previous={rp.previous_progress} />
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${rp.progress_percent}%` }}
                                  />
                                </div>
                              </div>

                              {/* Task Stats */}
                              <div className="flex gap-4 text-sm">
                                <span className="text-emerald-600">{rp.tasks_completed} completed</span>
                                <span className="text-blue-600">{rp.tasks_in_progress} in progress</span>
                                {rp.tasks_overdue > 0 && (
                                  <span className="text-red-600">{rp.tasks_overdue} overdue</span>
                                )}
                              </div>

                              {/* Team Contributions */}
                              {teamContributions.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Team</h4>
                                  <div className="space-y-1.5">
                                    {teamContributions.map((tc: any, i: number) => (
                                      <div key={i} className="flex gap-2 text-sm">
                                        <span className="font-medium min-w-[100px]">{tc.member_name || tc.member_id}</span>
                                        <span className="text-muted-foreground">{tc.contribution_text || "\u2014"}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Narrative */}
                              {rp.narrative && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Summary</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                                    {rp.narrative}
                                  </p>
                                </div>
                              )}

                              {/* Financial Notes */}
                              {rp.financial_notes && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Financial Notes</h4>
                                  <p className="text-sm text-muted-foreground">{rp.financial_notes}</p>
                                </div>
                              )}
                            </div>
                          </section>
                        )
                      })}
                    </div>
                  </TabsContent>

                  {/* Risks & Blockers Tab */}
                  <TabsContent value="risks">
                    <div className="space-y-4">
                      {risks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No risks or blockers reported.</p>
                      ) : (
                        <div className="rounded-lg border overflow-hidden">
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
                                    <td className={cn("p-3", riskStatusConfig?.color)}>
                                      {risk.description}
                                    </td>
                                    <td className="p-3 capitalize">{risk.type}</td>
                                    <td className="p-3">
                                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", severityConfig?.color)}>
                                        {severityConfig?.label}
                                      </span>
                                    </td>
                                    <td className={cn("p-3 font-medium", riskStatusConfig?.color)}>
                                      {riskStatusConfig?.label}
                                    </td>
                                    <td className="p-3 text-muted-foreground">{risk.mitigation_notes || "\u2014"}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Action Items Tab */}
                  <TabsContent value="actions">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Tasks created from this report appear on the Tasks page with a &quot;report-action&quot; tag.
                        </p>
                        <Button variant="outline" size="sm" onClick={openActionDialog}>
                          <Plus className="h-3.5 w-3.5" />
                          Add Action Item
                        </Button>
                      </div>

                      {actionItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                          <p className="text-sm text-muted-foreground">No action items yet.</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={openActionDialog}>
                            <Plus className="h-3.5 w-3.5" />
                            Create first action item
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {actionItems.map((item) => {
                            const statusConfig = TASK_STATUS_CONFIG[item.status] || TASK_STATUS_CONFIG.todo
                            const StatusIcon = statusConfig.Icon
                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                              >
                                <StatusIcon className={cn("h-4 w-4 shrink-0", statusConfig.color)} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium truncate", item.status === "done" && "line-through text-muted-foreground")}>
                                    {item.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    {item.project && <span>{item.project.name}</span>}
                                    {item.priority && (
                                      <>
                                        <span className="text-muted-foreground/40">&middot;</span>
                                        <span className="capitalize">{item.priority}</span>
                                      </>
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
                                <Badge variant="outline" className={cn("text-xs shrink-0", statusConfig.color)}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Meta Panel - matches ProjectDetailsPage side panel */}
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

                    {/* Portfolio Status */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Portfolio Status</h3>
                      <div className="space-y-2">
                        {(["on_track", "behind", "at_risk", "halted", "completed"] as ReportProjectStatus[]).map((status) => {
                          const config = PROJECT_STATUS_CONFIG[status]
                          const count = statusCounts[status] || 0
                          if (count === 0 && status !== "on_track") return null
                          return (
                            <div key={status} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", config.bg.split(" ")[0])} />
                                <span>{config.label}</span>
                              </div>
                              <span className="font-semibold">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Quick Stats */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Summary</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <ChartBar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{reportProjects.length} projects</span>
                        </div>
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

        {/* Add Action Item Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Action Item</DialogTitle>
              <DialogDescription>
                Create a task linked to this report. It will appear on the Tasks page with a &quot;report-action&quot; tag.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="action-project">Project *</Label>
                <Select
                  value={actionForm.projectId}
                  onValueChange={(v) => setActionForm(prev => ({ ...prev, projectId: v }))}
                >
                  <SelectTrigger id="action-project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportProjects.map((rp: any) => (
                      <SelectItem key={rp.project?.id} value={rp.project?.id || ""}>
                        {rp.project?.name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action-name">Task Name *</Label>
                <Input
                  id="action-name"
                  placeholder="e.g., Follow up on client feedback"
                  value={actionForm.name}
                  onChange={(e) => setActionForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="action-description">Description</Label>
                <Textarea
                  id="action-description"
                  placeholder="Optional details..."
                  rows={3}
                  value={actionForm.description}
                  onChange={(e) => setActionForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="action-assignee">Assignee</Label>
                  <Select
                    value={actionForm.assigneeId}
                    onValueChange={(v) => setActionForm(prev => ({ ...prev, assigneeId: v }))}
                  >
                    <SelectTrigger id="action-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action-priority">Priority</Label>
                  <Select
                    value={actionForm.priority}
                    onValueChange={(v) => setActionForm(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger id="action-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action-due-date">Due Date</Label>
                <Input
                  id="action-due-date"
                  type="date"
                  value={actionForm.dueDate}
                  onChange={(e) => setActionForm(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddActionItem} disabled={actionLoading}>
                {actionLoading ? "Creating..." : "Create Action Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)
