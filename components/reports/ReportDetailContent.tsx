"use client"

import { useState, useCallback, useMemo, useTransition, startTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { TaskQuickCreateModalLazy as TaskQuickCreateModal, type TaskData } from "@/components/tasks/TaskQuickCreateModalLazy"
import { TaskRowBase } from "@/components/tasks/TaskRowBase"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { cn } from "@/lib/utils"
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import { formatDueLabel } from "@/lib/date-utils"
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  type TaskStatus as TaskStatusType,
} from "@/lib/constants/status"
import { usePooledRealtime } from "@/hooks/realtime-context"
import type { Database } from "@/lib/supabase/types"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"

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
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock"
import { Folder } from "@phosphor-icons/react/dist/ssr/Folder"
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut"

import type { ReportProjectStatus, ClientSatisfaction, RiskSeverity, RiskStatus, TaskPriority, Workstream, OrganizationTagLean, ReportWithFullRelations, ReportRisk, ReportHighlight } from "@/lib/supabase/types"

// Lazy-load task detail panel - defers Tiptap/comment editor until a task is opened
const TaskDetailPanel = dynamic(
  () => import("@/components/tasks/TaskDetailPanel").then(m => ({ default: m.TaskDetailPanel })),
  { ssr: false }
)

// Lazy-load delete confirmation dialog
const DeleteTaskDialog = dynamic(
  () => import("@/components/tasks/DeleteTaskDialog").then(m => ({ default: m.DeleteTaskDialog })),
  { ssr: false }
)

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]

// ============================================
// Constants
// ============================================

const PROJECT_STATUS_CONFIG: Record<ReportProjectStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  behind: { label: "Behind", color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  at_risk: { label: "At Risk", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/30" },
  halted: { label: "Halted", color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-900/30" },
  completed: { label: "Completed", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/30" },
}

const SATISFACTION_CONFIG: Record<ClientSatisfaction, { label: string; color: string }> = {
  satisfied: { label: "Satisfied", color: "text-emerald-600 dark:text-emerald-400" },
  neutral: { label: "Neutral", color: "text-yellow-600 dark:text-yellow-400" },
  dissatisfied: { label: "Dissatisfied", color: "text-red-600 dark:text-red-400" },
}

const SEVERITY_CONFIG: Record<RiskSeverity, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  critical: { label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
}

const RISK_STATUS_CONFIG: Record<RiskStatus, { label: string; color: string; decoration?: string }> = {
  open: { label: "Open", color: "text-red-600 dark:text-red-400" },
  mitigated: { label: "Mitigated", color: "text-yellow-600 dark:text-yellow-400" },
  resolved: { label: "Resolved", color: "text-green-600 dark:text-green-400", decoration: "line-through" },
}

const PERIOD_TYPE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  custom: "Custom",
}

// Valid TaskPriority values for type checking
const VALID_PRIORITIES: TaskPriority[] = ["no-priority", "low", "medium", "high", "urgent"]

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
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
        <ArrowUp className="h-3 w-3" /> was {PROJECT_STATUS_CONFIG[previous as ReportProjectStatus]?.label || previous}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400">
      <ArrowDown className="h-3 w-3" /> was {PROJECT_STATUS_CONFIG[previous as ReportProjectStatus]?.label || previous}
    </span>
  )
}

function ProgressDelta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === undefined) return null
  const delta = current - previous
  if (delta === 0) return null
  return (
    <span className={cn("text-xs ml-2", delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
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

// Convert TaskWithRelations to TaskData for the TaskQuickCreateModal
function toTaskData(task: TaskWithRelations, projectId: string, projectName: string): TaskData {
  const priority = task.priority && VALID_PRIORITIES.includes(task.priority as TaskPriority)
    ? (task.priority as TaskPriority)
    : undefined
  const startDate = task.start_date ? new Date(task.start_date) : null
  const endDate = task.end_date ? new Date(task.end_date) : null

  return {
    id: task.id,
    name: task.name,
    status: task.status as "todo" | "in-progress" | "done",
    priority,
    tag: task.tag ?? undefined,
    assignee: task.assignee ? {
      id: task.assignee.id,
      name: task.assignee.full_name || task.assignee.email,
      avatarUrl: task.assignee.avatar_url ?? null,
    } : undefined,
    startDate,
    endDate,
    dueLabel: endDate ? formatDueLabel(endDate) : undefined,
    description: task.description ?? undefined,
    projectId,
    projectName,
    workstreamId: task.workstream?.id ?? undefined,
    workstreamName: task.workstream?.name ?? undefined,
  }
}

interface ReportDetailContentProps {
  report: ReportWithFullRelations
  organizationMembers: OrganizationMember[]
  actionItems: TaskWithRelations[]
  /** When rendered under a project, use project-scoped breadcrumbs */
  projectId?: string
  organizationId: string
  reportId: string
  organizationTags?: { id: string; name: string; color: string }[]
  projectWorkstreams?: { id: string; name: string }[]
}

// ============================================
// Main Component
// ============================================

export function ReportDetailContent({
  report,
  organizationMembers,
  actionItems: initialActionItems,
  projectId,
  organizationId,
  reportId,
  organizationTags = [],
  projectWorkstreams = [],
}: ReportDetailContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showMeta, setShowMeta] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [, startMetaTransition] = useTransition()

  // Derive effective project ID early (needed by realtime handlers below)
  const effectiveProjectId = projectId || report.project?.id

  // --- Action items (tasks) state & management ---
  const [items, setItems] = useState<TaskWithRelations[]>(initialActionItems)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Real-time subscription for action items linked to this report
  usePooledRealtime({
    table: "tasks",
    filter: `source_report_id=eq.${reportId}`,
    enabled: !!reportId,
    onInsert: (task: TaskRow) => {
      setItems(prev => {
        if (prev.some(t => t.id === task.id)) return prev
        return [...prev, {
          ...task,
          assignee: null,
          workstream: null,
          project: effectiveProjectId ? { id: effectiveProjectId, name: report.project?.name || "" } : null,
        } as TaskWithRelations]
      })
    },
    onUpdate: (task: TaskRow) => {
      setItems(prev => prev.map(t => {
        if (t.id !== task.id) return t
        // Merge scalar fields; clear stale relations when FK changes
        return {
          ...t,
          ...task,
          assignee: task.assignee_id !== t.assignee_id ? null : t.assignee,
          workstream: task.workstream_id !== t.workstream_id ? null : t.workstream,
        }
      }))
    },
    onDelete: (task: TaskRow) => {
      setItems(prev => prev.filter(t => t.id !== task.id))
    },
  })

  // Toggle action item status
  const toggleActionItem = useCallback(async (taskId: string) => {
    const task = items.find(t => t.id === taskId)
    if (!task) return
    const newStatus = task.status === "done" ? "todo" : "done"
    // Optimistic update
    setItems(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    const result = await updateTaskStatus(taskId, newStatus as "todo" | "in-progress" | "done")
    if (result.error) {
      setItems(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t))
      toast.error("Failed to update task status")
    }
  }, [items])

  // Open task detail panel via URL
  const openTaskDetail = useCallback((taskId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("task", taskId)
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Edit action item via quick create modal
  const openEditActionItem = useCallback((task: TaskWithRelations) => {
    setEditingTask(task)
    setShowTaskModal(true)
  }, [])

  // Handle task updated from edit modal
  const handleActionItemUpdated = useCallback((updated: TaskData) => {
    setItems(prev =>
      prev.map(t =>
        t.id === updated.id
          ? {
              ...t,
              name: updated.name,
              status: updated.status,
              priority: updated.priority || "no-priority",
              tag: updated.tag || null,
              description: updated.description || null,
              start_date: updated.startDate?.toISOString().split('T')[0] || null,
              end_date: updated.endDate?.toISOString().split('T')[0] || null,
              workstream_id: updated.workstreamId || null,
              workstream: updated.workstreamId ? { id: updated.workstreamId, name: updated.workstreamName || "" } : null,
              assignee_id: updated.assignee?.id || null,
              assignee: updated.assignee ? {
                id: updated.assignee.id,
                full_name: updated.assignee.name,
                email: "",
                avatar_url: updated.assignee.avatarUrl || null,
              } : null,
            }
          : t
      )
    )
    setEditingTask(null)
  }, [])

  // Delete action item
  const handleDeleteActionItem = useCallback(async () => {
    if (!taskToDelete) return
    setIsDeleting(true)
    const result = await deleteTask(taskToDelete)
    if (result.error) {
      toast.error("Failed to delete task")
    } else {
      setItems(prev => prev.filter(t => t.id !== taskToDelete))
      toast.success("Action item deleted")
    }
    setIsDeleting(false)
    setTaskToDelete(null)
  }, [taskToDelete])

  // Count open action items for the sidebar
  const openActionItemsCount = useMemo(() => items.filter(a => a.status !== "done").length, [items])

  // Flat data from report
  const risks = report.report_risks || []
  const highlights = (report.report_highlights || []).filter((h) => h.type === "highlight")
  const decisions = (report.report_highlights || []).filter((h) => h.type === "decision")
  const statusConfig = report.status in PROJECT_STATUS_CONFIG
    ? PROJECT_STATUS_CONFIG[report.status as ReportProjectStatus]
    : (console.warn(`[Report ${report.id}] Unknown status: "${report.status}"`),
       { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted" })
  const satisfactionConfig = report.client_satisfaction in SATISFACTION_CONFIG
    ? SATISFACTION_CONFIG[report.client_satisfaction as ClientSatisfaction]
    : (console.warn(`[Report ${report.id}] Unknown satisfaction: "${report.client_satisfaction}"`),
       { label: "Unknown", color: "text-muted-foreground" })

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

  const handleTaskCreated = useCallback((task: TaskData) => {
    // Add new task to local state optimistically.
    // Do NOT close the modal here — the modal manages its own lifecycle
    // (stays open when "Create more" is toggled on, calls onClose otherwise).
    const newTask: TaskWithRelations = {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority || "no-priority",
      tag: task.tag || null,
      description: task.description || null,
      start_date: task.startDate?.toISOString().split('T')[0] || null,
      end_date: task.endDate?.toISOString().split('T')[0] || null,
      project_id: effectiveProjectId || "",
      workstream_id: task.workstreamId || null,
      assignee_id: task.assignee?.id || null,
      sort_order: 0,
      source_report_id: report.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project: effectiveProjectId ? { id: effectiveProjectId, name: report.project?.name || "" } : null,
      workstream: task.workstreamId ? { id: task.workstreamId, name: task.workstreamName || "" } : null,
      assignee: task.assignee ? {
        id: task.assignee.id,
        full_name: task.assignee.name,
        email: "",
        avatar_url: task.assignee.avatarUrl || null,
      } : null,
    }
    setItems(prev => {
      if (prev.some(t => t.id === newTask.id)) return prev
      return [...prev, newTask]
    })
  }, [effectiveProjectId, report.id, report.project?.name])

  // Financial data
  const financialTotalValue = report.financial_total_value ?? 0
  const financialPaid = report.financial_paid_amount ?? 0
  const financialInvoiced = report.financial_invoiced_amount ?? 0
  const financialUnpaid = report.financial_unpaid_amount ?? 0
  const financialCurrency = report.financial_currency || "USD"
  const hasFinancialData = financialTotalValue > 0 || financialPaid > 0 || financialInvoiced > 0 || financialUnpaid > 0

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
          <Button variant="ghost" size="icon" aria-label="Copy link" onClick={copyLink} className="h-9 w-9">
            <LinkSimple className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={!showMeta}
            aria-label={showMeta ? "Collapse meta panel" : "Expand meta panel"}
            className={cn("h-9 w-9 hidden lg:inline-flex", showMeta && "bg-muted")}
            onClick={() => startMetaTransition(() => setShowMeta((v) => !v))}
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
                "mt-0 grid grid-cols-1 gap-8",
                showMeta && "lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]"
              )}
            >
              {/* Main Content Column - Single Flow Layout */}
              <div className="space-y-8 pt-4 pb-8">
                {/* Report Header */}
                <section className="mt-4 space-y-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-semibold text-foreground leading-tight break-words">{report.title}</h1>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                        {PERIOD_TYPE_LABELS[report.period_type] || report.period_type}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit report"
                      className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
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
                    <div className="flex items-center justify-between gap-4 p-6 pb-4 flex-wrap">
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
                        <span className="text-emerald-600 dark:text-emerald-400">{report.tasks_completed ?? 0} completed</span>
                        <span className="text-blue-600 dark:text-blue-400">{report.tasks_in_progress ?? 0} in progress</span>
                        {(report.tasks_overdue ?? 0) > 0 && (
                          <span className="text-red-600 dark:text-red-400">{report.tasks_overdue} overdue</span>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Financial Summary */}
                {(hasFinancialData || report.financial_notes) && (
                  <section aria-labelledby="report-financials-heading">
                    <h3 id="report-financials-heading" className="text-base font-semibold mb-3">Financial Summary</h3>
                    {hasFinancialData && (
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <dt className="text-xs text-muted-foreground">Total Value</dt>
                          <dd className="text-lg font-semibold mt-1">{formatCurrency(financialTotalValue, financialCurrency)}</dd>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <dt className="text-xs text-emerald-600 dark:text-emerald-400">Collected</dt>
                          <dd className="text-lg font-semibold mt-1 text-emerald-700 dark:text-emerald-400">{formatCurrency(financialPaid, financialCurrency)}</dd>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <dt className="text-xs text-yellow-600 dark:text-yellow-400">Invoiced</dt>
                          <dd className="text-lg font-semibold mt-1 text-yellow-700 dark:text-yellow-400">{formatCurrency(financialInvoiced, financialCurrency)}</dd>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center">
                          <dt className="text-xs text-red-600 dark:text-red-400">Outstanding</dt>
                          <dd className="text-lg font-semibold mt-1 text-red-700 dark:text-red-400">{formatCurrency(financialUnpaid, financialCurrency)}</dd>
                        </div>
                      </dl>
                    )}
                    {report.financial_notes && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line max-w-prose">
                        {report.financial_notes}
                      </p>
                    )}
                  </section>
                )}

                {/* Narrative */}
                {report.narrative && (
                  <section aria-labelledby="report-narrative-heading">
                    <h3 id="report-narrative-heading" className="text-base font-semibold mb-3">Summary</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed max-w-prose">
                      {report.narrative}
                    </p>
                  </section>
                )}

                {/* Highlights */}
                {highlights.length > 0 && (
                  <section aria-labelledby="report-highlights-heading">
                    <h3 id="report-highlights-heading" className="text-base font-semibold mb-3">Highlights</h3>
                    <ul className="space-y-2">
                      {highlights.map((h) => (
                        <li key={h.id} className="flex items-start gap-2 text-sm">
                          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{h.description}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Decisions Needed */}
                {decisions.length > 0 && (
                  <section aria-labelledby="report-decisions-heading">
                    <h3 id="report-decisions-heading" className="text-base font-semibold mb-3">Decisions Needed</h3>
                    <div className="space-y-2">
                      {decisions.map((d) => (
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
                <section aria-labelledby="report-risks-heading">
                  <h3 id="report-risks-heading" className="text-base font-semibold mb-3">Risks &amp; Blockers</h3>
                  {risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No risks or blockers reported.</p>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block rounded-lg border overflow-hidden">
                        <table className="w-full text-sm" aria-label="Risks and blockers">
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
                            {risks.map((risk) => {
                              const severityConfig = SEVERITY_CONFIG[risk.severity]
                              const riskStatusConfig = RISK_STATUS_CONFIG[risk.status]
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

                {/* Action Items — full task list */}
                <section aria-labelledby="report-action-items-heading">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 id="report-action-items-heading" className="text-base font-semibold">Action Items</h3>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </div>
                    {report.project && (
                      <Button variant="outline" size="sm" onClick={() => { setEditingTask(null); setShowTaskModal(true) }}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Action Item
                      </Button>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                      <p className="text-sm text-muted-foreground">No action items yet.</p>
                      {report.project && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditingTask(null); setShowTaskModal(true) }}>
                          <Plus className="h-3.5 w-3.5" />
                          Create first action item
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-workstream)]">
                      <div className="space-y-1 px-2 py-3">
                        {items.map((item) => {
                          const isDone = item.status === "done"
                          const endDate = item.end_date ? new Date(item.end_date) : null
                          const dueLabel = endDate ? formatDueLabel(endDate) : null
                          const startDate = item.start_date ? new Date(item.start_date) : null

                          return (
                            <TaskRowBase
                              key={item.id}
                              checked={isDone}
                              title={item.name}
                              onCheckedChange={() => toggleActionItem(item.id)}
                              onTitleClick={() => openTaskDetail(item.id)}
                              titleAriaLabel={item.name}
                              titleSuffix={
                                item.workstream?.name ? (
                                  <Badge variant="muted" className="whitespace-nowrap text-[11px] hidden sm:inline">
                                    {item.workstream.name}
                                  </Badge>
                                ) : null
                              }
                              meta={
                                <>
                                  <span className={cn("font-medium", TASK_STATUS_COLORS[item.status as TaskStatusType] ?? "text-muted-foreground")}>
                                    {TASK_STATUS_LABELS[item.status as TaskStatusType] ?? "To do"}
                                  </span>
                                  {startDate && (
                                    <span className="text-muted-foreground hidden sm:inline">
                                      Start: {format(startDate, "dd/MM")}
                                    </span>
                                  )}
                                  {dueLabel && (
                                    <span className="text-muted-foreground hidden sm:inline">{dueLabel}</span>
                                  )}
                                  {item.priority && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hidden sm:inline">
                                      {TASK_PRIORITY_LABELS[item.priority as keyof typeof TASK_PRIORITY_LABELS] ?? "No priority"}
                                    </span>
                                  )}
                                  {item.tag && (
                                    <Badge variant="outline" className="whitespace-nowrap text-[11px] hidden sm:inline">
                                      {item.tag}
                                    </Badge>
                                  )}
                                  {item.assignee && (
                                    <Avatar className="size-6">
                                      {item.assignee.avatar_url && (
                                        <AvatarImage
                                          src={getOptimizedAvatarUrl(item.assignee.avatar_url, 24) || undefined}
                                          alt={item.assignee.full_name || ""}
                                        />
                                      )}
                                      <AvatarFallback className="text-[9px]">
                                        {(item.assignee.full_name || item.assignee.email || "?").charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="size-8 rounded-md text-muted-foreground"
                                        aria-label="Task actions"
                                      >
                                        <DotsThreeVertical className="h-4 w-4" weight="bold" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem onClick={() => openEditActionItem(item)}>
                                        <PencilSimple className="h-4 w-4" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setTaskToDelete(item.id)}
                                      >
                                        <Trash className="h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </>
                              }
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Right Meta Panel — hidden on mobile, collapsible on lg+ */}
              {showMeta && (
                <div className="hidden lg:block lg:border-l lg:border-border lg:pl-6 animate-in fade-in duration-150">
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
                          <span>{risks.filter((r) => r.status !== "resolved").length} open risks</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{openActionItemsCount} open action items</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </div>
        </div>

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

        {/* Add / Edit Action Item via TaskQuickCreateModal */}
        <TaskQuickCreateModal
          open={showTaskModal}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }}
          onTaskCreated={handleTaskCreated}
          context={editingTask ? undefined : { projectId: effectiveProjectId }}
          editingTask={editingTask && effectiveProjectId ? toTaskData(editingTask, effectiveProjectId, report.project?.name || "") : undefined}
          onTaskUpdated={handleActionItemUpdated}
          projects={modalProjects}
          organizationMembers={organizationMembers}
          tags={organizationTags}
          defaultTag={editingTask ? undefined : "Action Item"}
          defaultTagLocked={!editingTask}
          sourceReportId={editingTask ? undefined : report.id}
        />

        {/* Delete Action Item Confirmation */}
        {taskToDelete && (
          <DeleteTaskDialog
            open={!!taskToDelete}
            onOpenChange={(open) => !open && setTaskToDelete(null)}
            onConfirm={handleDeleteActionItem}
            isDeleting={isDeleting}
          />
        )}

        {/* Task Detail Panel — opens as slide-over when ?task= is in URL */}
        {searchParams.get("task") && effectiveProjectId && (
          <TaskDetailPanel
            projectId={effectiveProjectId}
            organizationId={organizationId}
            organizationMembers={organizationMembers}
            workstreams={projectWorkstreams.map(w => ({ id: w.id, name: w.name }) as Workstream)}
            tags={organizationTags as OrganizationTagLean[]}
          />
        )}
      </div>
    </div>
  )
}

const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)
