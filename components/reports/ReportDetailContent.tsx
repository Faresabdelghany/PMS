"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { ArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp"
import { ArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { cn } from "@/lib/utils"
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

// ============================================
// Helpers
// ============================================

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const startMonth = s.toLocaleString("en-US", { month: "long" })
  const endMonth = e.toLocaleString("en-US", { month: "long" })
  if (startMonth === endMonth) {
    return `${startMonth} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`
  }
  return `${startMonth} ${s.getDate()} – ${endMonth} ${e.getDate()}, ${s.getFullYear()}`
}

function StatusChangeIndicator({ current, previous }: { current: string; previous: string | null }) {
  if (!previous || current === previous) {
    return <span className="text-xs text-muted-foreground">no change</span>
  }

  // Determine if improved or worsened (simplified)
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

function formatCurrency(value: number | null, currency?: string): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ============================================
// Main Component
// ============================================

interface ReportDetailContentProps {
  report: any // ReportWithFullRelations from the server
}

export function ReportDetailContent({ report }: ReportDetailContentProps) {
  const router = useRouter()
  const [showWizard, setShowWizard] = useState(false)

  const reportProjects = report.report_projects || []
  const risks = report.report_risks || []
  const highlights = (report.report_highlights || []).filter((h: any) => h.type === "highlight")
  const decisions = (report.report_highlights || []).filter((h: any) => h.type === "decision")

  // Portfolio summary calculations
  const statusCounts: Record<string, number> = {}
  for (const rp of reportProjects) {
    statusCounts[rp.status] = (statusCounts[rp.status] || 0) + 1
  }

  const handleEdit = useCallback(() => {
    setShowWizard(true)
  }, [])

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{report.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
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
          </div>
          <Button variant="outline" onClick={handleEdit}>
            <PencilSimple className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="px-6 space-y-10 mt-6">
        {/* Portfolio Summary Bar */}
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

        {/* Per-project sections */}
        {reportProjects.map((rp: any) => {
          const statusConfig = PROJECT_STATUS_CONFIG[rp.status as ReportProjectStatus]
          const satisfactionConfig = SATISFACTION_CONFIG[rp.client_satisfaction as ClientSatisfaction]
          const teamContributions: any[] = Array.isArray(rp.team_contributions)
            ? rp.team_contributions
            : []
          const deliverables = rp.project?.deliverables || []

          return (
            <section key={rp.id} className="rounded-lg border">
              {/* Project Header */}
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{rp.project?.name || "Unknown Project"}</h2>
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
                          <span className="text-muted-foreground">{tc.contribution_text || "—"}</span>
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

        {/* Risks & Blockers */}
        {risks.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Risks & Blockers</h2>
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
                        <td className="p-3 text-muted-foreground">{risk.mitigation_notes || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Highlights</h2>
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
            <h2 className="text-lg font-semibold mb-3">Decisions Needed</h2>
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

        {/* Action Items */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Action Items</h2>
            <Button variant="outline" size="sm" onClick={() => {/* TODO: open add action item dialog */}}>
              <Plus className="h-3.5 w-3.5" />
              Add Action Item
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Action items created from this report will appear on the Tasks page with a &quot;report-action&quot; tag.
          </p>
        </section>
      </div>

      {/* Edit Wizard */}
      {showWizard && (
        <LazyReportWizard
          onClose={() => setShowWizard(false)}
          onCreate={() => {
            setShowWizard(false)
            router.refresh()
          }}
          organizationId={report.organization_id}
          editingReportId={report.id}
        />
      )}
    </div>
  )
}

import dynamic from "next/dynamic"
const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)
