"use client"

import { useState, useCallback, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp"
import { cn } from "@/lib/utils"
import type { ReportWizardData, ProjectReportData } from "./report-wizard-types"

interface Deliverable {
  id: string
  title: string
  value: number | null
  status: string
  payment_status: string
  due_date: string | null
}

interface ReportWizardStep3Props {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: { id: string; name: string; currency?: string }[]
  deliverables: Record<string, Deliverable[]>
}

// --- Status badge styling ---

function getDeliverableStatusStyle(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800"
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
    case "pending":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700"
  }
}

function getPaymentStatusStyle(status: string): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800"
    case "invoiced":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800"
    case "unpaid":
    default:
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
  }
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatCurrency(value: number, currency?: string): string {
  const symbol = currency ?? "USD"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: symbol,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014"
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// --- Default project data factory ---

function createDefaultProjectData(): ProjectReportData {
  return {
    status: "on_track",
    previousStatus: null,
    clientSatisfaction: "satisfied",
    previousSatisfaction: null,
    progressPercent: 0,
    previousProgress: null,
    narrative: "",
    teamContributions: [],
    financialNotes: "",
  }
}

export function ReportWizardStep3({
  data,
  updateData,
  projects,
  deliverables,
}: ReportWizardStep3Props) {
  const [openCards, setOpenCards] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    data.selectedProjectIds.forEach((id, i) => {
      map[id] = i === 0
    })
    return map
  })

  const toggleCard = useCallback((projectId: string) => {
    setOpenCards((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
  }, [])

  const selectedProjects = useMemo(() => {
    return projects.filter((p) => data.selectedProjectIds.includes(p.id))
  }, [projects, data.selectedProjectIds])

  // Helper to get project data with defaults
  const getProjectData = useCallback(
    (projectId: string): ProjectReportData => {
      return data.projectData[projectId] ?? createDefaultProjectData()
    },
    [data.projectData],
  )

  // Update financial notes for a project
  const updateFinancialNotes = useCallback(
    (projectId: string, notes: string) => {
      const current = getProjectData(projectId)
      updateData({
        projectData: {
          ...data.projectData,
          [projectId]: { ...current, financialNotes: notes },
        },
      })
    },
    [data.projectData, getProjectData, updateData],
  )

  // --- Portfolio-level aggregation ---

  const portfolioSummary = useMemo(() => {
    let totalValue = 0
    let totalPaid = 0
    let totalUnpaid = 0

    for (const projectId of data.selectedProjectIds) {
      const projectDeliverables = deliverables[projectId] ?? []
      for (const d of projectDeliverables) {
        const val = d.value ?? 0
        totalValue += val
        if (d.payment_status === "paid") {
          totalPaid += val
        } else {
          totalUnpaid += val
        }
      }
    }

    return { totalValue, totalPaid, totalUnpaid }
  }, [data.selectedProjectIds, deliverables])

  // Find default currency from first project that has one
  const defaultCurrency = useMemo(() => {
    for (const p of selectedProjects) {
      if (p.currency) return p.currency
    }
    return "USD"
  }, [selectedProjects])

  if (selectedProjects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">
          No projects selected. Go back to Step 1 and select at least one project.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Banner */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Portfolio Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-md bg-background p-3 text-center shadow-xs">
            <p className="text-xs text-muted-foreground">Total Contract Value</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {formatCurrency(portfolioSummary.totalValue, defaultCurrency)}
            </p>
          </div>
          <div className="rounded-md bg-background p-3 text-center shadow-xs">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(portfolioSummary.totalPaid, defaultCurrency)}
            </p>
          </div>
          <div className="rounded-md bg-background p-3 text-center shadow-xs">
            <p className="text-xs text-muted-foreground">Total Unpaid</p>
            <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
              {formatCurrency(portfolioSummary.totalUnpaid, defaultCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* Per-project cards */}
      {selectedProjects.map((project) => {
        const isOpen = openCards[project.id] ?? false
        const projectDeliverables = deliverables[project.id] ?? []
        const currency = project.currency ?? defaultCurrency
        const pd = getProjectData(project.id)

        // Per-project totals
        const projectTotalValue = projectDeliverables.reduce(
          (sum, d) => sum + (d.value ?? 0),
          0,
        )
        const projectPaid = projectDeliverables
          .filter((d) => d.payment_status === "paid")
          .reduce((sum, d) => sum + (d.value ?? 0), 0)
        const projectUnpaid = projectTotalValue - projectPaid

        return (
          <div
            key={project.id}
            className="rounded-lg border border-border bg-background"
          >
            {/* Card Header */}
            <button
              type="button"
              onClick={() => toggleCard(project.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{project.name}</span>
                {!isOpen && projectDeliverables.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {projectDeliverables.length} deliverable
                    {projectDeliverables.length !== 1 ? "s" : ""} &middot;{" "}
                    {formatCurrency(projectTotalValue, currency)}
                  </span>
                )}
              </div>
              {isOpen ? (
                <CaretUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <CaretDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Card Body */}
            {isOpen && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                {projectDeliverables.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No deliverables for this project.
                  </p>
                ) : (
                  <>
                    {/* Deliverables Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Title
                            </th>
                            <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Value
                            </th>
                            <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Status
                            </th>
                            <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Payment
                            </th>
                            <th className="pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Due Date
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectDeliverables.map((d) => (
                            <tr
                              key={d.id}
                              className="border-b border-border/50 last:border-0"
                            >
                              <td className="py-2.5 pr-4 font-medium text-foreground">
                                {d.title}
                              </td>
                              <td className="py-2.5 pr-4 text-right tabular-nums text-foreground">
                                {d.value !== null
                                  ? formatCurrency(d.value, currency)
                                  : "\u2014"}
                              </td>
                              <td className="py-2.5 pr-4">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[11px]",
                                    getDeliverableStatusStyle(d.status),
                                  )}
                                >
                                  {formatStatusLabel(d.status)}
                                </Badge>
                              </td>
                              <td className="py-2.5 pr-4">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[11px]",
                                    getPaymentStatusStyle(d.payment_status),
                                  )}
                                >
                                  {formatStatusLabel(d.payment_status)}
                                </Badge>
                              </td>
                              <td className="py-2.5 text-muted-foreground">
                                {formatDate(d.due_date)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Per-project totals */}
                    <div className="flex items-center gap-6 rounded-md bg-muted/40 px-4 py-2.5">
                      <div>
                        <span className="text-xs text-muted-foreground">Total Value</span>
                        <p className="text-sm font-semibold">
                          {formatCurrency(projectTotalValue, currency)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Paid</span>
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(projectPaid, currency)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Unpaid</span>
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(projectUnpaid, currency)}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Financial Notes */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Financial Notes
                  </Label>
                  <Textarea
                    value={pd.financialNotes}
                    onChange={(e) => updateFinancialNotes(project.id, e.target.value)}
                    placeholder="Any financial comments for this project..."
                    className="min-h-[60px] resize-y text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
