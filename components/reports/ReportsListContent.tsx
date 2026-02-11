"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { cn } from "@/lib/utils"
import type { ReportListItem } from "@/lib/actions/reports"
import type { ReportProjectStatus } from "@/lib/supabase/types"

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

interface ReportsListContentProps {
  initialReports: ReportListItem[]
  organizationId: string
}

export function ReportsListContent({ initialReports, organizationId }: ReportsListContentProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showWizard, setShowWizard] = useState(false)

  const filtered = initialReports.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <Button onClick={handleCreateReport}>
          <Plus className="h-4 w-4" />
          Create Report
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Reports List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarBlank className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">No reports yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first weekly report to track project progress.
          </p>
          <Button onClick={handleCreateReport}>
            <Plus className="h-4 w-4" />
            Create Report
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="font-medium truncate">{report.title}</h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{formatDateRange(report.period_start, report.period_end)}</span>
                  <span className="text-muted-foreground/40">|</span>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={getOptimizedAvatarUrl(report.author?.avatar_url, 40) || undefined}
                        alt={report.author?.full_name || ""}
                      />
                      <AvatarFallback className="text-[10px]">
                        {report.author?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span>{report.author?.full_name || "Unknown"}</span>
                  </div>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{report.project_count} projects</span>
                </div>
              </div>

              {/* Status summary pills */}
              <div className="flex items-center gap-1.5 ml-4 shrink-0">
                {(Object.entries(report.status_summary) as [ReportProjectStatus, number][])
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <span
                      key={status}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
                        STATUS_COLORS[status]
                      )}
                    >
                      {count} {STATUS_LABELS[status]}
                    </span>
                  ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Wizard Modal */}
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

// Lazy load the wizard to avoid large initial bundle
import dynamic from "next/dynamic"
const LazyReportWizard = dynamic(
  () => import("./ReportWizard").then((m) => ({ default: m.ReportWizard })),
  { ssr: false }
)
