"use client"

import { useState, useEffect, useCallback } from "react"
import { MotionDiv, AnimatePresence } from "@/components/ui/motion-lazy"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/project-wizard/Stepper"
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { cn } from "@/lib/utils"
import {
  getReportWizardData,
  getReport,
  createReport,
  updateReport,
} from "@/lib/actions/reports"
import type {
  CreateReportInput,
  ReportWizardProject,
} from "@/lib/actions/reports"
import type {
  ReportWizardData,
  RiskEntry,
} from "./report-wizard-types"

import { ReportWizardStep1 } from "./ReportWizardStep1"
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
    selectedProjectId: null,
    status: "on_track",
    previousStatus: null,
    clientSatisfaction: "satisfied",
    previousSatisfaction: null,
    progressPercent: 0,
    previousProgress: null,
    narrative: "",
    financialNotes: "",
    risks: [],
    highlights: [],
    decisions: [],
  }
}

// ============================================
// Stepper config
// ============================================

const STEPS = [
  "Scope & status",
  "Risks & blockers",
  "Highlights & review",
]

const STEP_TITLES: Record<number, string> = {
  0: "Define scope and project status",
  1: "What are the risks and blockers?",
  2: "Highlights, decisions, and review",
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
        setActionItems(wd.actionItems as ActionItem[])

        // Apply carry-over from previous report (flat fields)
        const prevData = wd.previousReport
        if (prevData.report) {
          setData((prev) => {
            const carriedRisks: RiskEntry[] = (prevData.risks ?? [])
              .filter((r) => r.status === "open" || r.status === "mitigated")
              .map((r) => ({
                id: crypto.randomUUID(),
                type: r.type,
                description: r.description,
                severity: r.severity,
                status: r.status,
                mitigationNotes: r.mitigation_notes ?? "",
                originatedReportId: r.originated_report_id ?? r.report_id,
                isCarriedOver: true,
              }))

            const prevReport = prevData.report!

            // Auto-select the same project from previous report
            const prevProjectId = prevReport.project_id
            const projectExists = prevProjectId
              ? wd.projects.some((p) => p.id === prevProjectId)
              : false

            return {
              ...prev,
              selectedProjectId: projectExists ? prevProjectId : prev.selectedProjectId,
              status: (prevReport.status as ReportWizardData["status"]) ?? prev.status,
              previousStatus: (prevReport.status as ReportWizardData["status"]) ?? null,
              clientSatisfaction: (prevReport.client_satisfaction as ReportWizardData["clientSatisfaction"]) ?? prev.clientSatisfaction,
              previousSatisfaction: (prevReport.client_satisfaction as ReportWizardData["clientSatisfaction"]) ?? null,
              progressPercent: prevReport.progress_percent ?? prev.progressPercent,
              previousProgress: prevReport.progress_percent ?? null,
              risks: carriedRisks,
            }
          })
        }

        // If editing, apply existing report data
        if (editResult?.data) {
          const report = editResult.data

          const editRisks: RiskEntry[] = (report.report_risks ?? []).map(
            (r: any) => ({
              id: crypto.randomUUID(),
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
              description: h.description,
            }))

          const editDecisions = (report.report_highlights ?? [])
            .filter((h: any) => h.type === "decision")
            .map((h: any) => ({
              id: crypto.randomUUID(),
              description: h.description,
            }))

          setData({
            title: report.title,
            periodType: report.period_type,
            periodStart: report.period_start,
            periodEnd: report.period_end,
            selectedProjectId: report.project_id ?? null,
            status: report.status ?? "on_track",
            previousStatus: report.previous_status ?? null,
            clientSatisfaction: report.client_satisfaction ?? "satisfied",
            previousSatisfaction: report.previous_satisfaction ?? null,
            progressPercent: report.progress_percent ?? 0,
            previousProgress: report.previous_progress ?? null,
            narrative: report.narrative ?? "",
            financialNotes: report.financial_notes ?? "",
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
    if (!data.selectedProjectId) {
      toast.error("Please select a project.")
      return
    }

    setIsPublishing(true)

    try {
      // Build the flat input payload
      const input: CreateReportInput = {
        title: data.title,
        period_type: data.periodType,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        project_id: data.selectedProjectId,
        status: data.status,
        previous_status: data.previousStatus,
        client_satisfaction: data.clientSatisfaction,
        previous_satisfaction: data.previousSatisfaction,
        progress_percent: data.progressPercent,
        previous_progress: data.previousProgress,
        narrative: data.narrative || null,
        financial_notes: data.financialNotes || null,
        risks: data.risks.map((r) => ({
          type: r.type,
          description: r.description,
          severity: r.severity,
          status: r.status,
          mitigation_notes: r.mitigationNotes || null,
          originated_report_id: r.originatedReportId,
        })),
        highlights: [
          ...data.highlights.map((h, i) => ({
            type: "highlight" as const,
            description: h.description,
            sort_order: i,
          })),
          ...data.decisions.map((d, i) => ({
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

          {/* Mobile Step Indicator */}
          <div className="flex items-center gap-2 px-8 pb-3 md:hidden">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => i <= maxStepReached && jumpToStep(i)}
                  disabled={i > maxStepReached}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    i === step
                      ? "bg-primary"
                      : i <= maxStepReached
                        ? "bg-primary/30"
                        : "bg-muted",
                  )}
                  aria-label={`Go to step ${i + 1}: ${STEPS[i]}`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {step + 1}/{STEPS.length} {STEPS[step]}
            </span>
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
                      projects={projects.map((p) => ({
                        id: p.id,
                        name: p.name,
                        clientName: p.clientName,
                      }))}
                    />
                  )}
                  {step === 1 && (
                    <ReportWizardStep4
                      data={data}
                      updateData={updateData}
                      projects={projects.map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                    />
                  )}
                  {step === 2 && (
                    <ReportWizardStep5
                      data={data}
                      updateData={updateData}
                      projects={projects.map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                      actionItems={actionItems}
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
