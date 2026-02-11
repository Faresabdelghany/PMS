"use client"

import { useState, useEffect, useCallback } from "react"
import { MotionDiv, AnimatePresence } from "@/components/ui/motion-lazy"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/project-wizard/Stepper"
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import {
  getReportWizardData,
  getReport,
  createReport,
  updateReport,
} from "@/lib/actions/reports"
import type {
  CreateReportInput,
  ReportWizardProject,
  ReportWizardMember,
} from "@/lib/actions/reports"
import type {
  ReportWizardData,
  RiskEntry,
} from "./report-wizard-types"

import { ReportWizardStep1 } from "./ReportWizardStep1"
import { ReportWizardStep2 } from "./ReportWizardStep2"
import { ReportWizardStep4 } from "./ReportWizardStep4"
import { ReportWizardStep5 } from "./ReportWizardStep5"
import type { ActionItem } from "./ReportWizardStep5"

// ============================================
// Types
// ============================================

interface ReportWizardProps {
  onClose: () => void
  onCreate?: () => void
  organizationId: string
  editingReportId?: string | null
}

type ProjectInfo = ReportWizardProject

type OrgMember = ReportWizardMember

// ============================================
// Helpers
// ============================================

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatWeekRange(startISO: string, endISO: string): string {
  const start = new Date(startISO + "T00:00:00")
  const end = new Date(endISO + "T00:00:00")
  const startMonth = start.toLocaleDateString("en-US", { month: "short" })
  const endMonth = end.toLocaleDateString("en-US", { month: "short" })
  const startDay = start.getDate()
  const endDay = end.getDate()
  const year = end.getFullYear()

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} \u2013 ${endDay}, ${year}`
  }
  return `${startMonth} ${startDay} \u2013 ${endMonth} ${endDay}, ${year}`
}

function createDefaultWizardData(): ReportWizardData {
  const now = new Date()
  const ws = startOfWeek(now)
  const we = endOfWeek(now)
  const periodStart = toISODate(ws)
  const periodEnd = toISODate(we)

  return {
    title: `Weekly Report \u2014 ${formatWeekRange(periodStart, periodEnd)}`,
    periodType: "weekly",
    periodStart,
    periodEnd,
    selectedProjectIds: [],
    projectData: {},
    risks: [],
    highlights: [],
    decisions: [],
  }
}

// ============================================
// Stepper config
// ============================================

const STEPS = [
  "Report scope",
  "Project status",
  "Financials",
  "Risks & blockers",
  "Highlights & review",
]

const STEP_TITLES: Record<number, string> = {
  0: "What period does this report cover?",
  1: "How are projects performing?",
  2: "Financial overview",
  3: "What are the risks and blockers?",
  4: "Highlights, decisions, and review",
}

// ============================================
// Component
// ============================================

export function ReportWizard({
  onClose,
  onCreate,
  organizationId,
  editingReportId,
}: ReportWizardProps) {
  const [step, setStep] = useState(0)
  const [maxStepReached, setMaxStepReached] = useState(0)
  const [data, setData] = useState<ReportWizardData>(createDefaultWizardData)
  const [isPublishing, setIsPublishing] = useState(false)

  // Data loaded on mount
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [projectMembers, setProjectMembers] = useState<Record<string, string[]>>({})
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // --- Data fetching on mount (single server action call) ---

  useEffect(() => {
    let cancelled = false

    async function fetchInitialData() {
      setIsLoading(true)

      try {
        // Single server action: 1 auth check, all DB queries in parallel
        const [wizardResult, editResult] = await Promise.all([
          getReportWizardData(organizationId),
          editingReportId ? getReport(editingReportId) : null,
        ])

        if (cancelled) return

        if (wizardResult.error || !wizardResult.data) {
          toast.error(wizardResult.error ?? "Failed to load report data.")
          return
        }

        const wd = wizardResult.data
        setProjects(wd.projects)
        setOrgMembers(wd.orgMembers)
        setProjectMembers(wd.projectMembers)
        setActionItems(wd.actionItems as ActionItem[])

        // Apply carry-over from previous report
        const prevData = wd.previousReport
        if (prevData.report) {
          setData((prev) => {
            const carriedRisks: RiskEntry[] = (prevData.risks ?? [])
              .filter((r) => r.status === "open" || r.status === "mitigated")
              .map((r) => ({
                id: crypto.randomUUID(),
                projectId: r.project_id,
                type: r.type,
                description: r.description,
                severity: r.severity,
                status: r.status,
                mitigationNotes: r.mitigation_notes ?? "",
                originatedReportId: r.originated_report_id ?? r.report_id,
                isCarriedOver: true,
              }))

            // Pre-fill project statuses from previous report
            const projectData = { ...prev.projectData }
            for (const rp of prevData.projects ?? []) {
              projectData[rp.project_id] = {
                status: rp.status,
                previousStatus: rp.status,
                clientSatisfaction: rp.client_satisfaction,
                previousSatisfaction: rp.client_satisfaction,
                progressPercent: rp.progress_percent,
                previousProgress: rp.progress_percent,
                narrative: "",
                teamContributions: [],
                financialNotes: "",
              }
            }

            // Auto-select projects that were in the previous report
            const prevProjectIds = (prevData.projects ?? []).map(
              (rp: any) => rp.project_id,
            )
            const selectedIds = wd.projects
              .filter((p) => prevProjectIds.includes(p.id))
              .map((p) => p.id)

            return {
              ...prev,
              selectedProjectIds: selectedIds.length > 0 ? selectedIds : prev.selectedProjectIds,
              projectData,
              risks: carriedRisks,
            }
          })
        }

        // If editing, apply existing report data
        if (editResult?.data) {
          const report = editResult.data
          const editProjectData: Record<string, any> = {}
          const selectedIds: string[] = []

          for (const rp of report.report_projects ?? []) {
            selectedIds.push(rp.project_id)
            editProjectData[rp.project_id] = {
              status: rp.status,
              previousStatus: rp.previous_status,
              clientSatisfaction: rp.client_satisfaction,
              previousSatisfaction: rp.previous_satisfaction,
              progressPercent: rp.progress_percent,
              previousProgress: rp.previous_progress,
              narrative: rp.narrative ?? "",
              teamContributions: rp.team_contributions ?? [],
              financialNotes: rp.financial_notes ?? "",
            }
          }

          const editRisks: RiskEntry[] = (report.report_risks ?? []).map(
            (r: any) => ({
              id: crypto.randomUUID(),
              projectId: r.project_id,
              type: r.type,
              description: r.description,
              severity: r.severity,
              status: r.status,
              mitigationNotes: r.mitigation_notes ?? "",
              originatedReportId: r.originated_report_id,
              isCarriedOver: r.originated_report_id !== report.id,
            }),
          )

          const editHighlights = (report.report_highlights ?? [])
            .filter((h: any) => h.type === "highlight")
            .map((h: any) => ({
              id: crypto.randomUUID(),
              projectId: h.project_id,
              description: h.description,
            }))

          const editDecisions = (report.report_highlights ?? [])
            .filter((h: any) => h.type === "decision")
            .map((h: any) => ({
              id: crypto.randomUUID(),
              projectId: h.project_id,
              description: h.description,
            }))

          setData({
            title: report.title,
            periodType: report.period_type,
            periodStart: report.period_start,
            periodEnd: report.period_end,
            selectedProjectIds: selectedIds,
            projectData: editProjectData,
            risks: editRisks,
            highlights: editHighlights,
            decisions: editDecisions,
          })

          // When editing, allow jumping to any step
          setMaxStepReached(STEPS.length - 1)
        }
      } catch (error) {
        toast.error("Failed to load report data. Please try again.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchInitialData()
    return () => {
      cancelled = true
    }
  }, [organizationId, editingReportId])

  // --- Keyboard: Escape to close ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // --- Navigation ---

  const updateData = useCallback((updates: Partial<ReportWizardData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }, [])

  const nextStep = useCallback(() => {
    setStep((prev) => {
      const next = Math.min(prev + 1, STEPS.length - 1)
      setMaxStepReached((m) => Math.max(m, next))
      return next
    })
  }, [])

  const prevStep = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 0))
  }, [])

  const jumpToStep = useCallback((s: number) => {
    setStep(s)
  }, [])

  // --- Publish / Update ---

  const handlePublish = useCallback(async () => {
    // Validation
    if (!data.title.trim()) {
      toast.error("Please provide a report title.")
      return
    }
    if (data.selectedProjectIds.length === 0) {
      toast.error("Please select at least one project.")
      return
    }

    setIsPublishing(true)

    try {
      // Build the input payload
      const input: CreateReportInput = {
        title: data.title,
        period_type: data.periodType,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        projects: data.selectedProjectIds.map((projectId, index) => {
          const pd = data.projectData[projectId]
          return {
            project_id: projectId,
            status: pd?.status ?? "on_track",
            previous_status: pd?.previousStatus ?? null,
            client_satisfaction: pd?.clientSatisfaction ?? "satisfied",
            previous_satisfaction: pd?.previousSatisfaction ?? null,
            progress_percent: pd?.progressPercent ?? 0,
            previous_progress: pd?.previousProgress ?? null,
            narrative: pd?.narrative || null,
            team_contributions: pd?.teamContributions ?? [],
            financial_notes: pd?.financialNotes || null,
            sort_order: index,
          }
        }),
        risks: data.risks.map((r) => ({
          id: r.id,
          project_id: r.projectId,
          type: r.type,
          description: r.description,
          severity: r.severity,
          status: r.status,
          mitigation_notes: r.mitigationNotes || null,
          originated_report_id: r.originatedReportId,
        })),
        highlights: [
          ...data.highlights.map((h, i) => ({
            project_id: h.projectId,
            type: "highlight" as const,
            description: h.description,
            sort_order: i,
          })),
          ...data.decisions.map((d, i) => ({
            project_id: d.projectId,
            type: "decision" as const,
            description: d.description,
            sort_order: data.highlights.length + i,
          })),
        ],
      }

      let result
      if (editingReportId) {
        result = await updateReport(editingReportId, input)
      } else {
        result = await createReport(organizationId, input)
      }

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        editingReportId
          ? "Report updated successfully"
          : "Report published successfully",
      )
      onCreate?.()
      onClose()
    } catch (error) {
      toast.error("Failed to publish report. Please try again.")
    } finally {
      setIsPublishing(false)
    }
  }, [data, editingReportId, organizationId, onCreate, onClose])

  // --- Render ---

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex w-full max-w-[900px] overflow-hidden rounded-[24px] bg-background shadow-2xl"
      >
        {/* Left Sidebar (Stepper) */}
        <div className="hidden w-64 border-r border-border bg-background px-6 py-7 md:flex md:flex-col md:gap-7">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {editingReportId ? "Edit Report" : "New Report"}
            </p>
          </div>
          <Stepper
            currentStep={step}
            steps={STEPS}
            onStepClick={jumpToStep}
            maxStepReached={maxStepReached}
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Header: Title + Close button */}
          <div className="flex items-start justify-between px-8 pt-6 pb-4">
            <div className="pr-6">
              {STEP_TITLES[step] && (
                <h2 className="text-lg font-semibold tracking-tight">
                  {STEP_TITLES[step]}
                </h2>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-8 pb-8 pt-0" style={{ maxHeight: "60vh" }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Loading report data...</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <MotionDiv
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {step === 0 && (
                    <ReportWizardStep1
                      data={data}
                      updateData={updateData}
                      projects={projects}
                    />
                  )}
                  {step === 1 && (
                    <ReportWizardStep2
                      data={data}
                      updateData={updateData}
                      projects={projects}
                      orgMembers={orgMembers}
                      projectMembers={projectMembers}
                    />
                  )}
                  {step === 2 && (
                    <ReportWizardStep3Placeholder
                      data={data}
                      updateData={updateData}
                      projects={projects}
                    />
                  )}
                  {step === 3 && (
                    <ReportWizardStep4
                      data={data}
                      updateData={updateData}
                      projects={projects.map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                      projectData={data.projectData}
                    />
                  )}
                  {step === 4 && (
                    <ReportWizardStep5
                      data={data}
                      updateData={updateData}
                      projects={projects.map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                      actionItems={actionItems}
                      projectData={data.projectData}
                    />
                  )}
                </MotionDiv>
              </AnimatePresence>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between bg-background p-6">
            <div>
              {step > 0 && (
                <Button variant="outline" onClick={prevStep}>
                  <CaretLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              {step === STEPS.length - 1 ? (
                <Button
                  disabled={isPublishing || isLoading}
                  onClick={handlePublish}
                >
                  {isPublishing
                    ? "Publishing..."
                    : editingReportId
                      ? "Update Report"
                      : "Publish Report"}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={isLoading}
                >
                  Next
                  <CaretRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </MotionDiv>
    </div>
  )
}

// ============================================
// Step 3 placeholder (Financials)
// ============================================

function ReportWizardStep3Placeholder({
  data,
  updateData,
  projects,
}: {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: ProjectInfo[]
}) {
  const selectedProjects = projects.filter((p) =>
    data.selectedProjectIds.includes(p.id),
  )

  if (selectedProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-muted py-16">
        <p className="text-sm text-muted-foreground">
          No projects selected. Go back to Step 1 and select at least one project.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selectedProjects.map((project) => {
        const pd = data.projectData[project.id]
        return (
          <div
            key={project.id}
            className="rounded-2xl bg-muted p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{project.name}</span>
              {project.clientName && (
                <span className="text-xs text-muted-foreground">
                  {project.clientName}
                </span>
              )}
            </div>
            <div className="space-y-1.5 rounded-xl bg-background p-4">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Financial Notes
              </label>
              <textarea
                value={pd?.financialNotes ?? ""}
                onChange={(e) => {
                  const current = data.projectData[project.id] ?? {
                    status: "on_track" as const,
                    previousStatus: null,
                    clientSatisfaction: "satisfied" as const,
                    previousSatisfaction: null,
                    progressPercent: 0,
                    previousProgress: null,
                    narrative: "",
                    teamContributions: [],
                    financialNotes: "",
                  }
                  updateData({
                    projectData: {
                      ...data.projectData,
                      [project.id]: {
                        ...current,
                        financialNotes: e.target.value,
                      },
                    },
                  })
                }}
                placeholder="Add financial notes for this project..."
                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-h-[80px] w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
