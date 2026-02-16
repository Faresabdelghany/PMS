"use client"

import { useMemo, useState, useCallback, useEffect, startTransition, memo } from "react"
import dynamic from "next/dynamic"
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { DotsSixVertical } from "@phosphor-icons/react/dist/ssr/DotsSixVertical"
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { format } from "date-fns"

import type { WorkstreamGroup, WorkstreamTask } from "@/lib/data/project-details"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { Workstream } from "@/lib/supabase/types"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { ProgressCircle } from "@/components/progress-circle"
import { cn } from "@/lib/utils"
// Lazy load modal since it's not needed initially
const CreateWorkstreamModal = dynamic(
  () => import("./CreateWorkstreamModal").then((m) => ({ default: m.CreateWorkstreamModal })),
  { ssr: false }
)
import { moveTaskToWorkstream, reorderTasks, updateTaskStatus, deleteTask } from "@/lib/actions/tasks"
import { deleteWorkstream } from "@/lib/actions/workstreams"
import { usePooledTasksRealtime, usePooledWorkstreamsRealtime } from "@/hooks/realtime-context"
import { formatDueLabel, getDueTone } from "@/lib/date-utils"
import {
  getTaskStatusLabel,
  getTaskStatusColor,
  getTaskPriorityLabel,
  getTaskPriorityColor,
  getDueToneColor,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/constants/status"
import type { Database, OrganizationTagLean } from "@/lib/supabase/types"

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
type WorkstreamRow = Database["public"]["Tables"]["workstreams"]["Row"]

type OrganizationMember = {
  id: string
  user_id: string
  role: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

type ProjectTask = {
  id: string
  name: string
  workstream_id: string | null
}

type WorkstreamTabProps = {
  projectId: string
  projectEndDate?: string | null
  projectName?: string
  workstreams: WorkstreamGroup[] | undefined
  allProjectTasks?: ProjectTask[] // All project tasks for the modal picker
  organizationMembers?: OrganizationMember[]
  organizationTags?: OrganizationTagLean[]
  onAddTask?: (workstreamId: string, workstreamName: string) => void
  onEditTask?: (task: WorkstreamTask, workstreamId: string, workstreamName: string) => void
  onRefresh?: () => void
}

export function WorkstreamTab({
  projectId,
  projectEndDate,
  projectName,
  workstreams,
  allProjectTasks = [],
  organizationMembers = [],
  organizationTags = [],
  onAddTask,
  onEditTask,
  onRefresh,
}: WorkstreamTabProps) {
  const [state, setState] = useState<WorkstreamGroup[]>(() => workstreams ?? [])
  const [openValues, setOpenValues] = useState<string[]>(() =>
    workstreams && workstreams.length ? [workstreams[0].id] : [],
  )
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [overTaskId, setOverTaskId] = useState<string | null>(null)

  // Modal states
  const [isCreateWorkstreamOpen, setIsCreateWorkstreamOpen] = useState(false)
  const [editingWorkstream, setEditingWorkstream] = useState<Workstream | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; name: string } | null>(null)
  const [workstreamToDelete, setWorkstreamToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Helper function to convert database task to WorkstreamTask
  const convertTaskToWorkstreamTask = useCallback((task: TaskRow): WorkstreamTask => {
    const startDate = task.start_date ? new Date(task.start_date) : undefined
    const endDate = task.end_date ? new Date(task.end_date) : undefined

    // Find assignee from organization members
    const assigneeMember = task.assignee_id
      ? organizationMembers.find((m) => m.user_id === task.assignee_id)
      : undefined

    return {
      id: task.id,
      name: task.name,
      status: task.status as WorkstreamTask["status"],
      priority: task.priority as WorkstreamTask["priority"],
      startDate,
      dueLabel: endDate ? formatDueLabel(endDate) : undefined,
      dueTone: endDate ? getDueTone(endDate) : undefined,
      tag: task.tag || undefined,
      assignee: assigneeMember
        ? {
            id: assigneeMember.user_id,
            name: assigneeMember.profile.full_name || assigneeMember.profile.email,
            avatarUrl: assigneeMember.profile.avatar_url || undefined,
          }
        : undefined,
    }
  }, [organizationMembers])

  // Sync state when workstreams prop changes
  useEffect(() => {
    if (workstreams) {
      setState(workstreams)
    }
  }, [workstreams])

  // Real-time task updates
  usePooledTasksRealtime(projectId, {
    onInsert: (task) => {
      if (!task.workstream_id) return
      const workstreamTask = convertTaskToWorkstreamTask(task)
      setState((prev) =>
        prev.map((g) =>
          g.id === task.workstream_id
            ? { ...g, tasks: [...g.tasks, workstreamTask] }
            : g
        )
      )
    },
    onUpdate: (task) => {
      const workstreamTask = convertTaskToWorkstreamTask(task)
      setState((prev) => {
        // First, remove task from all workstreams (in case it moved)
        const withoutTask = prev.map((g) => ({
          ...g,
          tasks: g.tasks.filter((t) => t.id !== task.id),
        }))

        // If task has a workstream_id, add it to that workstream
        if (task.workstream_id) {
          return withoutTask.map((g) =>
            g.id === task.workstream_id
              ? { ...g, tasks: [...g.tasks, workstreamTask] }
              : g
          )
        }
        return withoutTask
      })
    },
    onDelete: (task) => {
      setState((prev) =>
        prev.map((g) => ({
          ...g,
          tasks: g.tasks.filter((t) => t.id !== task.id),
        }))
      )
    },
  })

  // Real-time workstream updates
  usePooledWorkstreamsRealtime(projectId, {
    onInsert: (workstream) => {
      setState((prev) => {
        // Check if workstream already exists
        if (prev.some((g) => g.id === workstream.id)) return prev
        return [...prev, { id: workstream.id, name: workstream.name, tasks: [] }]
      })
    },
    onUpdate: (workstream) => {
      setState((prev) =>
        prev.map((g) =>
          g.id === workstream.id ? { ...g, name: workstream.name } : g
        )
      )
    },
    onDelete: (workstream) => {
      setState((prev) => prev.filter((g) => g.id !== workstream.id))
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const allIds = useMemo(() => state.map((group) => group.id), [state])

  const findTaskById = (taskId: string | null): WorkstreamTask | null => {
    if (!taskId) return null
    for (const group of state) {
      const found = group.tasks.find((task) => task.id === taskId)
      if (found) return found
    }
    return null
  }

  const activeTask = findTaskById(activeTaskId)

  // Helper to update a single task's status within a group
  const updateTaskInGroup = useCallback((
    group: WorkstreamGroup,
    taskId: string,
    newStatus: WorkstreamTask["status"]
  ): WorkstreamGroup => {
    const updatedTasks = group.tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus } : t
    )
    return { ...group, tasks: updatedTasks }
  }, [])

  // Helper to update task status in state
  const updateTaskStatusInState = useCallback((
    groupId: string,
    taskId: string,
    newStatus: WorkstreamTask["status"]
  ) => {
    setState((prev) =>
      prev.map((g) => g.id === groupId ? updateTaskInGroup(g, taskId, newStatus) : g)
    )
  }, [updateTaskInGroup])

  const toggleTask = useCallback(async (groupId: string, taskId: string) => {
    const group = state.find((g) => g.id === groupId)
    const task = group?.tasks.find((t) => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "done" ? "todo" : "done"
    const originalStatus = task.status

    // Optimistic update
    updateTaskStatusInState(groupId, taskId, newStatus)

    // Persist to database (deferred as non-urgent to improve INP)
    startTransition(() => {
      updateTaskStatus(taskId, newStatus as "todo" | "in-progress" | "done").then((result) => {
        if (result.error) {
          // Revert on error
          updateTaskStatusInState(groupId, taskId, originalStatus)
          toast.error("Failed to update task status")
        }
      })
    })
  }, [state, updateTaskStatusInState])

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id
    if (typeof id === "string") {
      setActiveTaskId(id)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id
    if (typeof overId === "string" && !overId.startsWith("group:")) {
      setOverTaskId(overId)
    } else {
      setOverTaskId(null)
    }
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTaskId(null)
    setOverTaskId(null)

    if (!over) return
    if (active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    let sourceGroupIndex = -1
    let sourceTaskIndex = -1
    let targetGroupIndex = -1
    let targetTaskIndex = -1
    let sourceGroupId: string | null = null
    let targetGroupId: string | null = null

    state.forEach((group, groupIndex) => {
      const aIndex = group.tasks.findIndex((task) => task.id === activeId)
      if (aIndex !== -1) {
        sourceGroupIndex = groupIndex
        sourceTaskIndex = aIndex
        sourceGroupId = group.id
      }

      const oIndex = group.tasks.findIndex((task) => task.id === overId)
      if (oIndex !== -1) {
        targetGroupIndex = groupIndex
        targetTaskIndex = oIndex
        targetGroupId = group.id
      }
    })

    // If we didn't land on a task but on a group container
    if (targetGroupIndex === -1 && overId.startsWith("group:")) {
      const groupId = overId.slice("group:".length)
      targetGroupIndex = state.findIndex((group) => group.id === groupId)
      if (targetGroupIndex !== -1) {
        targetTaskIndex = state[targetGroupIndex].tasks.length
        targetGroupId = groupId
      }
    }

    if (sourceGroupIndex === -1 || targetGroupIndex === -1) return

    // Optimistic update
    setState((prev) => {
      const next = [...prev]
      const sourceGroup = next[sourceGroupIndex]
      const targetGroup = next[targetGroupIndex]

      if (sourceGroupIndex === targetGroupIndex) {
        const reordered = arrayMove(sourceGroup.tasks, sourceTaskIndex, targetTaskIndex)
        next[sourceGroupIndex] = { ...sourceGroup, tasks: reordered }
        return next
      }

      const sourceTasks = [...sourceGroup.tasks]
      const [moved] = sourceTasks.splice(sourceTaskIndex, 1)
      if (!moved) return prev

      const targetTasks = [...targetGroup.tasks]
      targetTasks.splice(targetTaskIndex, 0, moved)

      next[sourceGroupIndex] = { ...sourceGroup, tasks: sourceTasks }
      next[targetGroupIndex] = { ...targetGroup, tasks: targetTasks }

      return next
    })

    // Persist to database with error handling
    try {
      if (sourceGroupId === targetGroupId) {
        // Reorder within same workstream
        const newTaskIds = state[targetGroupIndex].tasks.map((t) => t.id)
        const reorderedIds = arrayMove(newTaskIds, sourceTaskIndex, targetTaskIndex)
        const result = await reorderTasks(targetGroupId, projectId, reorderedIds)
        if (result?.error) {
          throw new Error(result.error)
        }
      } else {
        // Move across workstreams
        const result = await moveTaskToWorkstream(activeId, targetGroupId, targetTaskIndex)
        if (result?.error) {
          throw new Error(result.error)
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      setState((prev) => {
        const next = [...prev]
        const sourceGroup = next[sourceGroupIndex]
        const targetGroup = next[targetGroupIndex]

        if (sourceGroupIndex === targetGroupIndex) {
          // Revert reorder
          const reverted = arrayMove(sourceGroup.tasks, targetTaskIndex, sourceTaskIndex)
          next[sourceGroupIndex] = { ...sourceGroup, tasks: reverted }
          return next
        }

        // Revert cross-workstream move
        const targetTasks = [...targetGroup.tasks]
        const [movedBack] = targetTasks.splice(targetTaskIndex, 1)
        if (!movedBack) return prev

        const sourceTasks = [...sourceGroup.tasks]
        sourceTasks.splice(sourceTaskIndex, 0, movedBack)

        next[sourceGroupIndex] = { ...sourceGroup, tasks: sourceTasks }
        next[targetGroupIndex] = { ...targetGroup, tasks: targetTasks }

        return next
      })
      toast.error("Failed to move task")
    }
  }, [state, projectId])

  const handleDragCancel = () => {
    setActiveTaskId(null)
    setOverTaskId(null)
  }

  const handleDeleteTask = useCallback(async () => {
    if (!taskToDelete) return

    setIsDeleting(true)
    const result = await deleteTask(taskToDelete.id)

    if (result.error) {
      toast.error("Failed to delete task")
    } else {
      setState((prev) =>
        prev.map((g) => ({
          ...g,
          tasks: g.tasks.filter((t) => t.id !== taskToDelete.id),
        }))
      )
      toast.success("Task deleted")
    }

    setIsDeleting(false)
    setTaskToDelete(null)
  }, [taskToDelete])

  const handleDeleteWorkstream = useCallback(async () => {
    if (!workstreamToDelete) return

    setIsDeleting(true)
    const result = await deleteWorkstream(workstreamToDelete.id)

    if (result.error) {
      toast.error("Failed to delete workstream")
    } else {
      setState((prev) => prev.filter((g) => g.id !== workstreamToDelete.id))
      toast.success("Workstream deleted")
      onRefresh?.()
    }

    setIsDeleting(false)
    setWorkstreamToDelete(null)
  }, [workstreamToDelete, onRefresh])

  const handleWorkstreamCreated = useCallback((workstream: Workstream) => {
    setState((prev) => [
      ...prev,
      {
        id: workstream.id,
        name: workstream.name,
        tasks: [],
      },
    ])
    onRefresh?.()
  }, [onRefresh])

  const handleWorkstreamUpdated = useCallback((workstream: Workstream) => {
    setState((prev) =>
      prev.map((g) =>
        g.id === workstream.id ? { ...g, name: workstream.name } : g
      )
    )
    setEditingWorkstream(null)
    onRefresh?.()
  }, [onRefresh])

  // Convert tasks to TaskOption format for modal
  // Use allProjectTasks if available (includes unassigned tasks), otherwise fall back to workstream tasks
  const existingTasks = useMemo(() => {
    if (allProjectTasks.length > 0) {
      // Build a map of workstream id to name
      const workstreamMap = new Map<string, string>()
      state.forEach((group) => {
        workstreamMap.set(group.id, group.name)
      })

      return allProjectTasks.map((task) => ({
        id: task.id,
        name: task.name,
        workstreamId: task.workstream_id,
        workstreamName: task.workstream_id ? workstreamMap.get(task.workstream_id) || null : null,
      }))
    }

    // Fallback: iterate over workstreams (only includes assigned tasks)
    const tasks: { id: string; name: string; workstreamId: string | null; workstreamName: string | null }[] = []
    state.forEach((group) => {
      group.tasks.forEach((task) => {
        tasks.push({
          id: task.id,
          name: task.name,
          workstreamId: group.id,
          workstreamName: group.name,
        })
      })
    })
    return tasks
  }, [state, allProjectTasks])

  if (!state.length) {
    return (
      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold tracking-normal text-foreground uppercase">
            WORKSTREAM BREAKDOWN
          </h2>
        </div>
        <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground text-center">
          <p className="mb-3">No workstreams defined yet.</p>
          <Button size="sm" onClick={() => setIsCreateWorkstreamOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Workstream
          </Button>
        </div>

        <CreateWorkstreamModal
          open={isCreateWorkstreamOpen}
          onClose={() => setIsCreateWorkstreamOpen(false)}
          projectId={projectId}
          projectEndDate={projectEndDate}
          projectName={projectName}
          existingTasks={existingTasks}
          organizationTags={organizationTags}
          onWorkstreamCreated={handleWorkstreamCreated}
        />
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-muted shadow-[var(--shadow-workstream)] p-3 space-y-3">
      <div className="flex items-center justify-between gap-3 px-2">
        <h2 className="text-sm font-semibold tracking-normal text-foreground uppercase">
          WORKSTREAM BREAKDOWN
        </h2>
        <div className="flex items-center gap-1 opacity-60">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-lg hover:cursor-pointer"
            aria-label="Collapse all"
            onClick={() => startTransition(() => setOpenValues([]))}
            disabled={!allIds.length}
          >
            <CaretDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-lg hover:cursor-pointer"
            aria-label="Expand all"
            onClick={() => startTransition(() => setOpenValues(allIds))}
            disabled={!allIds.length}
          >
            <CaretDown className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      </div>

      <div className="px-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.WhileDragging,
            },
          }}
        >
          <Accordion
            type="multiple"
            value={openValues}
            onValueChange={(values) =>
              startTransition(() => {
                setOpenValues(Array.isArray(values) ? values : values ? [values] : [])
              })
            }
          >
            {state.map((group) => (
              <AccordionItem
                key={group.id}
                value={group.id}
                className="mb-2 overflow-hidden rounded-xl border border-border bg-background last:mb-0"
              >
                <AccordionTrigger className="bg-background">
                  <div className="flex flex-1 items-center gap-3">
                    <CaretDown className="h-4 w-4 text-muted-foreground hover:cursor-pointer" aria-hidden="true" />
                    <span className="flex-1 truncate text-left text-sm font-medium text-foreground hover:cursor-pointer">
                      {group.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        className="size-6 rounded-md"
                      >
                        <span
                          role="button"
                          aria-label="Add task"
                          onClick={(event) => {
                            event.stopPropagation()
                            onAddTask?.(group.id, group.name)
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </Button>
                      <Separator orientation="vertical" className="h-4" />
                      <GroupSummary group={group} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            asChild
                            size="icon-sm"
                            variant="ghost"
                            className="size-6 rounded-md"
                          >
                            <span
                              role="button"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DotsThreeVertical className="h-4 w-4" weight="bold" />
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingWorkstream({
                                id: group.id,
                                project_id: projectId,
                                name: group.name,
                                description: group.description || null,
                                start_date: group.startDate || null,
                                end_date: group.endDate || null,
                                tag: group.tag || null,
                                sort_order: 0,
                                created_at: "",
                                updated_at: "",
                              })
                              setIsCreateWorkstreamOpen(true)
                            }}
                          >
                            <PencilSimple className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setWorkstreamToDelete({ id: group.id, name: group.name })
                            }}
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </AccordionTrigger>

                <WorkstreamTasks
                  group={group}
                  activeTaskId={activeTaskId}
                  overTaskId={overTaskId}
                  onEditTask={(task) => onEditTask?.(task, group.id, group.name)}
                  onDeleteTask={(task) => setTaskToDelete({ id: task.id, name: task.name })}
                  onToggle={(taskId) => toggleTask(group.id, taskId)}
                />
              </AccordionItem>
            ))}
          </Accordion>

          <DragOverlay>
            {activeTask ? (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm bg-background shadow-md">
                <span className="flex-1 truncate text-left">{activeTask.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Add Workstream button */}
      <div className="px-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setEditingWorkstream(null)
            setIsCreateWorkstreamOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Add Workstream
        </Button>
      </div>

      {/* Create/Edit Workstream Modal */}
      <CreateWorkstreamModal
        open={isCreateWorkstreamOpen}
        onClose={() => {
          setIsCreateWorkstreamOpen(false)
          setEditingWorkstream(null)
        }}
        projectId={projectId}
        projectEndDate={projectEndDate}
        projectName={projectName}
        existingTasks={existingTasks}
        editingWorkstream={editingWorkstream}
        organizationTags={organizationTags}
        onWorkstreamCreated={handleWorkstreamCreated}
        onWorkstreamUpdated={handleWorkstreamUpdated}
      />

      {/* Delete Task Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{taskToDelete?.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Workstream Dialog */}
      <AlertDialog open={!!workstreamToDelete} onOpenChange={(open) => !open && setWorkstreamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workstream?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete &quot;{workstreamToDelete?.name}&quot;. Tasks in this workstream will be kept but unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkstream}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

type GroupSummaryProps = {
  group: WorkstreamGroup
}

function GroupSummary({ group }: GroupSummaryProps) {
  const total = group.tasks.length
  const done = group.tasks.filter((t) => t.status === "done").length
  const percent = total ? Math.round((done / total) * 100) : 0
  const color = getWorkstreamProgressColor(percent)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {done}/{total}
      </span>
      <ProgressCircle progress={percent} color={color} size={18} />
    </div>
  )
}

function getWorkstreamProgressColor(percent: number): string {
  if (percent >= 80) return "var(--chart-3)"
  if (percent >= 50) return "var(--chart-4)"
  if (percent > 0) return "var(--chart-5)"
  return "var(--chart-2)"
}

type WorkstreamTasksProps = {
  group: WorkstreamGroup
  activeTaskId: string | null
  overTaskId: string | null
  onEditTask?: (task: WorkstreamTask) => void
  onDeleteTask?: (task: WorkstreamTask) => void
  onToggle?: (taskId: string) => void
}

function WorkstreamTasks({
  group,
  activeTaskId,
  overTaskId,
  onEditTask,
  onDeleteTask,
  onToggle,
}: WorkstreamTasksProps) {
  const { setNodeRef } = useDroppable({ id: `group:${group.id}` })

  return (
    <AccordionContent className="border-t border-border bg-background/60 px-1.5">
      <SortableContext items={group.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="space-y-1 py-2">
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onToggle={onToggle}
              activeTaskId={activeTaskId}
              overTaskId={overTaskId}
            />
          ))}
        </div>
      </SortableContext>
    </AccordionContent>
  )
}


type TaskRowProps = {
  task: WorkstreamTask
  onEdit?: (task: WorkstreamTask) => void
  onDelete?: (task: WorkstreamTask) => void
  onToggle?: (taskId: string) => void
  activeTaskId: string | null
  overTaskId: string | null
}

const TaskRow = memo(function TaskRow({ task, onEdit, onDelete, onToggle, activeTaskId, overTaskId }: TaskRowProps) {
  const isDone = task.status === "done"

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const showDropLine = !isDragging && (isOver || overTaskId === task.id)

  // Use helper functions for status/priority formatting
  const statusLabel = getTaskStatusLabel(task.status as TaskStatus)
  const statusColor = getTaskStatusColor(task.status as TaskStatus)
  const priorityLabel = task.priority ? getTaskPriorityLabel(task.priority as TaskPriority) : null
  const priorityColor = task.priority ? getTaskPriorityColor(task.priority as TaskPriority) : "text-muted-foreground"

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      {showDropLine && <div className="h-px w-full rounded-full bg-primary" />}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm bg-background hover:bg-muted/50 transition-colors",
          isDragging && "opacity-60"
        )}
      >
        {/* Checkbox */}
        <Checkbox
          checked={isDone}
          onCheckedChange={() => onToggle?.(task.id)}
          aria-label={`Mark ${task.name} as ${isDone ? "not done" : "done"}`}
          className="rounded-full border-border bg-background data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600 hover:cursor-pointer shrink-0"
        />

        {/* Task name - left side */}
        <span className={cn(
          "font-medium text-foreground truncate flex-1 min-w-0",
          isDone && "line-through text-muted-foreground"
        )}>
          {task.name}
        </span>

        {/* Metadata - right side */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status */}
          <span className={cn("text-xs font-medium whitespace-nowrap", statusColor)}>
            {statusLabel}
          </span>

          {/* Start date */}
          {task.startDate && (
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
              Start: {format(task.startDate, "dd/MM")}
            </span>
          )}

          {/* Due label */}
          {task.dueLabel && (
            <span className={cn("text-xs whitespace-nowrap hidden sm:inline", getDueToneColor(task.dueTone))}>
              {task.dueLabel}
            </span>
          )}

          {/* Priority */}
          {priorityLabel && (
            <span className={cn("text-xs font-medium whitespace-nowrap hidden sm:inline", priorityColor)}>
              {priorityLabel}
            </span>
          )}

          {/* Tag */}
          {task.tag && (
            <Badge variant="outline" className="text-xs font-normal h-5 px-2 hidden sm:inline-flex">
              {task.tag}
            </Badge>
          )}

          {/* Assignee */}
          {task.assignee && (
            <Avatar className="size-6">
              {task.assignee.avatarUrl && (
                <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
              )}
              <AvatarFallback>{task.assignee.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-7 rounded-md text-muted-foreground"
                aria-label="Task actions"
              >
                <DotsThreeVertical className="h-4 w-4" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <PencilSimple className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  {onEdit && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(task)}
                  >
                    <Trash className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 rounded-md text-muted-foreground cursor-grab active:cursor-grabbing"
            aria-label="Reorder task"
            {...attributes}
            {...listeners}
          >
            <DotsSixVertical className="h-4 w-4" weight="regular" />
          </Button>
        </div>
      </div>
    </div>
  )
})
