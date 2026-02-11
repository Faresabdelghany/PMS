"use client"

import { useState, useCallback, useMemo, memo } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { FileText } from "@phosphor-icons/react/dist/ssr/FileText"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { cn } from "@/lib/utils"
import type { ReportProjectStatus } from "@/lib/supabase/types"
import type { ProjectReportListItem } from "@/lib/actions/reports"

// Lazy load the wizard to avoid large initial bundle
const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)

type ProjectReportsTabProps = {
  projectId: string
  projectName: string
  organizationId: string
  reports: ProjectReportListItem[]
  organizationMembers: { id: string; name: string; email: string; avatarUrl: string | null }[]
  onRefresh: () => void
}

const STATUS_CONFIG: Record<ReportProjectStatus, { label: string; color: string }> = {
  on_track: { label: "On Track", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  behind: { label: "Behind", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  at_risk: { label: "At Risk", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  halted: { label: "Halted", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const startMonth = s.toLocaleString("en-US", { month: "short" })
  const endMonth = e.toLocaleString("en-US", { month: "short" })
  if (startMonth === endMonth) {
    return `${startMonth} ${s.getDate()} \u2013 ${e.getDate()}, ${s.getFullYear()}`
  }
  return `${startMonth} ${s.getDate()} \u2013 ${endMonth} ${e.getDate()}, ${s.getFullYear()}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const ReportRow = memo(function ReportRow({
  report,
  projectId,
}: {
  report: ProjectReportListItem
  projectId: string
}) {
  const router = useRouter()
  const statusConfig = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.on_track
  const authorName = report.author?.full_name || "Unknown"
  const avatarUrl = getOptimizedAvatarUrl(report.author?.avatar_url, 32) || undefined
  const initials = authorName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => router.push(`/projects/${projectId}/reports/${report.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{report.title}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDateRange(report.period_start, report.period_end)}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={cn("text-xs font-medium", statusConfig.color)}>
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${report.progress_percent ?? 0}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 tabular-nums">
            {report.progress_percent ?? 0}%
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={avatarUrl} alt={authorName} />
            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground truncate max-w-[100px]">
            {authorName}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(report.created_at)}
      </TableCell>
    </TableRow>
  )
})

export function ProjectReportsTab({
  projectId,
  projectName,
  organizationId,
  reports,
  organizationMembers,
  onRefresh,
}: ProjectReportsTabProps) {
  const [search, setSearch] = useState("")
  const [showWizard, setShowWizard] = useState(false)

  const filtered = useMemo(
    () =>
      search
        ? reports.filter((r) =>
            r.title.toLowerCase().includes(search.toLowerCase())
          )
        : reports,
    [reports, search]
  )

  const handleCreateReport = useCallback(() => {
    setShowWizard(true)
  }, [])

  const handleWizardClose = useCallback(() => {
    setShowWizard(false)
  }, [])

  const handleWizardCreate = useCallback(() => {
    setShowWizard(false)
    onRefresh()
  }, [onRefresh])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium">Reports</h3>
          <Badge variant="secondary" className="text-xs">
            {reports.length}
          </Badge>
        </div>
        <Button onClick={handleCreateReport} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>

      {reports.length > 0 && (
        <div className="relative max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
      )}

      {filtered.length === 0 && reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No reports yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first report to track project progress and financials.
          </p>
          <Button onClick={handleCreateReport} className="mt-4" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No reports match &quot;{search}&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[180px]">Period</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[140px]">Progress</TableHead>
                <TableHead className="w-[160px]">Author</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  projectId={projectId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showWizard && (
        <LazyReportWizard
          onClose={handleWizardClose}
          onCreate={handleWizardCreate}
          organizationId={organizationId}
          projectId={projectId}
          projectName={projectName}
        />
      )}
    </div>
  )
}
