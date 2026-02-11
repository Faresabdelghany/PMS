"use client"

import { useCallback, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise"
import { Calendar as CalendarIcon } from "@phosphor-icons/react/dist/ssr/Calendar"
import { Sliders } from "@phosphor-icons/react/dist/ssr/Sliders"
import { cn } from "@/lib/utils"
import type { ReportWizardData } from "./report-wizard-types"
import type { ReportPeriodType } from "@/lib/supabase/types"

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

export function ReportWizardStep1({ data, updateData, projects }: ReportWizardStep1Props) {
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

  // --- Project selection ---

  const allSelected = projects.length > 0 && data.selectedProjectIds.length === projects.length
  const someSelected = data.selectedProjectIds.length > 0 && !allSelected

  const toggleAll = useCallback(() => {
    if (allSelected) {
      updateData({ selectedProjectIds: [] })
    } else {
      updateData({ selectedProjectIds: projects.map((p) => p.id) })
    }
  }, [allSelected, projects, updateData])

  const toggleProject = useCallback(
    (projectId: string) => {
      const current = data.selectedProjectIds
      if (current.includes(projectId)) {
        updateData({ selectedProjectIds: current.filter((id) => id !== projectId) })
      } else {
        updateData({ selectedProjectIds: [...current, projectId] })
      }
    },
    [data.selectedProjectIds, updateData],
  )

  return (
    <div className="flex flex-col space-y-8">
      {/* ===================== Period Selection Card ===================== */}
      <div className="space-y-4 rounded-2xl bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Choose the reporting period for this report.
        </p>

        {/* Period type radio pills — matches StepOutcome success type */}
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

        {/* Date selector — inside muted card */}
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
              <select
                value={currentMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {MONTHS.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={currentYear}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
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
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Projects to Include</Label>
          {projects.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {allSelected ? "Deselect all" : `Select all (${projects.length})`}
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl bg-background py-8">
            <p className="text-sm text-muted-foreground">
              No projects found. Create a project first.
            </p>
          </div>
        ) : (
          <div className="max-h-[280px] space-y-1 overflow-y-auto rounded-xl bg-background">
            {projects.map((project) => {
              const isChecked = data.selectedProjectIds.includes(project.id)
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    isChecked ? "bg-muted/40" : "hover:bg-muted/20",
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleProject(project.id)}
                    tabIndex={-1}
                  />
                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-sm font-medium">{project.name}</span>
                    {project.clientName && (
                      <span className="text-xs text-muted-foreground">
                        {project.clientName}
                      </span>
                    )}
                  </div>
                  {isChecked && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border-teal-600 bg-teal-600 text-primary-foreground">
                      <Check className="h-3 w-3" weight="regular" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {data.selectedProjectIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {data.selectedProjectIds.length} project{data.selectedProjectIds.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </div>
  )
}
