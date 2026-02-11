"use client"

import { useState, useCallback, useMemo, memo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Link as LinkIcon } from "@phosphor-icons/react/dist/ssr/Link"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { FileText } from "@phosphor-icons/react/dist/ssr/FileText"
import { cn } from "@/lib/utils"
import type { ReportProjectStatus, ReportPeriodType, ProfileMinimal } from "@/lib/supabase/types"

/** Minimal report shape for the list view — stripped of server-only fields in page.tsx */
type ReportListItemMinimal = {
  id: string
  title: string
  period_type: ReportPeriodType
  period_start: string
  period_end: string
  author: ProfileMinimal
  project_name: string | null
  status: ReportProjectStatus
}

// Lazy load the wizard to avoid large initial bundle
const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)

const STATUS_COLORS: Record<ReportProjectStatus, string> = {
  on_track: "bg-emerald-500",
  behind: "bg-yellow-500",
  at_risk: "bg-red-500",
  halted: "bg-gray-400",
  completed: "bg-blue-500",
}

const STATUS_LABELS: Record<ReportProjectStatus, string> = {
  on_track: "On Track",
  behind: "Behind",
  at_risk: "At Risk",
  halted: "Halted",
  completed: "Completed",
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const startMonth = s.toLocaleString("en-US", { month: "short" })
  const endMonth = e.toLocaleString("en-US", { month: "short" })
  if (startMonth === endMonth) {
    return `${startMonth} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`
  }
  return `${startMonth} ${s.getDate()} – ${endMonth} ${e.getDate()}, ${s.getFullYear()}`
}

// ─── Report Card (matches ProjectCard visual design) ─────────────────────────

const ReportCard = memo(function ReportCard({ report }: { report: ReportListItemMinimal }) {
  const dateRange = formatDateRange(report.period_start, report.period_end)
  const authorName = report.author?.full_name || "Unknown"
  const avatarUrl = getOptimizedAvatarUrl(report.author?.avatar_url, 40) || undefined
  const initials = authorName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Link
      href={`/reports/${report.id}`}
      className="rounded-2xl border border-border bg-background hover:shadow-lg/5 transition-shadow cursor-pointer focus:outline-none block"
    >
      <div className="p-4">
        {/* Top row: icon + status badge */}
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white",
              STATUS_COLORS[report.status] ?? STATUS_COLORS.on_track
            )}
          >
            {STATUS_LABELS[report.status] ?? "On Track"}
          </span>
        </div>

        {/* Title */}
        <div className="mt-3">
          <p className="text-[15px] font-semibold text-foreground leading-6 truncate">
            {report.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground truncate">{dateRange}</p>
        </div>

        {/* Project name */}
        {report.project_name && (
          <p className="mt-2 text-xs text-muted-foreground truncate">
            {report.project_name}
          </p>
        )}

        {/* Divider */}
        <div className="mt-4 border-t border-border/60" />

        {/* Footer: period type + author avatar */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarBlank className="h-4 w-4" />
            <span className="capitalize">{report.period_type}</span>
          </div>
          <Avatar className="size-6 border border-border">
            <AvatarImage src={avatarUrl} alt={authorName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </Link>
  )
})

// ─── Reports Header (matches ProjectHeader) ──────────────────────────────────

function ReportsHeader({
  search,
  onSearchChange,
  onAddReport,
}: {
  search: string
  onSearchChange: (value: string) => void
  onAddReport: () => void
}) {
  return (
    <header className="flex flex-col border-b border-border/40">
      {/* Top bar: title + actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Copy link">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddReport}>
            <Plus className="h-4 w-4" weight="bold" />
            Create Report
          </Button>
        </div>
      </div>

      {/* Filter bar: search */}
      <div className="flex items-center justify-between px-4 pb-3 pt-3">
        <div className="relative max-w-sm w-full">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
      </div>
    </header>
  )
}

// ─── Reports Cards View (matches ProjectCardsView) ───────────────────────────

function ReportsCardsView({
  reports,
  onCreateReport,
}: {
  reports: ReportListItemMinimal[]
  onCreateReport: () => void
}) {
  if (reports.length === 0) {
    return (
      <div className="flex h-60 flex-col items-center justify-center text-center p-4">
        <div className="p-3 bg-muted rounded-md mb-4">
          <FileText className="h-6 w-6 text-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">No reports yet</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Create your first weekly report to track project progress
        </p>
        <button
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent transition-colors cursor-pointer"
          onClick={onCreateReport}
        >
          <Plus className="mr-2 inline h-4 w-4" />
          Create new report
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
        <button
          className="rounded-2xl border border-dashed border-border/60 bg-background p-6 text-center text-sm text-muted-foreground hover:border-solid hover:border-border/80 hover:text-foreground transition-colors min-h-[180px] flex flex-col items-center justify-center cursor-pointer"
          onClick={onCreateReport}
        >
          <Plus className="mb-2 h-5 w-5" />
          Create new report
        </button>
      </div>
    </div>
  )
}

// ─── Main Content (matches ProjectsContent wrapper) ──────────────────────────

interface ReportsListContentProps {
  initialReports: ReportListItemMinimal[]
  organizationId: string
}

export function ReportsListContent({ initialReports, organizationId }: ReportsListContentProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showWizard, setShowWizard] = useState(false)

  const filtered = useMemo(
    () =>
      search
        ? initialReports.filter((r) =>
            r.title.toLowerCase().includes(search.toLowerCase())
          )
        : initialReports,
    [initialReports, search]
  )

  const handleCreateReport = useCallback(() => {
    setShowWizard(true)
  }, [])

  const handleWizardClose = useCallback(() => {
    setShowWizard(false)
  }, [])

  const handleWizardCreate = useCallback(() => {
    setShowWizard(false)
    router.refresh()
  }, [router])

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <ReportsHeader
        search={search}
        onSearchChange={setSearch}
        onAddReport={handleCreateReport}
      />
      <ReportsCardsView reports={filtered} onCreateReport={handleCreateReport} />

      {showWizard && (
        <LazyReportWizard
          onClose={handleWizardClose}
          onCreate={handleWizardCreate}
          organizationId={organizationId}
        />
      )}
    </div>
  )
}
