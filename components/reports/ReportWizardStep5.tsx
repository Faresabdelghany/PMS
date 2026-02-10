"use client"

import { useState, useCallback, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { suggestReportHighlights } from "@/lib/actions/report-ai"
import type { ReportWizardData, HighlightEntry, DecisionEntry } from "./report-wizard-types"

interface ReportWizardStep5Props {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: { id: string; name: string }[]
  actionItems: ActionItem[]
  projectData?: Record<string, { status: string; progressPercent: number; previousProgress?: number | null; narrative?: string }>
}

// Action item shape from getOpenActionItems
export type ActionItem = {
  id: string
  name: string
  status: string
  priority: string
  end_date: string | null
  created_at: string
  source_report_id: string | null
  weeks_open: number
  assignee: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  project: {
    id: string
    name: string
  } | null
}

// --- Priority config ---

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  urgent:
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

// --- Action item status helpers ---

const STATUS_BUTTON_OPTIONS: {
  value: string
  label: string
}[] = [
  { value: "todo", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
]

function getWeeksOpenBadgeClass(weeksOpen: number): string {
  if (weeksOpen >= 4) {
    return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
  }
  if (weeksOpen >= 2) {
    return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800"
  }
  return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
}

function isOverdue(endDate: string | null): boolean {
  if (!endDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(endDate + "T00:00:00")
  return due < today
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No due date"
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ReportWizardStep5({
  data,
  updateData,
  projects,
  actionItems,
  projectData,
}: ReportWizardStep5Props) {
  // --- Highlights CRUD ---

  const addHighlight = useCallback(() => {
    const newEntry: HighlightEntry = {
      id: crypto.randomUUID(),
      projectId: null,
      description: "",
    }
    updateData({ highlights: [...data.highlights, newEntry] })
  }, [data.highlights, updateData])

  const updateHighlight = useCallback(
    (entryId: string, updates: Partial<HighlightEntry>) => {
      updateData({
        highlights: data.highlights.map((h) =>
          h.id === entryId ? { ...h, ...updates } : h,
        ),
      })
    },
    [data.highlights, updateData],
  )

  const removeHighlight = useCallback(
    (entryId: string) => {
      updateData({
        highlights: data.highlights.filter((h) => h.id !== entryId),
      })
    },
    [data.highlights, updateData],
  )

  // --- Decisions CRUD ---

  const addDecision = useCallback(() => {
    const newEntry: DecisionEntry = {
      id: crypto.randomUUID(),
      projectId: null,
      description: "",
    }
    updateData({ decisions: [...data.decisions, newEntry] })
  }, [data.decisions, updateData])

  const updateDecision = useCallback(
    (entryId: string, updates: Partial<DecisionEntry>) => {
      updateData({
        decisions: data.decisions.map((d) =>
          d.id === entryId ? { ...d, ...updates } : d,
        ),
      })
    },
    [data.decisions, updateData],
  )

  const removeDecision = useCallback(
    (entryId: string) => {
      updateData({
        decisions: data.decisions.filter((d) => d.id !== entryId),
      })
    },
    [data.decisions, updateData],
  )

  // --- AI Suggest ---

  const [isAiLoading, setIsAiLoading] = useState(false)
  const [, startTransition] = useTransition()

  const handleAiSuggestHighlights = useCallback(() => {
    setIsAiLoading(true)

    const projectsContext = projects
      .filter((p) => data.selectedProjectIds.includes(p.id))
      .map((p) => ({
        name: p.name,
        status: projectData?.[p.id]?.status ?? "on_track",
        progressPercent: projectData?.[p.id]?.progressPercent ?? 0,
        previousProgress: projectData?.[p.id]?.previousProgress,
        narrative: projectData?.[p.id]?.narrative,
      }))

    const existingHighlights = data.highlights.map((h) => h.description)

    startTransition(async () => {
      try {
        const result = await suggestReportHighlights({
          projects: projectsContext,
          existingHighlights,
        })

        if (result.error) {
          toast.error(result.error)
        } else if (result.data && result.data.length > 0) {
          const newHighlights: HighlightEntry[] = result.data.map(
            (suggestion) => {
              const matchedProject = projects.find(
                (p) => p.name === suggestion.projectName,
              )
              return {
                id: crypto.randomUUID(),
                projectId: matchedProject?.id ?? null,
                description: suggestion.description,
              }
            },
          )
          updateData({ highlights: [...data.highlights, ...newHighlights] })
          toast.success(`Added ${newHighlights.length} suggested highlights`)
        } else {
          toast.info("No additional highlights suggested")
        }
      } catch {
        toast.error("Failed to get AI suggestions")
      } finally {
        setIsAiLoading(false)
      }
    })
  }, [projects, data.selectedProjectIds, data.highlights, projectData, updateData])

  // --- Action item status change ---
  // Note: This is a local update for the wizard display. The actual task status
  // update should be handled by the parent when the report is published.
  const openActionItems = useMemo(
    () => actionItems.filter((item) => item.status !== "done"),
    [actionItems],
  )

  return (
    <div className="space-y-8">
      {/* ========================= Highlights Section ========================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Highlights</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={isAiLoading}
            onClick={handleAiSuggestHighlights}
          >
            <Sparkle className={cn("h-3.5 w-3.5", isAiLoading && "animate-spin")} />
            {isAiLoading ? "Analyzing..." : "AI Suggest"}
          </Button>
        </div>

        {data.highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-6">
            <p className="mb-2 text-sm text-muted-foreground">
              No highlights added yet.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addHighlight}>
              <Plus className="h-4 w-4" />
              Add Highlight
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.highlights.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-background p-3"
              >
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={entry.description}
                    onChange={(e) =>
                      updateHighlight(entry.id, { description: e.target.value })
                    }
                    placeholder="Describe the highlight..."
                    className="h-8 flex-1 text-sm"
                  />
                  <Select
                    value={entry.projectId ?? "__none__"}
                    onValueChange={(val) =>
                      updateHighlight(entry.id, {
                        projectId: val === "__none__" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-sm sm:w-[180px]">
                      <SelectValue placeholder="Project (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeHighlight(entry.id)}
                  aria-label="Remove highlight"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-center pt-1">
              <Button type="button" variant="outline" size="sm" onClick={addHighlight}>
                <Plus className="h-4 w-4" />
                Add Highlight
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ========================= Decisions Needed Section ========================= */}
      <section className="space-y-3">
        <Label className="text-sm font-semibold">Decisions Needed</Label>

        {data.decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-6">
            <p className="mb-2 text-sm text-muted-foreground">
              No decisions needed at this time.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addDecision}>
              <Plus className="h-4 w-4" />
              Add Decision
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.decisions.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-background p-3"
              >
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={entry.description}
                    onChange={(e) =>
                      updateDecision(entry.id, { description: e.target.value })
                    }
                    placeholder="Describe the decision needed..."
                    className="h-8 flex-1 text-sm"
                  />
                  <Select
                    value={entry.projectId ?? "__none__"}
                    onValueChange={(val) =>
                      updateDecision(entry.id, {
                        projectId: val === "__none__" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-sm sm:w-[180px]">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeDecision(entry.id)}
                  aria-label="Remove decision"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-center pt-1">
              <Button type="button" variant="outline" size="sm" onClick={addDecision}>
                <Plus className="h-4 w-4" />
                Add Decision
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ========================= Action Items Review Section ========================= */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">Open Action Items</Label>
          <Badge
            variant="secondary"
            className="text-xs"
          >
            {openActionItems.length}
          </Badge>
        </div>

        {openActionItems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-green-50 px-4 py-6 dark:bg-green-950/20">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" weight="fill" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                All action items are resolved
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                No open action items from previous reports.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {openActionItems.map((item) => {
              const overdue = isOverdue(item.end_date)
              const assigneeName =
                item.assignee?.full_name || item.assignee?.email || "Unassigned"

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left side: task info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {item.name}
                        </span>
                        {/* Priority badge */}
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.medium,
                          )}
                        >
                          {item.priority}
                        </span>
                        {/* Weeks open badge */}
                        {item.weeks_open > 0 && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                              getWeeksOpenBadgeClass(item.weeks_open),
                            )}
                          >
                            Open for {item.weeks_open}w
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{assigneeName}</span>
                        {item.end_date && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span
                              className={cn(
                                overdue && "font-medium text-red-600 dark:text-red-400",
                              )}
                            >
                              {overdue ? "Overdue: " : "Due: "}
                              {formatDate(item.end_date)}
                            </span>
                          </>
                        )}
                        {item.project && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span>{item.project.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right side: status toggle */}
                    <div className="flex rounded-lg border border-border p-0.5 shrink-0 self-start">
                      {STATUS_BUTTON_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            item.status === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                          )}
                          disabled
                          title="Status changes are read-only in the wizard preview"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
