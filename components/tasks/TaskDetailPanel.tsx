"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TaskDetailHeader } from "./TaskDetailHeader"
import { TaskDetailFields } from "./TaskDetailFields"
import { TaskDetailDescription } from "./TaskDetailDescription"
import { TaskTimeline } from "./TaskTimeline"
import { TaskCommentEditor } from "./TaskCommentEditor"
import { TaskMessagesPanel } from "./TaskMessagesPanel"
import { Skeleton } from "@/components/ui/skeleton"
import { getTask, getSubtasks, createTask, updateTask, type TaskWithRelations } from "@/lib/actions/tasks"
import { assignAgentToTask } from "@/lib/actions/tasks-sprint3"
import { getTaskTimeline } from "@/lib/actions/task-activities"
import { createTaskComment } from "@/lib/actions/task-comments"
import { getTaskDoDWarnings, overrideDoDBlocker, type TaskDoDWarning } from "@/lib/actions/dod-policies"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type {
  TaskTimelineItem,
  TaskCommentWithRelations,
  TaskCommentReaction,
  Workstream,
  OrganizationTagLean,
} from "@/lib/supabase/types"
import { toast } from "sonner"
import { useTaskTimelineRealtime } from "@/hooks/use-task-timeline-realtime"

export type TaskPanelMember = {
  user_id: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

function addReactionToItem(
  item: TaskTimelineItem,
  commentId: string,
  reaction: TaskCommentReaction
): TaskTimelineItem {
  if (item.type !== "comment" || item.data.id !== commentId) return item
  const comment = item.data as TaskCommentWithRelations
  const existing = comment.reactions ?? []
  if (existing.some((r) => r.id === reaction.id)) return item
  return { type: "comment" as const, data: { ...comment, reactions: [...existing, reaction] } }
}

function removeReactionFromItem(
  item: TaskTimelineItem,
  commentId: string,
  reactionId: string
): TaskTimelineItem {
  if (item.type !== "comment" || item.data.id !== commentId) return item
  const comment = item.data as TaskCommentWithRelations
  const filtered = (comment.reactions ?? []).filter((r) => r.id !== reactionId)
  return { type: "comment" as const, data: { ...comment, reactions: filtered } }
}

interface AgentOption {
  id: string
  name: string
  role: string
  squad: string
  avatar_url: string | null
  is_active?: boolean
}

interface TaskDetailPanelProps {
  projectId: string
  organizationId: string
  organizationMembers?: TaskPanelMember[]
  workstreams?: Workstream[]
  tags?: OrganizationTagLean[]
  agents?: AgentOption[]
}

export function TaskDetailPanel({
  projectId,
  organizationId,
  organizationMembers = [],
  workstreams = [],
  tags = [],
  agents = [],
}: TaskDetailPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskId = searchParams.get("task")

  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [timeline, setTimeline] = useState<TaskTimelineItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subtasks, setSubtasks] = useState<TaskWithRelations[]>([])
  const [newSubtaskName, setNewSubtaskName] = useState("")
  const [dodWarnings, setDodWarnings] = useState<TaskDoDWarning[]>([])
  const [dodBlockers, setDodBlockers] = useState<{ checkName: string; message: string }[]>([])
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState("")

  const isOpen = !!taskId

  // Fetch task data when taskId changes
  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setTimeline([])
      setDodWarnings([])
      setDodBlockers([])
      return
    }

    const currentTaskId = taskId

    async function fetchTaskData() {
      setIsLoading(true)
      try {
        const [taskResult, timelineResult, subtasksResult] = await Promise.all([
          getTask(currentTaskId),
          getTaskTimeline(currentTaskId),
          getSubtasks(currentTaskId),
        ])

        if (taskResult.error) {
          toast.error(taskResult.error)
          return
        }

        if (taskResult.data) {
          setTask(taskResult.data)
        }

        if (timelineResult.data) {
          setTimeline(timelineResult.data)
        }

        if (subtasksResult.data) {
          setSubtasks(subtasksResult.data)
        }

        const warningResult = await getTaskDoDWarnings(currentTaskId)
        if (warningResult.data) {
          setDodWarnings(warningResult.data)
        }
      } catch {
        toast.error("Failed to load task details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTaskData()
  }, [taskId])

  // Derive comment IDs from timeline so the reaction subscription
  // only listens to reactions on this task's comments
  const commentIds = useMemo(
    () => timeline.filter((item) => item.type === "comment").map((item) => item.data.id),
    [timeline]
  )

  // Real-time updates for timeline
  useTaskTimelineRealtime(taskId, commentIds, {
    onCommentInsert: (comment) => {
      setTimeline((prev) => {
        if (prev.some((item) => item.type === "comment" && item.data.id === comment.id)) {
          return prev
        }
        return [...prev, { type: "comment", data: comment }]
      })
    },
    onCommentUpdate: (comment) => {
      setTimeline((prev) =>
        prev.map((item) =>
          item.type === "comment" && item.data.id === comment.id
            ? { type: "comment", data: comment }
            : item
        )
      )
    },
    onCommentDelete: (commentId) => {
      setTimeline((prev) =>
        prev.filter(
          (item) => !(item.type === "comment" && item.data.id === commentId)
        )
      )
    },
    onActivityInsert: (activity) => {
      setTimeline((prev) => {
        if (prev.some((item) => item.type === "activity" && item.data.id === activity.id)) {
          return prev
        }
        return [...prev, { type: "activity", data: activity }]
      })
    },
    onAgentEventInsert: (agentEvent) => {
      setTimeline((prev) => {
        if (prev.some((item) => item.type === "agent_event" && item.data.id === agentEvent.id)) {
          return prev
        }
        return [...prev, { type: "agent_event", data: agentEvent }]
      })
    },
    onReactionInsert: (commentId, reaction) => {
      setTimeline((prev) => prev.map((item) => addReactionToItem(item, commentId, reaction)))
    },
    onReactionDelete: (commentId, reactionId) => {
      setTimeline((prev) => prev.map((item) => removeReactionFromItem(item, commentId, reactionId)))
    },
  })

  // Close panel handler
  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("task")
    const newPath = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    router.push(newPath, { scroll: false })
  }, [router, searchParams])

  // Escape key is handled by the Sheet (Radix Dialog) component's built-in
  // onOpenChange callback — no need for a manual window keydown listener.

  // Update task field handler
  const handleUpdateTask = useCallback(
    async (field: string, value: unknown) => {
      if (!taskId || !task) return

      if (field === "assigned_agent_id") {
        const result = await assignAgentToTask(taskId, (value as string | null) ?? null)
        if (result.error) {
          toast.error(result.error)
          return
        }

        setTask((prev) => {
          if (!prev) return prev
          const selectedAgent = agents.find((a) => a.id === value)
          return {
            ...prev,
            assigned_agent_id: (value as string | null) ?? null,
            assignee_id: null,
            task_type: value ? "agent" : "user",
            dispatch_status: "pending",
            assignee: value ? null : prev.assignee,
            assigned_agent: value
              ? { id: selectedAgent?.id ?? String(value), name: selectedAgent?.name ?? "Agent", avatar_url: selectedAgent?.avatar_url ?? null }
              : null,
          }
        })
        toast.success("Task updated")
        return
      }

      const result = await updateTask(taskId, { [field]: value })
      if (result.error) {
        // If blocked by DoD, parse and show blockers
        if (field === "status" && value === "done" && result.error.startsWith("Blocked by DoD policy:")) {
          const blockerText = result.error.replace("Blocked by DoD policy: ", "")
          const blockerList = blockerText.split("; ").map((msg) => {
            const checkName = msg.includes("required fields") ? "required_fields"
              : msg.includes("approval") ? "reviewer_approved"
              : msg.includes("Tests") ? "tests_passing"
              : msg.includes("PR") ? "pr_merged"
              : msg.includes("Documentation") ? "documentation_updated"
              : "unknown"
            return { checkName, message: msg }
          })
          setDodBlockers(blockerList)
          toast.error("Cannot mark as done — DoD blockers found")
          return
        }
        toast.error(result.error)
        return
      }

      if (result.data) {
        setTask((prev) => (prev ? { ...prev, ...result.data } : prev))
        setDodBlockers([])
        if (field === "status" && value === "done") {
          const warningResult = await getTaskDoDWarnings(taskId)
          if (warningResult.data) {
            setDodWarnings(warningResult.data)
          }
        }
        toast.success("Task updated")
      }
    },
    [taskId, task, agents]
  )

  // Handle comment submission
  const handleSubmitComment = useCallback(
    async (content: string, attachments?: string[]) => {
      if (!taskId) return

      setIsSubmitting(true)
      try {
        const result = await createTaskComment(taskId, content, attachments)
        if (result.error) {
          toast.error(result.error)
          return
        }

        const newComment = result.data
        if (newComment) {
          setTimeline((prev) => {
            if (prev.some((item) => item.type === "comment" && item.data.id === newComment.id)) {
              return prev
            }
            return [...prev, { type: "comment" as const, data: newComment }]
          })
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [taskId]
  )

  const handleOverrideBlocker = useCallback(async () => {
    if (!taskId || !overrideTarget || !overrideReason.trim()) return
    const result = await overrideDoDBlocker(taskId, overrideTarget, overrideReason.trim())
    if (result.error) {
      toast.error(result.error)
      return
    }
    setDodBlockers((prev) => prev.filter((b) => b.checkName !== overrideTarget))
    setOverrideTarget(null)
    setOverrideReason("")
    toast.success("Blocker overridden")
  }, [taskId, overrideTarget, overrideReason])

  const handleCreateSubtask = useCallback(async () => {
    if (!task || !newSubtaskName.trim()) return
    const result = await createTask(task.project_id, {
      name: newSubtaskName.trim(),
      parent_task_id: task.id,
      source: "manual",
      status: "todo",
      priority: "medium",
    })

    if (result.error) {
      toast.error(result.error)
      return
    }

    setNewSubtaskName("")
    const subtasksResult = await getSubtasks(task.id)
    if (subtasksResult.data) setSubtasks(subtasksResult.data)
  }, [task, newSubtaskName])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[600px] lg:w-[700px] sm:max-w-none p-0 flex flex-col sm:rounded-l-[32px] overflow-hidden"
        aria-describedby={undefined}
      >
        {/* Always render SheetTitle for accessibility */}
        <SheetTitle className="sr-only">
          {task?.name || "Task Details"}
        </SheetTitle>
        {isLoading && <TaskDetailPanelSkeleton />}
        {!isLoading && !task && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Task not found
          </div>
        )}
        {!isLoading && task && (
          <>
            <div className="px-5 pt-4 pb-3 space-y-2 flex-shrink-0">
              <TaskDetailHeader
                task={task}
                onNameChange={(name) => handleUpdateTask("name", name)}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-0 sm:pt-4 space-y-8">
              {/* Task Fields */}
              <TaskDetailFields
                task={task}
                onUpdate={handleUpdateTask}
                organizationMembers={organizationMembers}
                workstreams={workstreams}
                tags={tags}
                agents={agents.map((a) => ({
                  id: a.id,
                  name: a.name,
                  role: a.role,
                  squad: a.squad,
                  avatar_url: a.avatar_url,
                  is_active: a.is_active ?? true,
                }))}
              />

              {/* Description */}
              <TaskDetailDescription
                description={task.description}
                onSave={(desc) => handleUpdateTask("description", desc)}
                taskName={task.name}
                projectName={task.project?.name}
              />

              {dodBlockers.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Definition-of-Done blockers
                  </p>
                  <ul className="mt-2 space-y-2">
                    {dodBlockers.map((blocker) => (
                      <li key={blocker.checkName} className="flex items-center justify-between text-xs text-red-900 dark:text-red-200">
                        <span>{blocker.message}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2 h-6 text-xs border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/10"
                          onClick={() => setOverrideTarget(blocker.checkName)}
                        >
                          Override
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dodWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Definition-of-Done warnings
                  </p>
                  <ul className="mt-2 space-y-1">
                    {dodWarnings.map((warning) => (
                      <li key={warning.id} className="text-xs text-amber-900 dark:text-amber-200">
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="h-px w-full bg-border/80" />

              {/* Agent Messages */}
              <TaskMessagesPanel
                taskId={taskId!}
                orgId={organizationId}
                userId={organizationMembers.find((m) => m.profile)?.profile?.id ?? ""}
              />

              <div className="h-px w-full bg-border/80" />

              {/* Subtasks */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Subtasks</h3>
                <div className="space-y-2">
                  {subtasks.map((subtask) => (
                    <button
                      key={subtask.id}
                      type="button"
                      onClick={() => router.push(`${window.location.pathname}?task=${subtask.id}`, { scroll: false })}
                      className="w-full rounded-md border border-border p-2 text-left text-sm hover:bg-muted/50"
                    >
                      <div className="font-medium">{subtask.name}</div>
                      <div className="text-xs text-muted-foreground">{subtask.status}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    placeholder="Add subtask"
                    className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSubtask}
                    className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="h-px w-full bg-border/80" />

              {/* Timeline */}
              <div className="space-y-3 pt-1">
                <h3 className="text-sm font-medium text-foreground">Activity</h3>
                <TaskTimeline
                  items={timeline}
                  currentUserId={organizationMembers.find(m => m.profile)?.profile?.id}
                  onReactionToggle={async (commentId, emoji) => {
                    const { toggleCommentReaction } = await import("@/lib/actions/task-comments")
                    const result = await toggleCommentReaction(commentId, emoji)
                    if (result.error) {
                      toast.error(result.error)
                    }
                  }}
                />
              </div>

              {/* Comment Editor */}
              <div className="pb-4">
                <TaskCommentEditor
                  onSubmit={handleSubmitComment}
                  isSubmitting={isSubmitting}
                  organizationMembers={organizationMembers}
                  taskId={taskId!}
                />
              </div>
            </div>
          </>
        )}
      </SheetContent>

      {/* Override Blocker Dialog */}
      <Dialog open={overrideTarget !== null} onOpenChange={(open) => { if (!open) { setOverrideTarget(null); setOverrideReason("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override DoD Blocker</DialogTitle>
            <DialogDescription>
              Provide a reason for overriding this blocker. This will be recorded for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this blocker is being overridden..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideTarget(null); setOverrideReason("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleOverrideBlocker}
              disabled={!overrideReason.trim()}
            >
              Override Blocker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function TaskDetailPanelSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-32" />
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}
