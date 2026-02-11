"use client"

import { useState, useCallback, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { suggestReportRisks } from "@/lib/actions/report-ai"
import { AIGenerateButton } from "@/components/ai/ai-generate-button"
import { AISetupPrompt } from "@/components/ai/ai-setup-prompt"
import { useAIStatus } from "@/hooks/use-ai-status"
import type { ReportWizardData, RiskEntry } from "./report-wizard-types"
import type { RiskSeverity, RiskStatus } from "@/lib/supabase/types"

interface ReportWizardStep4Props {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: { id: string; name: string }[]
}

// --- Severity config ---

const SEVERITY_OPTIONS: {
  value: RiskSeverity
  label: string
  dotColor: string
  badgeClass: string
}[] = [
  {
    value: "low",
    label: "Low",
    dotColor: "bg-green-500",
    badgeClass:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  },
  {
    value: "medium",
    label: "Medium",
    dotColor: "bg-yellow-500",
    badgeClass:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
  },
  {
    value: "high",
    label: "High",
    dotColor: "bg-orange-500",
    badgeClass:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  },
  {
    value: "critical",
    label: "Critical",
    dotColor: "bg-red-500",
    badgeClass:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  },
]

const STATUS_OPTIONS: { value: RiskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "resolved", label: "Resolved" },
]

type TabValue = "blockers" | "risks"

function getSeverityConfig(severity: RiskSeverity) {
  return SEVERITY_OPTIONS.find((s) => s.value === severity) ?? SEVERITY_OPTIONS[0]
}

export function ReportWizardStep4({
  data,
  updateData,
  projects,
}: ReportWizardStep4Props) {
  const { isConfigured, refetch: refetchAIStatus } = useAIStatus()
  const [activeTab, setActiveTab] = useState<TabValue>("blockers")

  const blockers = useMemo(
    () => data.risks.filter((r) => r.type === "blocker"),
    [data.risks],
  )
  const risks = useMemo(
    () => data.risks.filter((r) => r.type === "risk"),
    [data.risks],
  )

  const currentEntries = activeTab === "blockers" ? blockers : risks

  // --- Risk/Blocker CRUD ---

  const updateRisk = useCallback(
    (riskId: string, updates: Partial<RiskEntry>) => {
      updateData({
        risks: data.risks.map((r) =>
          r.id === riskId ? { ...r, ...updates } : r,
        ),
      })
    },
    [data.risks, updateData],
  )

  const removeRisk = useCallback(
    (riskId: string) => {
      updateData({
        risks: data.risks.filter((r) => r.id !== riskId),
      })
    },
    [data.risks, updateData],
  )

  const addEntry = useCallback(
    (type: "blocker" | "risk") => {
      const newEntry: RiskEntry = {
        id: crypto.randomUUID(),
        type,
        description: "",
        severity: "medium",
        status: "open",
        mitigationNotes: "",
        originatedReportId: null,
        isCarriedOver: false,
      }
      updateData({ risks: [...data.risks, newEntry] })
    },
    [data.risks, updateData],
  )

  const [isAiLoading, setIsAiLoading] = useState(false)
  const [, startTransition] = useTransition()

  const handleAiSuggest = useCallback(() => {
    // Find the selected project
    const selectedProject = projects.find((p) => p.id === data.selectedProjectId)
    if (!selectedProject) {
      toast.error("Please select a project first")
      return
    }

    setIsAiLoading(true)

    const existingRisks = data.risks.map((r) => ({
      description: r.description,
      type: r.type,
      severity: r.severity,
    }))

    startTransition(async () => {
      try {
        const result = await suggestReportRisks({
          project: {
            id: selectedProject.id,
            name: selectedProject.name,
            status: data.status,
            progressPercent: data.progressPercent,
            narrative: data.narrative || undefined,
          },
          existingRisks,
        })

        if (result.error) {
          toast.error(result.error)
        } else if (result.data && result.data.length > 0) {
          const newRisks: RiskEntry[] = result.data.map((suggestion) => ({
            id: crypto.randomUUID(),
            type: suggestion.type,
            description: suggestion.description,
            severity: suggestion.severity,
            status: "open" as const,
            mitigationNotes: "",
            originatedReportId: null,
            isCarriedOver: false,
          }))
          updateData({ risks: [...data.risks, ...newRisks] })
          toast.success(`Added ${newRisks.length} suggested risks`)
        } else {
          toast.info("No additional risks suggested")
        }
      } catch {
        toast.error("Failed to get AI suggestions")
      } finally {
        setIsAiLoading(false)
      }
    })
  }, [projects, data.selectedProjectId, data.risks, data.status, data.progressPercent, data.narrative, updateData])

  return (
    <div className="flex flex-col space-y-6">
      {/* Tab Toggle + AI Suggest — inside muted card */}
      <div className="space-y-4 rounded-2xl bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Identify blockers and risks across your projects.
        </p>

        <div className="flex items-center justify-between">
          {/* Tab pills — matching StepOutcome radio style */}
          <div className="flex gap-2">
            {(["blockers", "risks"] as const).map((tab) => {
              const isActive = activeTab === tab
              const count = tab === "blockers" ? blockers.length : risks.length
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{tab === "blockers" ? "Current Blockers" : "Future Risks"}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold",
                        tab === "blockers"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
                      )}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border-teal-600 bg-teal-600 text-primary-foreground">
                      <Check className="h-3 w-3" weight="regular" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {isConfigured ? (
            <AIGenerateButton
              onClick={handleAiSuggest}
              isLoading={isAiLoading}
              label="AI Suggest"
              loadingLabel="Analyzing..."
              size="sm"
            />
          ) : (
            <AISetupPrompt onSetupComplete={() => {
              refetchAIStatus()
              setTimeout(handleAiSuggest, 100)
            }}>
              <AIGenerateButton
                onClick={() => {}}
                label="AI Suggest"
                size="sm"
              />
            </AISetupPrompt>
          )}
        </div>
      </div>

      {/* Entries list */}
      {currentEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-muted py-10">
          <p className="mb-3 text-sm text-muted-foreground">
            {activeTab === "blockers"
              ? "No blockers added yet."
              : "No risks identified yet."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addEntry(activeTab === "blockers" ? "blocker" : "risk")}
          >
            <Plus className="h-4 w-4" />
            Add {activeTab === "blockers" ? "Blocker" : "Risk"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentEntries.map((entry) => {
            const severityConfig = getSeverityConfig(entry.severity)

            return (
              <div
                key={entry.id}
                className="rounded-2xl bg-muted p-4 space-y-3"
              >
                {/* Top row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("h-2.5 w-2.5 rounded-full shrink-0", severityConfig.dotColor)}
                      title={severityConfig.label}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {activeTab === "blockers" ? "Blocker" : "Risk"}
                    </span>
                    {entry.isCarriedOver && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-xs"
                      >
                        <ArrowsClockwise className="h-3 w-3" />
                        Carried over
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRisk(entry.id)}
                    aria-label="Remove entry"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Description — inside bg-background card */}
                <div className="space-y-1.5 rounded-xl bg-background p-4">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    value={entry.description}
                    onChange={(e) =>
                      updateRisk(entry.id, { description: e.target.value })
                    }
                    placeholder={
                      activeTab === "blockers"
                        ? "Describe what is currently blocked..."
                        : "Describe the potential risk..."
                    }
                    className="min-h-[60px] resize-y bg-background text-sm"
                  />
                </div>

                {/* Severity + Status row (2-col, no project dropdown) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl bg-background p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Severity
                    </Label>
                    <Select
                      value={entry.severity}
                      onValueChange={(val: RiskSeverity) =>
                        updateRisk(entry.id, { severity: val })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  opt.dotColor,
                                )}
                              />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={entry.status}
                      onValueChange={(val: RiskStatus) =>
                        updateRisk(entry.id, { status: val })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Mitigation Notes — inside bg-background card */}
                <div className="space-y-1.5 rounded-xl bg-background p-4">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mitigation Notes
                  </Label>
                  <Textarea
                    value={entry.mitigationNotes}
                    onChange={(e) =>
                      updateRisk(entry.id, { mitigationNotes: e.target.value })
                    }
                    placeholder="What actions are being taken to address this?"
                    className="min-h-[50px] resize-y bg-background text-sm"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add button at bottom */}
      {currentEntries.length > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addEntry(activeTab === "blockers" ? "blocker" : "risk")}
          >
            <Plus className="h-4 w-4" />
            Add {activeTab === "blockers" ? "Blocker" : "Risk"}
          </Button>
        </div>
      )}
    </div>
  )
}
