"use client"

import { useState, useCallback, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp"
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { SmileyMeh } from "@phosphor-icons/react/dist/ssr/SmileyMeh"
import { Smiley } from "@phosphor-icons/react/dist/ssr/Smiley"
import { SmileySad } from "@phosphor-icons/react/dist/ssr/SmileySad"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { generateReportNarrative } from "@/lib/actions/report-ai"
import type { ReportWizardData, ProjectReportData } from "./report-wizard-types"
import type { ReportProjectStatus, ClientSatisfaction } from "@/lib/supabase/types"

interface ReportWizardStep2Props {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: { id: string; name: string; clientName?: string }[]
  orgMembers: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }[]
  projectMembers: Record<string, string[]>
}

// --- Status pills config ---

const STATUS_OPTIONS: {
  value: ReportProjectStatus
  label: string
  color: string
  activeColor: string
}[] = [
  {
    value: "on_track",
    label: "On Track",
    color: "border-green-200 text-green-700 dark:border-green-800 dark:text-green-400",
    activeColor:
      "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300",
  },
  {
    value: "behind",
    label: "Behind",
    color: "border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400",
    activeColor:
      "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-300",
  },
  {
    value: "at_risk",
    label: "At Risk",
    color: "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400",
    activeColor:
      "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300",
  },
  {
    value: "halted",
    label: "Halted",
    color: "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400",
    activeColor:
      "bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800/50 dark:border-gray-600 dark:text-gray-300",
  },
  {
    value: "completed",
    label: "Completed",
    color: "border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400",
    activeColor:
      "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300",
  },
]

const SATISFACTION_OPTIONS: {
  value: ClientSatisfaction
  label: string
  icon: typeof Smiley
  color: string
  activeColor: string
}[] = [
  {
    value: "satisfied",
    label: "Satisfied",
    icon: Smiley,
    color: "text-green-600 dark:text-green-400",
    activeColor: "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300",
  },
  {
    value: "neutral",
    label: "Neutral",
    icon: SmileyMeh,
    color: "text-yellow-600 dark:text-yellow-400",
    activeColor: "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-300",
  },
  {
    value: "dissatisfied",
    label: "Dissatisfied",
    icon: SmileySad,
    color: "text-red-600 dark:text-red-400",
    activeColor: "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300",
  },
]

const STATUS_LABELS: Record<ReportProjectStatus, string> = {
  on_track: "On Track",
  behind: "Behind",
  at_risk: "At Risk",
  halted: "Halted",
  completed: "Completed",
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

export function ReportWizardStep2({
  data,
  updateData,
  projects,
  orgMembers,
  projectMembers,
}: ReportWizardStep2Props) {
  const [openCards, setOpenCards] = useState<Record<string, boolean>>(() => {
    // Default: first selected project open, rest closed
    const map: Record<string, boolean> = {}
    data.selectedProjectIds.forEach((id, i) => {
      map[id] = i === 0
    })
    return map
  })

  const toggleCard = useCallback((projectId: string) => {
    setOpenCards((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
  }, [])

  // Ensure projectData exists for all selected projects
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

  // Helper to update a single project's data
  const updateProjectData = useCallback(
    (projectId: string, updates: Partial<ProjectReportData>) => {
      const current = getProjectData(projectId)
      updateData({
        projectData: {
          ...data.projectData,
          [projectId]: { ...current, ...updates },
        },
      })
    },
    [data.projectData, getProjectData, updateData],
  )

  // Resolve member name
  const getMemberName = useCallback(
    (memberId: string): string => {
      const member = orgMembers.find((m) => m.id === memberId)
      if (!member) return "Unknown"
      return member.full_name || member.email
    },
    [orgMembers],
  )

  // Handle contribution text change
  const updateContribution = useCallback(
    (projectId: string, memberId: string, text: string) => {
      const pd = getProjectData(projectId)
      const existing = pd.teamContributions.find((c) => c.member_id === memberId)
      let updated
      if (existing) {
        updated = pd.teamContributions.map((c) =>
          c.member_id === memberId ? { ...c, contribution_text: text } : c,
        )
      } else {
        updated = [...pd.teamContributions, { member_id: memberId, contribution_text: text }]
      }
      updateProjectData(projectId, { teamContributions: updated })
    },
    [getProjectData, updateProjectData],
  )

  const [aiLoadingProject, setAiLoadingProject] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleAiAssist = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId)
      if (!project) return

      const pd = getProjectData(projectId)
      const memberIds = projectMembers[projectId] ?? []
      const contributions = memberIds
        .map((memberId) => ({
          memberName: getMemberName(memberId),
          contribution:
            pd.teamContributions.find((c) => c.member_id === memberId)
              ?.contribution_text ?? "",
        }))

      setAiLoadingProject(projectId)

      startTransition(async () => {
        try {
          const result = await generateReportNarrative({
            projectId,
            projectName: project.name,
            clientName: project.clientName,
            status: pd.status,
            progressPercent: pd.progressPercent,
            previousProgress: pd.previousProgress,
            teamContributions: contributions,
          })

          if (result.error) {
            toast.error(result.error)
          } else if (result.data) {
            updateProjectData(projectId, { narrative: result.data })
            toast.success("Narrative generated")
          }
        } catch {
          toast.error("Failed to generate narrative")
        } finally {
          setAiLoadingProject(null)
        }
      })
    },
    [projects, getProjectData, projectMembers, getMemberName, updateProjectData],
  )

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
    <div className="space-y-4">
      {selectedProjects.map((project) => {
        const pd = getProjectData(project.id)
        const isOpen = openCards[project.id] ?? false
        const memberIds = projectMembers[project.id] ?? []
        const progressDelta =
          pd.previousProgress !== null ? pd.progressPercent - pd.previousProgress : null

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
                {project.clientName && (
                  <span className="text-xs text-muted-foreground">
                    {project.clientName}
                  </span>
                )}
                {/* Status pill preview when collapsed */}
                {!isOpen && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      STATUS_OPTIONS.find((s) => s.value === pd.status)?.activeColor,
                    )}
                  >
                    {STATUS_LABELS[pd.status]}
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
              <div className="space-y-5 border-t border-border px-4 py-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateProjectData(project.id, { status: opt.value })}
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          pd.status === opt.value ? opt.activeColor : cn("bg-transparent", opt.color),
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {pd.previousStatus && pd.status !== pd.previousStatus && (
                    <p className="text-xs text-muted-foreground">
                      was{" "}
                      <span className="font-medium">
                        {STATUS_LABELS[pd.previousStatus]}
                      </span>
                    </p>
                  )}
                </div>

                {/* Client Satisfaction */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Client Satisfaction
                  </Label>
                  <div className="flex gap-2">
                    {SATISFACTION_OPTIONS.map((opt) => {
                      const Icon = opt.icon
                      const isActive = pd.clientSatisfaction === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            updateProjectData(project.id, { clientSatisfaction: opt.value })
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            isActive ? opt.activeColor : "border-border bg-transparent text-muted-foreground",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {pd.previousSatisfaction &&
                    pd.clientSatisfaction !== pd.previousSatisfaction && (
                      <p className="text-xs text-muted-foreground">
                        was{" "}
                        <span className="font-medium capitalize">
                          {pd.previousSatisfaction}
                        </span>
                      </p>
                    )}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Progress
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{pd.progressPercent}%</span>
                      {progressDelta !== null && progressDelta !== 0 && (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            progressDelta > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400",
                          )}
                        >
                          {progressDelta > 0 ? "+" : ""}
                          {progressDelta}% from last
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={pd.progressPercent}
                      onChange={(e) =>
                        updateProjectData(project.id, {
                          progressPercent: Number(e.target.value),
                        })
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    />
                  </div>
                </div>

                {/* Team Members */}
                {memberIds.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Team Contributions
                    </Label>
                    <div className="space-y-2">
                      {memberIds.map((memberId) => {
                        const contribution =
                          pd.teamContributions.find((c) => c.member_id === memberId)
                            ?.contribution_text ?? ""
                        return (
                          <div key={memberId} className="flex items-center gap-3">
                            <span className="w-[140px] shrink-0 truncate text-sm text-foreground">
                              {getMemberName(memberId)}
                            </span>
                            <Input
                              value={contribution}
                              onChange={(e) =>
                                updateContribution(project.id, memberId, e.target.value)
                              }
                              placeholder="Describe contribution..."
                              className="h-8 text-sm"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Narrative */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Narrative
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={aiLoadingProject === project.id}
                      onClick={() => handleAiAssist(project.id)}
                    >
                      <Sparkle className={cn("h-3.5 w-3.5", aiLoadingProject === project.id && "animate-spin")} />
                      {aiLoadingProject === project.id ? "Generating..." : "AI Assist"}
                    </Button>
                  </div>
                  <Textarea
                    value={pd.narrative}
                    onChange={(e) =>
                      updateProjectData(project.id, { narrative: e.target.value })
                    }
                    placeholder="Describe what happened this period..."
                    className="min-h-[80px] resize-y text-sm"
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
