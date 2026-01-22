"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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

import type { ProjectTask } from "@/lib/data/project-details"
import type { FilterCounts } from "@/lib/data/projects"
import type { FilterChip as FilterChipType } from "@/lib/view-options"
import { updateTaskStatus, reorderTasks } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FilterPopover } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { TaskRowBase } from "@/components/tasks/TaskRowBase"
import { cn } from "@/lib/utils"

type ProjectTasksTabProps = {
  tasks: ProjectTask[]
  projectId: string
}

export function ProjectTasksTab({ tasks: initialTasks, projectId }: ProjectTasksTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks)
  const [filters, setFilters] = useState<FilterChipType[]>([])

  const counts = useMemo<FilterCounts>(() => computeTaskFilterCounts(tasks), [tasks])

  const filteredTasks = useMemo(
    () => filterTasksByChips(tasks, filters),
    [tasks, filters],
  )

  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const newStatus = task.status === "done" ? "todo" : "done"

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    )

    // Server update
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, newStatus)
      if (result.error) {
        toast.error("Failed to update task status")
        // Revert optimistic update
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: task.status } : t
          )
        )
      } else {
        router.refresh()
      }
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex((item) => item.id === active.id)
    const newIndex = tasks.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reorderedTasks = arrayMove(tasks, oldIndex, newIndex)

    // Optimistic update
    setTasks(reorderedTasks)

    // Server update
    startTransition(async () => {
      // Group tasks by workstream for proper reordering
      const workstreamId = tasks[oldIndex]?.workstreamId || null
      const taskIds = reorderedTasks
        .filter((t) => t.workstreamId === workstreamId)
        .map((t) => t.id)

      const result = await reorderTasks(workstreamId, projectId, taskIds)
      if (result.error) {
        toast.error("Failed to reorder tasks")
      }
      router.refresh() // Always refresh to get server state
    })
  }

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
  status: ProjectTask["status"]
}

function TaskStatus({ status }: TaskStatusProps) {
  const label = getStatusLabel(status)
  const color = getStatusColor(status)

  return <span className={cn("font-medium", color)}>{label}</span>
}

function getStatusLabel(status: ProjectTask["status"]): string {
  switch (status) {
    case "done":
      return "Done"
    case "in-progress":
      return "In Progress"
    default:
      return "To do"
  }
}

function filterTasksByChips(tasks: ProjectTask[], chips: FilterChipType[]): ProjectTask[] {
  if (!chips.length) return tasks

  const memberValues = chips
    .filter((chip) => chip.key.toLowerCase().startsWith("member") || chip.key.toLowerCase() === "pic")
    .map((chip) => chip.value.toLowerCase())

  if (!memberValues.length) return tasks

  return tasks.filter((task) => {
    const name = task.assignee?.name.toLowerCase() ?? ""

    for (const value of memberValues) {
      if (value === "no member" && !task.assignee) return true
      if (value === "current member" && task.assignee) return true
      if (value && name.includes(value)) return true
    }

    return false
  })
}

function computeTaskFilterCounts(tasks: ProjectTask[]): FilterCounts {
  const counts: FilterCounts = {
    members: {
      "no-member": 0,
      current: 0,
    },
  }

  const memberCounts: Record<string, number> = {}

  for (const task of tasks) {
    if (!task.assignee) {
      counts.members!["no-member"] = (counts.members!["no-member"] || 0) + 1
    } else {
      counts.members!.current = (counts.members!.current || 0) + 1

      const name = task.assignee.name.toLowerCase()
      memberCounts[name] = (memberCounts[name] || 0) + 1
    }
  }

  // Add individual member counts
  for (const [name, count] of Object.entries(memberCounts)) {
    counts.members![name] = count
  }

  return counts
}

function getStatusColor(status: ProjectTask["status"]): string {
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
  task: ProjectTask
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
