"use client"

import { useMemo, useState, useCallback } from "react"
import { DotsThreeVertical, DotsSixVertical, PencilSimple, Plus, Trash } from "@phosphor-icons/react/dist/ssr"
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
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

import type { TaskWithRelations } from "@/lib/actions/tasks"
import { deleteTask, updateTaskStatus, reorderTasks } from "@/lib/actions/tasks"
import type { FilterChip as FilterChipType } from "@/lib/view-options"
import {
  filterTasksByChips,
  computeTaskFilterCounts,
  TaskPriority,
  type TaskLike,
} from "@/components/tasks/task-helpers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FilterPopover } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { TaskRowBase } from "@/components/tasks/TaskRowBase"
import { TaskQuickCreateModal, type TaskData } from "@/components/tasks/TaskQuickCreateModal"
import { formatDueLabel } from "@/lib/date-utils"
import { cn } from "@/lib/utils"
import { useTasksRealtime } from "@/hooks/use-realtime"

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

// Convert Supabase task to TaskLike format
function toTaskLike(task: TaskWithRelations): TaskLike {
  const startDate = task.start_date ? new Date(task.start_date) : null
  const endDate = task.end_date ? new Date(task.end_date) : null
  return {
    id: task.id,
    name: task.name,
    status: task.status as "todo" | "in-progress" | "done",
    priority: task.priority,
    tag: task.tag || null,
    assignee: task.assignee ? {
      name: task.assignee.full_name || task.assignee.email,
      avatarUrl: task.assignee.avatar_url || null,
    } : null,
    workstreamName: task.workstream?.name || null,
    startDate,
    endDate,
    dueLabel: endDate ? formatDueLabel(endDate) : null,
  }
}

type ProjectTasksTabProps = {
  projectId: string
  projectName: string
  initialTasks?: TaskWithRelations[]
  workstreams?: { id: string; name: string }[]
  organizationMembers?: OrganizationMember[]
}

export function ProjectTasksTab({
  projectId,
  projectName,
  initialTasks = [],
  workstreams = [],
  organizationMembers = [],
}: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [filters, setFilters] = useState<FilterChipType[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskLike | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Realtime subscription for tasks
  useTasksRealtime(projectId, {
    onInsert: (newTask) => {
      setTasks((prev) => {
        // Avoid duplicates
        if (prev.some((t) => t.id === newTask.id)) return prev
        // Add with minimal relations (will be properly fetched on next page load)
        return [...prev, {
          ...newTask,
          assignee: null,
          workstream: null,
          project: { id: projectId, name: projectName },
        } as TaskWithRelations]
      })
    },
    onUpdate: (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updatedTask.id
            ? { ...t, ...updatedTask }
            : t
        )
      )
    },
    onDelete: (deletedTask) => {
      setTasks((prev) => prev.filter((t) => t.id !== deletedTask.id))
    },
  })

  const uiTasks = useMemo(() => tasks.map(toTaskLike), [tasks])

  const counts = useMemo(() => computeTaskFilterCounts(uiTasks), [uiTasks])

  const filteredTasks = useMemo(
    () => filterTasksByChips(uiTasks, filters),
    [uiTasks, filters],
  )

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "done" ? "todo" : "done"

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    )

    const result = await updateTaskStatus(taskId, newStatus as "todo" | "in-progress" | "done")
    if (result.error) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: task.status } : t
        )
      )
      toast.error("Failed to update task status")
    }
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((item) => item.id === active.id)
      const newIndex = tasks.findIndex((item) => item.id === over.id)
      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex)

      // Optimistic update
      setTasks(reorderedTasks)

      // Persist to Supabase
      const taskIds = reorderedTasks.map(t => t.id)
      const activeTask = tasks[oldIndex]
      await reorderTasks(activeTask?.workstream_id || null, projectId, taskIds)
    }
  }, [tasks, projectId])

  const handleTaskCreated = useCallback((task: TaskData) => {
    // Add the new task optimistically - realtime's onInsert has duplicate check
    const newTask: TaskWithRelations = {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority || "no-priority",
      tag: task.tag || null,
      description: task.description || null,
      start_date: task.startDate?.toISOString().split('T')[0] || null,
      end_date: task.endDate?.toISOString().split('T')[0] || null,
      project_id: projectId,
      workstream_id: task.workstreamId || null,
      assignee_id: task.assignee?.id || null,
      sort_order: tasks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project: { id: projectId, name: projectName },
      workstream: task.workstreamId ? { id: task.workstreamId, name: task.workstreamName || "" } : null,
      assignee: task.assignee ? {
        id: task.assignee.id,
        full_name: task.assignee.name,
        email: "",
        avatar_url: task.assignee.avatarUrl || null
      } : null,
    }
    setTasks((prev) => [...prev, newTask])
  }, [projectId, projectName, tasks.length])

  const handleTaskUpdated = useCallback((updated: TaskData) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === updated.id
          ? {
              ...t,
              name: updated.name,
              status: updated.status,
              priority: updated.priority || "no-priority",
              tag: updated.tag || null,
              description: updated.description || null,
              start_date: updated.startDate?.toISOString().split('T')[0] || null,
              end_date: updated.endDate?.toISOString().split('T')[0] || null,
              workstream_id: updated.workstreamId || null,
              workstream: updated.workstreamId ? { id: updated.workstreamId, name: updated.workstreamName || "" } : null,
              assignee_id: updated.assignee?.id || null,
              assignee: updated.assignee ? {
                id: updated.assignee.id,
                full_name: updated.assignee.name,
                email: "",
                avatar_url: updated.assignee.avatarUrl || null
              } : null,
            }
          : t
      )
    )
    setEditingTask(null)
  }, [])

  const openEditTask = useCallback((task: TaskLike) => {
    setEditingTask(task)
    setIsCreateModalOpen(true)
  }, [])

  const handleDeleteTask = useCallback(async () => {
    if (!taskToDelete) return

    setIsDeleting(true)
    const result = await deleteTask(taskToDelete)

    if (result.error) {
      toast.error("Failed to delete task")
    } else {
      // Remove task from local state
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete))
      toast.success("Task deleted")
    }

    setIsDeleting(false)
    setTaskToDelete(null)
  }, [taskToDelete])

  // Projects data for modal (single project since we're in project context)
  const projectsForModal = useMemo(() => [{
    id: projectId,
    name: projectName,
    workstreams: workstreams,
  }], [projectId, projectName, workstreams])

  if (!tasks.length) {
    return (
      <>
        <section className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          <p className="mb-3">No tasks defined yet.</p>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Task
          </Button>
        </section>
        <TaskQuickCreateModal
          open={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false)
            setEditingTask(null)
          }}
          context={editingTask ? undefined : { projectId }}
          onTaskCreated={handleTaskCreated}
          editingTask={editingTask || undefined}
          onTaskUpdated={handleTaskUpdated}
          projects={projectsForModal}
          organizationMembers={organizationMembers}
        />
      </>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-[var(--shadow-workstream)]">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <FilterPopover
            initialChips={filters}
            onApply={setFilters}
            onClear={() => setFilters([])}
            counts={counts}
          />
          <ChipOverflow
            chips={filters}
            onRemove={(key, value) =>
              setFilters((prev) => prev.filter((chip) => !(chip.key === key && chip.value === value)))
            }
            maxVisible={4}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-border/60 bg-transparent px-3 text-xs font-medium"
          >
            View
          </Button>
          <Button size="sm" className="h-8 rounded-lg px-3 text-xs font-medium" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Task
          </Button>
        </div>
      </header>

      <div className="space-y-1 px-2 py-3">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {filteredTasks.map((task) => (
              <TaskRowDnD
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onEdit={openEditTask}
                onDelete={(taskId) => setTaskToDelete(taskId)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <TaskQuickCreateModal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingTask(null)
        }}
        context={editingTask ? undefined : { projectId }}
        onTaskCreated={handleTaskCreated}
        editingTask={editingTask || undefined}
        onTaskUpdated={handleTaskUpdated}
        projects={projectsForModal}
        organizationMembers={organizationMembers}
      />

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task.
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
    </section>
  )
}

type TaskBadgesProps = {
  workstreamName?: string
  className?: string
}

function TaskBadges({ workstreamName, className }: TaskBadgesProps) {
  if (!workstreamName) return null

  return (
    <Badge variant="muted" className={cn("whitespace-nowrap text-[11px]", className)}>
      {workstreamName}
    </Badge>
  )
}

type TaskStatusProps = {
  status: TaskLike["status"]
}

function TaskStatus({ status }: TaskStatusProps) {
  const label = getStatusLabel(status)
  const color = getStatusColor(status)

  return <span className={cn("font-medium", color)}>{label}</span>
}

function getStatusLabel(status: TaskLike["status"]): string {
  switch (status) {
    case "done":
      return "Done"
    case "in-progress":
      return "In Progress"
    default:
      return "To do"
  }
}

function getStatusColor(status: TaskLike["status"]): string {
  switch (status) {
    case "done":
      return "text-emerald-500"
    case "in-progress":
      return "text-amber-500"
    default:
      return "text-muted-foreground"
  }
}

type TaskRowDnDProps = {
  task: TaskLike
  onToggle: () => void
  onEdit?: (task: TaskLike) => void
  onDelete?: (taskId: string) => void
}

function TaskRowDnD({ task, onToggle, onEdit, onDelete }: TaskRowDnDProps) {
  const isDone = task.status === "done"

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRowBase
        checked={isDone}
        title={task.name}
        onCheckedChange={onToggle}
        titleAriaLabel={task.name}
        titleSuffix={<TaskBadges workstreamName={task.workstreamName} className="hidden sm:inline" />}
        meta={
          <>
            <TaskStatus status={task.status} />
            {task.startDate && (
              <span className="text-muted-foreground hidden sm:inline">
                Start: {format(task.startDate, "dd/MM")}
              </span>
            )}
            {task.dueLabel && (
              <span className="text-muted-foreground hidden sm:inline">{task.dueLabel}</span>
            )}
            {task.priority && <TaskPriority priority={task.priority} className="hidden sm:inline" />}
            {task.tag && (
              <Badge variant="outline" className="whitespace-nowrap text-[11px] hidden sm:inline">
                {task.tag}
              </Badge>
            )}
            {task.assignee && (
              <Avatar className="size-6">
                {task.assignee.avatarUrl && (
                  <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                )}
                <AvatarFallback>{task.assignee.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
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
                      onClick={() => onDelete(task.id)}
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
          </>
        }
        className={isDragging ? "opacity-60" : ""}
      />
    </div>
  )
}
