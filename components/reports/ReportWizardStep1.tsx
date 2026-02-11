"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise"
import { Calendar as CalendarIcon } from "@phosphor-icons/react/dist/ssr/Calendar"
import { Sliders } from "@phosphor-icons/react/dist/ssr/Sliders"
import { Smiley } from "@phosphor-icons/react/dist/ssr/Smiley"
import { SmileyMeh } from "@phosphor-icons/react/dist/ssr/SmileyMeh"
import { SmileySad } from "@phosphor-icons/react/dist/ssr/SmileySad"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { generateReportNarrative } from "@/lib/actions/report-ai"
import { AIGenerateButton } from "@/components/ai/ai-generate-button"
import { AISetupPrompt } from "@/components/ai/ai-setup-prompt"
import { useAIStatus } from "@/hooks/use-ai-status"
import type { ReportWizardData } from "./report-wizard-types"
import type {
  ReportPeriodType,
  ReportProjectStatus,
  ClientSatisfaction,
} from "@/lib/supabase/types"

interface ReportWizardStep1Props {
  data: ReportWizardData
  updateData: (updates: Partial<ReportWizardData>) => void
  projects: { id: string; name: string; clientName?: string }[]
}

// --- Date helpers ---

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

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatWeekRange(startISO: string, endISO: string): string {
  const start = parseISODate(startISO)
  const end = parseISODate(endISO)
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

function generateTitle(periodType: ReportPeriodType, periodStart: string, periodEnd: string): string {
  if (periodType === "weekly") {
    return `Weekly Report \u2014 ${formatWeekRange(periodStart, periodEnd)}`
  }
  if (periodType === "monthly") {
    const date = parseISODate(periodStart)
    const monthName = date.toLocaleDateString("en-US", { month: "long" })
    return `Monthly Report \u2014 ${monthName} ${date.getFullYear()}`
  }
  const start = parseISODate(periodStart)
  const end = parseISODate(periodEnd)
  return `Report \u2014 ${formatShortDate(start)} to ${formatShortDate(end)}`
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const PERIOD_OPTIONS: { value: ReportPeriodType; label: string; icon: React.ReactNode }[] = [
  { value: "weekly", label: "Weekly", icon: <ClockCounterClockwise className="h-4 w-4" /> },
  { value: "monthly", label: "Monthly", icon: <CalendarIcon className="h-4 w-4" /> },
  { value: "custom", label: "Custom", icon: <Sliders className="h-4 w-4" /> },
]

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

const STATUS_LABELS: Record<ReportProjectStatus, string> = {
  on_track: "On Track",
  behind: "Behind",
  at_risk: "At Risk",
  halted: "Halted",
  completed: "Completed",
}

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
    activeColor:
      "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300",
  },
  {
    value: "neutral",
    label: "Neutral",
    icon: SmileyMeh,
    color: "text-yellow-600 dark:text-yellow-400",
    activeColor:
      "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-300",
  },
  {
    value: "dissatisfied",
    label: "Dissatisfied",
    icon: SmileySad,
    color: "text-red-600 dark:text-red-400",
    activeColor:
      "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300",
  },
]

export function ReportWizardStep1({ data, updateData, projects }: ReportWizardStep1Props) {
  const { isConfigured, refetch: refetchAIStatus } = useAIStatus()
  const [narrativeFocused, setNarrativeFocused] = useState(false)
  const narrativeContainerRef = useRef<HTMLDivElement>(null)

  // Handle click outside narrative container to reset focus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        narrativeContainerRef.current &&
        !narrativeContainerRef.current.contains(event.target as Node)
      ) {
        setNarrativeFocused(false)
      }
    }

    if (narrativeFocused) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [narrativeFocused])

  // --- Period type handlers ---

  const setPeriodType = useCallback(
    (type: ReportPeriodType) => {
      const now = new Date()
      let periodStart = data.periodStart
      let periodEnd = data.periodEnd

      if (type === "weekly") {
        const ws = startOfWeek(now)
        const we = endOfWeek(now)
        periodStart = toISODate(ws)
        periodEnd = toISODate(we)
      } else if (type === "monthly") {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        periodStart = toISODate(firstDay)
        periodEnd = toISODate(lastDay)
      }

      const title = generateTitle(type, periodStart, periodEnd)
      updateData({ periodType: type, periodStart, periodEnd, title })
    },
    [data.periodStart, data.periodEnd, updateData],
  )

  // --- Weekly navigation ---

  const shiftWeek = useCallback(
    (direction: -1 | 1) => {
      const current = parseISODate(data.periodStart)
      current.setDate(current.getDate() + direction * 7)
      const ws = startOfWeek(current)
      const we = endOfWeek(current)
      const periodStart = toISODate(ws)
      const periodEnd = toISODate(we)
      const title = generateTitle("weekly", periodStart, periodEnd)
      updateData({ periodStart, periodEnd, title })
    },
    [data.periodStart, updateData],
  )

  // --- Monthly handlers ---

  const currentMonth = useMemo(() => {
    if (!data.periodStart) return new Date().getMonth()
    return parseISODate(data.periodStart).getMonth()
  }, [data.periodStart])

  const currentYear = useMemo(() => {
    if (!data.periodStart) return new Date().getFullYear()
    return parseISODate(data.periodStart).getFullYear()
  }, [data.periodStart])

  const yearOptions = useMemo(() => {
    const thisYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => thisYear - 2 + i)
  }, [])

  const setMonth = useCallback(
    (month: number) => {
      const firstDay = new Date(currentYear, month, 1)
      const lastDay = new Date(currentYear, month + 1, 0)
      const periodStart = toISODate(firstDay)
      const periodEnd = toISODate(lastDay)
      const title = generateTitle("monthly", periodStart, periodEnd)
      updateData({ periodStart, periodEnd, title })
    },
    [currentYear, updateData],
  )

  const setYear = useCallback(
    (year: number) => {
      const firstDay = new Date(year, currentMonth, 1)
      const lastDay = new Date(year, currentMonth + 1, 0)
      const periodStart = toISODate(firstDay)
      const periodEnd = toISODate(lastDay)
      const title = generateTitle("monthly", periodStart, periodEnd)
      updateData({ periodStart, periodEnd, title })
    },
    [currentMonth, updateData],
  )

  // --- Custom date handlers ---

  const setCustomStart = useCallback(
    (value: string) => {
      const title = generateTitle("custom", value, data.periodEnd)
      updateData({ periodStart: value, title })
    },
    [data.periodEnd, updateData],
  )

  const setCustomEnd = useCallback(
    (value: string) => {
      const title = generateTitle("custom", data.periodStart, value)
      updateData({ periodEnd: value, title })
    },
    [data.periodStart, updateData],
  )

  // --- Selected project info ---

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === data.selectedProjectId) ?? null,
    [projects, data.selectedProjectId],
  )

  const progressDelta = useMemo(() => {
    if (data.previousProgress === null || data.previousProgress === undefined) return null
    return data.progressPercent - data.previousProgress
  }, [data.progressPercent, data.previousProgress])

  // --- AI narrative generation ---

  const [isAiLoading, setIsAiLoading] = useState(false)
  const [, startTransition] = useTransition()

  const handleAiAssist = useCallback(() => {
    if (!selectedProject) return
    setIsAiLoading(true)

    startTransition(async () => {
      try {
        const result = await generateReportNarrative({
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          clientName: selectedProject.clientName,
          status: data.status,
          progressPercent: data.progressPercent,
          previousProgress: data.previousProgress,
        })

        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          updateData({ narrative: result.data })
          toast.success("Narrative generated")
        }
      } catch {
        toast.error("Failed to generate narrative")
      } finally {
        setIsAiLoading(false)
      }
    })
  }, [selectedProject, data.status, data.progressPercent, data.previousProgress, updateData])

  return (
    <div className="flex flex-col space-y-8">
      {/* ===================== Period Selection Card ===================== */}
      <div className="space-y-4 rounded-2xl bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Choose the reporting period for this report.
        </p>

        {/* Period type radio pills */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = data.periodType === opt.value

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriodType(opt.value)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-full p-3 text-sm font-medium cursor-pointer transition-colors flex-1",
                  "bg-background text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{opt.icon}</span>
                  <span>{opt.label}</span>
                </div>
                <span
                  className={cn(
                    "ml-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background",
                    isActive && "border-teal-600 bg-teal-600 text-primary-foreground",
                  )}
                >
                  {isActive && <Check className="h-3 w-3" weight="regular" />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Date selector */}
        <div className="rounded-xl bg-background p-3">
          {data.periodType === "weekly" && (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => shiftWeek(-1)}
                aria-label="Previous week"
              >
                <CaretLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 min-w-[200px] justify-center">
                <CalendarBlank className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {data.periodStart && data.periodEnd
                    ? formatWeekRange(data.periodStart, data.periodEnd)
                    : "Select a week"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => shiftWeek(1)}
                aria-label="Next week"
              >
                <CaretRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {data.periodType === "monthly" && (
            <div className="flex items-center justify-center gap-3">
              <Select
                value={String(currentMonth)}
                onValueChange={(val) => setMonth(Number(val))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(currentYear)}
                onValueChange={(val) => setYear(Number(val))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {data.periodType === "custom" && (
            <div className="flex items-center justify-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={data.periodStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <span className="mt-5 text-sm text-muted-foreground">to</span>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={data.periodEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== Title ===================== */}
      <div className="space-y-3">
        <Label className="text-sm">Report Title</Label>
        <Input
          value={data.title}
          onChange={(e) => updateData({ title: e.target.value })}
          placeholder="e.g. Weekly Report — Feb 3-9, 2026"
        />
        <p className="text-xs text-muted-foreground">
          Auto-generated from period. Edit to customize.
        </p>
      </div>

      {/* ===================== Project Selection Card ===================== */}
      <div className="space-y-4 rounded-2xl bg-muted p-4">
        <Label className="text-sm font-medium">Project</Label>

        {projects.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl bg-background py-8">
            <p className="text-sm text-muted-foreground">
              No projects found. Create a project first.
            </p>
          </div>
        ) : (
          <Select
            value={data.selectedProjectId ?? "__none__"}
            onValueChange={(val) =>
              updateData({ selectedProjectId: val === "__none__" ? null : val })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <span>{project.name}</span>
                  {project.clientName && (
                    <span className="ml-2 text-muted-foreground">
                      {project.clientName}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ===================== Project Status Fields ===================== */}
      {selectedProject && (
        <div className="space-y-5 rounded-2xl bg-muted p-4">
          {/* --- Status --- */}
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = data.status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateData({ status: opt.value })}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      isActive ? opt.activeColor : cn("bg-transparent", opt.color),
                    )}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background",
                        isActive && "border-teal-600 bg-teal-600 text-primary-foreground",
                      )}
                    >
                      {isActive && <Check className="h-3 w-3" weight="regular" />}
                    </span>
                  </button>
                )
              })}
            </div>
            {data.previousStatus && data.status !== data.previousStatus && (
              <p className="text-xs text-muted-foreground">
                was{" "}
                <span className="font-medium">
                  {STATUS_LABELS[data.previousStatus]}
                </span>
              </p>
            )}
          </div>

          {/* --- Client Satisfaction --- */}
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client Satisfaction
            </Label>
            <div className="flex flex-wrap gap-2">
              {SATISFACTION_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isActive = data.clientSatisfaction === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateData({ clientSatisfaction: opt.value })}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      isActive ? opt.activeColor : "border-border bg-transparent text-muted-foreground",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", isActive ? "" : opt.color)} />
                    <span>{opt.label}</span>
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background",
                        isActive && "border-teal-600 bg-teal-600 text-primary-foreground",
                      )}
                    >
                      {isActive && <Check className="h-3 w-3" weight="regular" />}
                    </span>
                  </button>
                )
              })}
            </div>
            {data.previousSatisfaction &&
              data.clientSatisfaction !== data.previousSatisfaction && (
                <p className="text-xs text-muted-foreground">
                  was{" "}
                  <span className="font-medium capitalize">
                    {data.previousSatisfaction}
                  </span>
                </p>
              )}
          </div>

          {/* --- Progress Slider --- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Progress
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{data.progressPercent}%</span>
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
                    {progressDelta}% from last period
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-background p-4">
              <Slider
                min={0}
                max={100}
                step={5}
                value={[data.progressPercent]}
                onValueChange={([val]) => updateData({ progressPercent: val })}
                aria-label="Progress"
              />
            </div>
          </div>

          {/* --- Narrative with inline AI Assist --- */}
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Narrative
            </Label>
            <div
              ref={narrativeContainerRef}
              className={cn(
                "relative rounded-xl bg-background transition-all overflow-hidden",
                narrativeFocused && "ring-[3px] ring-ring/50 border-ring",
              )}
            >
              <Textarea
                value={data.narrative}
                onChange={(e) => updateData({ narrative: e.target.value })}
                onFocus={() => setNarrativeFocused(true)}
                placeholder="Summarize project progress..."
                className="min-h-[100px] resize-y border-0 bg-background text-sm shadow-none focus-visible:ring-0 focus-visible:border-transparent"
              />
              {(narrativeFocused || data.narrative) && (
                <div className="px-3 pb-2.5 animate-in fade-in duration-200">
                  <div className="h-px w-full bg-border mb-2.5" />
                  <div className="flex justify-end">
                    {isConfigured ? (
                      <AIGenerateButton
                        onClick={handleAiAssist}
                        isLoading={isAiLoading}
                        label="Write with AI"
                        loadingLabel="Writing..."
                        size="sm"
                      />
                    ) : (
                      <AISetupPrompt onSetupComplete={() => {
                        refetchAIStatus()
                        setTimeout(handleAiAssist, 100)
                      }}>
                        <AIGenerateButton
                          onClick={() => {}}
                          label="Write with AI"
                          size="sm"
                        />
                      </AISetupPrompt>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* --- Financial Notes --- */}
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Financial Notes
            </Label>
            <Textarea
              value={data.financialNotes}
              onChange={(e) => updateData({ financialNotes: e.target.value })}
              placeholder="Add financial notes..."
              className="min-h-[60px] resize-y bg-background text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
