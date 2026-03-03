"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { Play } from "@phosphor-icons/react/dist/ssr/Play"
import { Pause } from "@phosphor-icons/react/dist/ssr/Pause"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getScheduledRuns,
  createScheduledRun,
  deleteScheduledRun,
  toggleSchedulePause,
  triggerManualRun,
} from "@/lib/actions/scheduled-runs"
import type { ScheduledRunWithAgent } from "@/lib/actions/scheduled-runs"
import { getAgents } from "@/lib/actions/agents"
import type { AgentWithSupervisor } from "@/lib/supabase/types"

// ── Cron presets ─────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday", value: "0 9 * * 1" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Custom", value: "custom" },
] as const

// ── Human-readable cron description ─────────────────────────────────

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Match against known patterns
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute"
  }

  if (minute?.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = minute.slice(2)
    return `Every ${interval} minutes`
  }

  if (minute === "0" && hour?.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = hour.slice(2)
    return interval === "1" ? "Every hour" : `Every ${interval} hours`
  }

  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every hour"
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const dayIndex = parseInt(dayOfWeek, 10)
    const dayName = dayNames[dayIndex] ?? `day ${dayOfWeek}`
    const timeStr = formatTime(hour, minute)
    return `Every ${dayName} at ${timeStr}`
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && hour !== "*" && minute !== undefined) {
    const timeStr = formatTime(hour, minute)
    return `Every day at ${timeStr}`
  }

  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    const timeStr = formatTime(hour, minute)
    return `On day ${dayOfMonth} of every month at ${timeStr}`
  }

  return expr
}

function formatTime(hour: string | undefined, minute: string | undefined): string {
  const h = parseInt(hour ?? "0", 10)
  const m = parseInt(minute ?? "0", 10)
  if (isNaN(h) || isNaN(m)) return `${hour ?? "0"}:${(minute ?? "0").padStart(2, "0")}`
  const period = h >= 12 ? "PM" : "AM"
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`
}

// ── Status badge config ─────────────────────────────────────────────

type LastStatus = "success" | "failed" | "running" | "triggered" | string

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  success: {
    label: "Success",
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-600 border-red-500/25",
  },
  running: {
    label: "Running",
    className: "bg-blue-500/15 text-blue-600 border-blue-500/25",
  },
  triggered: {
    label: "Triggered",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/25",
  },
}

function getStatusConfig(status: LastStatus | null): { label: string; className: string } | null {
  if (!status) return null
  return STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" }
}

// ── Loading skeleton ────────────────────────────────────────────────

function SchedulesTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border">
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Create Schedule Dialog ──────────────────────────────────────────

interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: AgentWithSupervisor[]
  orgId: string
  onCreated: () => void
}

function CreateScheduleDialog({ open, onOpenChange, agents, orgId, onCreated }: CreateDialogProps) {
  const [selectedAgent, setSelectedAgent] = useState("")
  const [taskType, setTaskType] = useState("")
  const [cronPreset, setCronPreset] = useState("")
  const [customCron, setCustomCron] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const cronExpression = cronPreset === "custom" ? customCron : cronPreset
  const cronDescription = cronExpression ? describeCron(cronExpression) : ""

  function resetForm() {
    setSelectedAgent("")
    setTaskType("")
    setCronPreset("")
    setCustomCron("")
    setError(null)
  }

  function handleSubmit() {
    if (!selectedAgent) {
      setError("Please select an agent")
      return
    }
    if (!taskType.trim()) {
      setError("Please enter a task type")
      return
    }
    if (!cronExpression.trim()) {
      setError("Please set a schedule")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await createScheduledRun(orgId, {
        agent_id: selectedAgent,
        task_type: taskType.trim(),
        schedule_expr: cronExpression.trim(),
        metadata: {},
      })

      if (result.error) {
        setError(result.error)
        return
      }

      resetForm()
      onOpenChange(false)
      onCreated()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm()
        onOpenChange(value)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Agent select */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-agent">Agent</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger id="schedule-agent" className="w-full">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} — {agent.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-task-type">Task Type</Label>
            <Input
              id="schedule-task-type"
              placeholder="e.g., daily_report, code_review, sync_data"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
            />
          </div>

          {/* Cron preset */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-cron">Schedule</Label>
            <Select value={cronPreset} onValueChange={setCronPreset}>
              <SelectTrigger id="schedule-cron" className="w-full">
                <SelectValue placeholder="Choose a schedule" />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                    {preset.value !== "custom" && (
                      <span className="ml-2 text-muted-foreground font-mono text-xs">
                        {preset.value}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom cron input */}
          {cronPreset === "custom" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-custom-cron">Cron Expression</Label>
              <Input
                id="schedule-custom-cron"
                placeholder="e.g., */15 * * * *"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Cron preview */}
          {cronDescription && cronDescription !== cronExpression && (
            <p className="text-xs text-muted-foreground px-1">
              Runs: <span className="font-medium text-foreground">{cronDescription}</span>
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive px-1">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Creating..." : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ──────────────────────────────────────────────────

interface SchedulesPageClientProps {
  orgId: string
}

export function SchedulesPageClient({ orgId }: SchedulesPageClientProps) {
  const [schedules, setSchedules] = useState<ScheduledRunWithAgent[]>([])
  const [agents, setAgents] = useState<AgentWithSupervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Fetch schedules and agents ────────────────────────────────────
  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [schedulesResult, agentsResult] = await Promise.all([
        getScheduledRuns(orgId),
        getAgents(orgId),
      ])

      if (schedulesResult.data) {
        setSchedules(schedulesResult.data)
      }
      if (agentsResult.data) {
        setAgents(agentsResult.data)
      }
      setLoading(false)
    })
  }, [orgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Handlers ──────────────────────────────────────────────────────

  function handleTogglePause(runId: string, currentPaused: boolean) {
    startTransition(async () => {
      const result = await toggleSchedulePause(orgId, runId, !currentPaused)
      if (!result.error) {
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === runId ? { ...s, paused: !currentPaused } : s
          )
        )
      }
    })
  }

  function handleTriggerNow(runId: string) {
    startTransition(async () => {
      const result = await triggerManualRun(orgId, runId)
      if (result.data) {
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === runId
              ? { ...s, last_run_at: result.data!.last_run_at, last_status: result.data!.last_status }
              : s
          )
        )
      }
    })
  }

  function handleDelete(runId: string) {
    startTransition(async () => {
      const result = await deleteScheduledRun(orgId, runId)
      if (!result.error) {
        setSchedules((prev) => prev.filter((s) => s.id !== runId))
      }
      setDeleteTarget(null)
    })
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage scheduled and cron agent runs.
        </p>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" weight="bold" />
          New Schedule
        </Button>
      </div>

      {loading ? (
        <SchedulesTableSkeleton />
      ) : schedules.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarBlank className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              No schedules configured yet
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Create a schedule to automatically run agent tasks on a recurring basis.
            </p>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" weight="bold" />
              Create your first schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Schedules table */
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px]">Agent</TableHead>
                <TableHead className="w-[140px]">Task Type</TableHead>
                <TableHead className="w-[220px]">Schedule</TableHead>
                <TableHead className="w-[180px]">Last Run</TableHead>
                <TableHead className="w-[140px]">Next Run</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => {
                const statusConfig = getStatusConfig(schedule.last_status)
                const agentName = schedule.agent?.name ?? "Unknown Agent"
                const agentRole = schedule.agent?.role ?? ""

                return (
                  <TableRow
                    key={schedule.id}
                    className={schedule.paused ? "opacity-50" : ""}
                  >
                    {/* Agent */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {agentName}
                        </span>
                        {agentRole && (
                          <span className="text-xs text-muted-foreground">
                            {agentRole}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Task type */}
                    <TableCell>
                      <span className="text-sm font-mono text-muted-foreground">
                        {schedule.task_type}
                      </span>
                    </TableCell>

                    {/* Schedule (cron) */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-foreground">
                          {describeCron(schedule.schedule_expr)}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {schedule.schedule_expr}
                        </span>
                      </div>
                      {schedule.paused && (
                        <Badge
                          variant="outline"
                          className="mt-1 bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0"
                        >
                          Paused
                        </Badge>
                      )}
                    </TableCell>

                    {/* Last run */}
                    <TableCell>
                      {schedule.last_run_at ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(schedule.last_run_at), {
                              addSuffix: true,
                            })}
                          </span>
                          {statusConfig && (
                            <Badge
                              variant="outline"
                              className={statusConfig.className}
                            >
                              {statusConfig.label}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>

                    {/* Next run */}
                    <TableCell>
                      {schedule.next_run_at && !schedule.paused ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(schedule.next_run_at), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {schedule.paused ? "Paused" : "--"}
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Pause / Resume */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isPending}
                              onClick={() => handleTogglePause(schedule.id, schedule.paused)}
                            >
                              {schedule.paused ? (
                                <Play className="h-4 w-4" weight="fill" />
                              ) : (
                                <Pause className="h-4 w-4" weight="fill" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {schedule.paused ? "Resume" : "Pause"}
                          </TooltipContent>
                        </Tooltip>

                        {/* Trigger Now */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isPending || schedule.paused}
                              onClick={() => handleTriggerNow(schedule.id)}
                            >
                              <Lightning className="h-4 w-4" weight="fill" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Trigger Now</TooltipContent>
                        </Tooltip>

                        {/* Delete */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={isPending}
                              onClick={() => setDeleteTarget(schedule.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <CreateScheduleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        agents={agents}
        orgId={orgId}
        onCreated={fetchData}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scheduled run. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget)
              }}
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
