"use client"

import { useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
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
  // Monday = 1, so shift back by (day === 0 ? 6 : day - 1)
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
  // custom
  const start = parseISODate(periodStart)
  const end = parseISODate(periodEnd)
  return `Report \u2014 ${formatShortDate(start)} to ${formatShortDate(end)}`
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const PERIOD_OPTIONS: { value: ReportPeriodType; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
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
    <div className="space-y-6">
      {/* Period Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Report Period</Label>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={data.periodType === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Period Selector */}
      <div className="space-y-2">
        {data.periodType === "weekly" && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => shiftWeek(-1)}
              aria-label="Previous week"
            >
              <CaretLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[200px] text-center text-sm font-medium">
              {data.periodStart && data.periodEnd
                ? formatWeekRange(data.periodStart, data.periodEnd)
                : "Select a week"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => shiftWeek(1)}
              aria-label="Next week"
            >
              <CaretRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {data.periodType === "monthly" && (
          <div className="flex items-center gap-3">
            <select
              value={currentMonth}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
          <div className="flex items-center gap-3">
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

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="report-title" className="text-sm font-medium">
          Report Title
        </Label>
        <Input
          id="report-title"
          value={data.title}
          onChange={(e) => updateData({ title: e.target.value })}
          placeholder="e.g. Weekly Report — Feb 3-9, 2026"
        />
        <p className="text-xs text-muted-foreground">
          Auto-generated from period. Edit to customize.
        </p>
      </div>

      {/* Project Selector */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Projects to Include</Label>

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects found. Create a project first.
          </p>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Checkbox
                id="select-all-projects"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
              />
              <label
                htmlFor="select-all-projects"
                className="cursor-pointer text-sm font-medium"
              >
                Select All ({projects.length})
              </label>
            </div>

            {/* Project list */}
            <div className="max-h-[280px] space-y-1 overflow-y-auto">
              {projects.map((project) => {
                const isChecked = data.selectedProjectIds.includes(project.id)
                return (
                  <div
                    key={project.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      isChecked ? "bg-muted/60" : "hover:bg-muted/40",
                    )}
                  >
                    <Checkbox
                      id={`project-${project.id}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleProject(project.id)}
                    />
                    <label
                      htmlFor={`project-${project.id}`}
                      className="flex flex-1 cursor-pointer items-center gap-2"
                    >
                      <span className="text-sm font-medium">{project.name}</span>
                      {project.clientName && (
                        <span className="text-xs text-muted-foreground">
                          {project.clientName}
                        </span>
                      )}
                    </label>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
