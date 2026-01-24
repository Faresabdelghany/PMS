"use client"

import { useMemo, useState, useCallback } from "react"
import { DotsThreeVertical, Plus } from "@phosphor-icons/react/dist/ssr"
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

import type { TaskWithRelations } from "@/lib/actions/tasks"
import { updateTaskStatus, reorderTasks } from "@/lib/actions/tasks"
import type { FilterChip as FilterChipType } from "@/lib/view-options"
import {
  filterTasksByChips,
  computeTaskFilterCounts,
  type TaskLike,
} from "@/components/tasks/task-helpers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FilterPopover } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { TaskRowBase } from "@/components/tasks/TaskRowBase"
import { formatDueLabel } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

// Convert Supabase task to TaskLike format
function toTaskLike(task: TaskWithRelations): TaskLike {
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
    dueLabel: endDate ? formatDueLabel(endDate) : null,
  }
}

type ProjectTasksTabProps = {
  projectId: string
  initialTasks?: TaskWithRelations[]
}

export function ProjectTasksTab({ projectId, initialTasks = [] }: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [filters, setFilters] = useState<FilterChipType[]>([])

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

  if (!tasks.length) {
    return (
      <section className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        No tasks defined yet.
      </section>
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
          <Button size="sm" className="h-8 rounded-lg px-3 text-xs font-medium">
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
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </section>
  )
}

type TaskBadgesProps = {
  workstreamName?: string
}

function TaskBadges({ workstreamName }: TaskBadgesProps) {
  if (!workstreamName) return null

  return (
    <Badge variant="muted" className="whitespace-nowrap text-[11px]">
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
}

function TaskRowDnD({ task, onToggle }: TaskRowDnDProps) {
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
        titleSuffix={<TaskBadges workstreamName={task.workstreamName} />}
        meta={
          <>
            <TaskStatus status={task.status} />
            {task.dueLabel && (
              <span className="text-muted-foreground">{task.dueLabel}</span>
            )}
            {task.assignee && (
              <Avatar className="size-6">
                {task.assignee.avatarUrl && (
                  <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                )}
                <AvatarFallback>{task.assignee.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 rounded-md text-muted-foreground cursor-grab active:cursor-grabbing"
              aria-label="Reorder task"
              {...attributes}
              {...listeners}
            >
              <DotsThreeVertical className="h-4 w-4" weight="regular" />
            </Button>
          </>
        }
        className={isDragging ? "opacity-60" : ""}
      />
    </div>
  )
}
