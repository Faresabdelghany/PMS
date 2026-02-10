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
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { X } from "@phosphor-icons/react/dist/ssr/X"
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { suggestReportRisks } from "@/lib/actions/report-ai"
import type { ReportWizardData, RiskEntry } from "./report-wizard-types"
import type { RiskSeverity, RiskStatus } from "@/lib/supabase/types"

interface ReportWizardStep4Props {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: { id: string; name: string }[]
  projectData?: Record<string, { status: string; progressPercent: number; narrative?: string }>
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
  projectData,
}: ReportWizardStep4Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("blockers")

  // Split risks by type
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
        projectId: null,
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
    setIsAiLoading(true)

    const projectsContext = projects
      .filter((p) => data.selectedProjectIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: projectData?.[p.id]?.status ?? "on_track",
        progressPercent: projectData?.[p.id]?.progressPercent ?? 0,
        narrative: projectData?.[p.id]?.narrative,
      }))

    const existingRisks = data.risks.map((r) => ({
      description: r.description,
      type: r.type,
      severity: r.severity,
    }))

    startTransition(async () => {
      try {
        const result = await suggestReportRisks({
          projects: projectsContext,
          existingRisks,
        })

        if (result.error) {
          toast.error(result.error)
        } else if (result.data && result.data.length > 0) {
          const newRisks: RiskEntry[] = result.data.map((suggestion) => {
            const matchedProject = projects.find(
              (p) => p.name === suggestion.projectName,
            )
            return {
              id: crypto.randomUUID(),
              projectId: matchedProject?.id ?? null,
              type: suggestion.type,
              description: suggestion.description,
              severity: suggestion.severity,
              status: "open" as const,
              mitigationNotes: "",
              originatedReportId: null,
              isCarriedOver: false,
            }
          })
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
  }, [projects, data.selectedProjectIds, data.risks, projectData, updateData])

  return (
    <div className="space-y-5">
      {/* Tab Toggle + AI Suggest */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("blockers")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "blockers"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Current Blockers
            {blockers.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1 text-xs font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-300">
                {blockers.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("risks")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "risks"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Future Risks
            {risks.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 px-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                {risks.length}
              </span>
            )}
          </button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={isAiLoading}
          onClick={handleAiSuggest}
        >
          <Sparkle className={cn("h-3.5 w-3.5", isAiLoading && "animate-spin")} />
          {isAiLoading ? "Analyzing..." : "AI Suggest"}
        </Button>
      </div>

      {/* Entries list */}
      {currentEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
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
                className="relative rounded-lg border border-border bg-background p-4 space-y-3"
              >
                {/* Top row: carried over badge + severity dot + remove button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Severity indicator dot */}
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

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
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
                    className="min-h-[60px] resize-y text-sm"
                  />
                </div>

                {/* Severity, Status, Project row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Severity */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
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

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
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

                  {/* Project */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Project
                    </Label>
                    <Select
                      value={entry.projectId ?? "__none__"}
                      onValueChange={(val) =>
                        updateRisk(entry.id, {
                          projectId: val === "__none__" ? null : val,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Mitigation Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Mitigation Notes
                  </Label>
                  <Textarea
                    value={entry.mitigationNotes}
                    onChange={(e) =>
                      updateRisk(entry.id, { mitigationNotes: e.target.value })
                    }
                    placeholder="What actions are being taken to address this?"
                    className="min-h-[50px] resize-y text-sm"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add button at bottom (when entries exist) */}
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
