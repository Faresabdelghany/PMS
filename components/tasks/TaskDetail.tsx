"use client"

import { useState, useTransition } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Robot, Rocket, X, User, Clock, Flag, CheckCircle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { dispatchTaskToAgent, assignAgentToTask } from "@/lib/actions/tasks-sprint3"
import type { OrgTaskWithRelations } from "@/lib/actions/tasks-sprint3"

const statusLabels: Record<string, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "text-red-400" },
  high: { label: "High", color: "text-red-400" },
  medium: { label: "Medium", color: "text-amber-400" },
  low: { label: "Low", color: "text-emerald-400" },
  "no-priority": { label: "No Priority", color: "text-muted-foreground" },
}

const dispatchConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Not dispatched", className: "text-muted-foreground" },
  dispatched: { label: "Dispatched", className: "text-blue-400" },
  running: { label: "Agent working...", className: "text-amber-400" },
  completed: { label: "Completed by agent", className: "text-emerald-400" },
  failed: { label: "Failed", className: "text-red-400" },
}

const squadColors: Record<string, string> = {
  engineering: "bg-blue-500",
  marketing: "bg-purple-500",
  all: "bg-emerald-500",
}

interface TaskDetailProps {
  task: OrgTaskWithRelations | null
  agents: Array<{
    id: string
    name: string
    role: string
    squad: string
    avatar_url: string | null
    status: string
  }>
  orgId: string
  onClose: () => void
  onTaskUpdated?: () => void
}

export function TaskDetail({ task, agents, orgId, onClose, onTaskUpdated }: TaskDetailProps) {
  const [isPending, startTransition] = useTransition()
  const [dispatching, setDispatching] = useState(false)
  const [dispatchSuccess, setDispatchSuccess] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string>(task?.assigned_agent_id ?? "")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!task) return null

  const priority = priorityConfig[task.priority] ?? priorityConfig["no-priority"]
  const dispatch = dispatchConfig[task.dispatch_status ?? "pending"] ?? dispatchConfig.pending

  function handleAgentChange(agentId: string) {
    setSelectedAgentId(agentId)
    setDispatchSuccess(false)
    setErrorMsg(null)
    startTransition(async () => {
      await assignAgentToTask(task!.id, agentId === "none" ? null : agentId)
      onTaskUpdated?.()
    })
  }

  function handleDispatch() {
    if (!selectedAgentId || selectedAgentId === "none") return
    setDispatching(true)
    setErrorMsg(null)
    startTransition(async () => {
      const result = await dispatchTaskToAgent(orgId, task!.id, selectedAgentId)
      setDispatching(false)
      if (result.error) {
        setErrorMsg(result.error)
      } else {
        setDispatchSuccess(true)
        onTaskUpdated?.()
      }
    })
  }

  const canDispatch =
    selectedAgentId &&
    selectedAgentId !== "none" &&
    task.dispatch_status !== "running" &&
    task.dispatch_status !== "dispatched"

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg border-l border-border bg-background p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-base font-semibold leading-snug text-left flex-1">
              {task.name}
            </SheetTitle>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Flag size={13} className={priority.color} />
              <span className={cn("text-xs font-medium", priority.color)}>{priority.label}</span>
            </div>

            <div className="h-3 w-px bg-border" />

            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {statusLabels[task.status] ?? task.status}
              </span>
            </div>

            {task.project && (
              <>
                <div className="h-3 w-px bg-border" />
                <span className="text-xs text-muted-foreground">{task.project.name}</span>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Description
              </h4>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Current Assignee */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Assignee
            </h4>
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-xs font-semibold">
                  {(task.assignee.full_name ?? task.assignee.email).charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-foreground">
                  {task.assignee.full_name ?? task.assignee.email}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User size={14} />
                <span>Unassigned</span>
              </div>
            )}
          </div>

          {/* ── Agent Assignment Section ─── */}
          <div className="rounded-xl border border-border p-4 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <Robot size={16} className="text-purple-400" />
              <h4 className="text-sm font-semibold text-foreground">AI Agent Assignment</h4>
            </div>

            {/* Current dispatch status */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  task.dispatch_status === "running"
                    ? "bg-amber-400 animate-pulse"
                    : task.dispatch_status === "completed"
                    ? "bg-emerald-400"
                    : task.dispatch_status === "failed"
                    ? "bg-red-400"
                    : task.dispatch_status === "dispatched"
                    ? "bg-blue-400"
                    : "bg-muted-foreground/40"
                )}
              />
              <span className={cn("text-xs font-medium", dispatch.className)}>
                {dispatch.label}
              </span>
            </div>

            {/* Agent selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Assign to agent</label>
              <Select value={selectedAgentId || "none"} onValueChange={handleAgentChange}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white",
                            squadColors[agent.squad] ?? "bg-slate-500"
                          )}
                        >
                          {agent.name.charAt(0)}
                        </div>
                        <span>{agent.name}</span>
                        <span className="text-muted-foreground text-xs">— {agent.role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dispatch button */}
            {selectedAgentId && selectedAgentId !== "none" && (
              <Button
                size="sm"
                className={cn(
                  "w-full gap-2 font-medium transition-all",
                  dispatchSuccess
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-purple-600 hover:bg-purple-700"
                )}
                onClick={handleDispatch}
                disabled={!canDispatch || isPending || dispatching}
              >
                {dispatchSuccess ? (
                  <>
                    <CheckCircle size={15} weight="fill" />
                    Dispatched!
                  </>
                ) : isPending || dispatching ? (
                  <>
                    <Robot size={15} className="animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Rocket size={15} />
                    Dispatch to Agent
                  </>
                )}
              </Button>
            )}

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{errorMsg}</p>
            )}
          </div>

          {/* Dates */}
          {(task.start_date || task.end_date) && (
            <div className="grid grid-cols-2 gap-3">
              {task.start_date && (
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Start Date</h4>
                  <p className="text-sm text-foreground">
                    {new Date(task.start_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {task.end_date && (
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Due Date</h4>
                  <p className="text-sm text-foreground">
                    {new Date(task.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
