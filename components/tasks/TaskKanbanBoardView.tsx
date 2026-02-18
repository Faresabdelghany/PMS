"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle"
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  MeasuringStrategy,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import type { ProjectTask } from "@/lib/data/project-details"
import { TaskBoardCard } from "@/components/tasks/TaskBoardCard"
import type { CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"
import type { OrganizationTagLean as OrganizationTag } from "@/lib/supabase/types"
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from "@/lib/constants/status"
import { cn } from "@/lib/utils"

type TaskKanbanBoardViewProps = {
  tasks: ProjectTask[]
  onAddTask?: (context?: CreateTaskContext) => void
  onToggleTask?: (taskId: string) => void
  onChangeTag?: (taskId: string, tagLabel?: string) => void
  onChangeStatus?: (taskId: string, newStatus: TaskStatus) => void
  onOpenTask?: (task: ProjectTask) => void
  tags?: OrganizationTag[]
}

function statusIcon(status: TaskStatus): React.JSX.Element {
  switch (status) {
    case "todo":
      return <Circle className="h-4 w-4 text-muted-foreground" />
    case "in-progress":
      return <CircleNotch className="h-4 w-4 text-amber-500" />
    case "done":
      return <CheckCircle className="h-4 w-4 text-emerald-500" />
  }
}

export function TaskKanbanBoardView({
  tasks,
  onAddTask,
  onToggleTask,
  onChangeTag,
  onChangeStatus,
  onOpenTask,
  tags = [],
}: TaskKanbanBoardViewProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const statusColumns = useMemo(() => {
    return TASK_STATUSES.map((status) => ({
      status,
      label: TASK_STATUS_LABELS[status],
      tasks: tasks.filter((t) => t.status === status),
    }))
  }, [tasks])

  // Local order within each column: status -> task ids
  const [columnOrder, setColumnOrder] = useState<Record<string, string[]>>({})
  const [activeTask, setActiveTask] = useState<ProjectTask | undefined>(undefined)

  useEffect(() => {
    setColumnOrder((prev) => {
      const next: Record<string, string[]> = {}

      for (const column of statusColumns) {
        const key = column.status
        const existing = prev[key] ?? []
        const taskIds = column.tasks.map((t) => t.id)

        const idSet = new Set(taskIds)
        const ordered: string[] = [
          ...existing.filter((id) => idSet.has(id)),
          ...taskIds.filter((id) => !existing.includes(id)),
        ]

        next[key] = ordered
      }

      return next
    })
  }, [statusColumns])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(undefined)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeStatus = active.data.current?.statusKey as string | undefined
    let overStatus = over.data.current?.statusKey as string | undefined
    if (!overStatus && (TASK_STATUSES as readonly string[]).includes(overId)) {
      overStatus = overId
    }

    if (!activeStatus || !overStatus) return

    if (activeStatus === overStatus) {
      // Reorder within the same column (local only)
      setColumnOrder((prev) => {
        const current = prev[activeStatus] ?? []
        const oldIndex = current.indexOf(activeId)
        const newIndex = current.indexOf(overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev
        return {
          ...prev,
          [activeStatus]: arrayMove(current, oldIndex, newIndex),
        }
      })
      return
    }

    // Move to different status column
    setColumnOrder((prev) => {
      const source = prev[activeStatus] ?? []
      const target = prev[overStatus!] ?? []

      const nextSource = source.filter((id) => id !== activeId)
      const nextTarget = target.includes(activeId) ? target : [...target, activeId]

      return {
        ...prev,
        [activeStatus]: nextSource,
        [overStatus!]: nextTarget,
      }
    })

    onChangeStatus?.(activeId, overStatus as TaskStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => {
        const id = String(active.id)
        const map = new Map(tasks.map((t) => [t.id, t]))
        setActiveTask(map.get(id))
      }}
      onDragEnd={handleDragEnd}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.BeforeDragging,
        },
      }}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-2">
        {statusColumns.map((column) => {
          const orderedIds = columnOrder[column.status] ?? column.tasks.map((t) => t.id)
          const taskMap = new Map(column.tasks.map((t) => [t.id, t]))
          const orderedTasks = orderedIds
            .map((id) => taskMap.get(id))
            .filter((t): t is ProjectTask => Boolean(t))

          return (
            <StatusColumnDroppable
              key={column.status}
              statusKey={column.status}
              label={column.label}
              count={column.tasks.length}
              orderedIds={orderedIds}
              orderedTasks={orderedTasks}
              onAddTask={onAddTask}
              onToggleTask={onToggleTask}
              onOpenTask={onOpenTask}
              onChangeTag={onChangeTag}
              tags={tags}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskBoardCard
            task={activeTask}
            variant={activeTask.status === "done" ? "completed" : "default"}
            onToggle={() => onToggleTask?.(activeTask.id)}
            onOpen={() => onOpenTask?.(activeTask)}
            onChangeTag={(tagLabel) => onChangeTag?.(activeTask.id, tagLabel)}
            tags={tags}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

type StatusColumnDroppableProps = {
  statusKey: TaskStatus
  label: string
  count: number
  orderedIds: string[]
  orderedTasks: ProjectTask[]
  onAddTask?: (context?: CreateTaskContext) => void
  onToggleTask?: (taskId: string) => void
  onOpenTask?: (task: ProjectTask) => void
  onChangeTag?: (taskId: string, tagLabel?: string) => void
  tags?: OrganizationTag[]
}

function StatusColumnDroppable({
  statusKey,
  label,
  count,
  orderedIds,
  orderedTasks,
  onAddTask,
  onToggleTask,
  onOpenTask,
  onChangeTag,
  tags = [],
}: StatusColumnDroppableProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: statusKey,
    data: { statusKey },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 rounded-2xl border border-muted bg-muted p-3 space-y-3 min-h-[400px] flex-1 min-w-[280px] transition-colors",
        isOver && "border-primary/80",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon(statusKey)}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground rounded-full bg-background px-1.5 py-0.5">
            {count}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => onAddTask?.({})}
          aria-label={`Add ${label} task`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Column Content */}
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {orderedTasks.length === 0 ? (
            <TaskBoardCard variant="empty" />
          ) : (
            orderedTasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                statusKey={statusKey}
                onToggle={onToggleTask}
                onOpen={onOpenTask}
                onChangeTag={onChangeTag}
                tags={tags}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

type SortableTaskCardProps = {
  task: ProjectTask
  statusKey: string
  onToggle?: (taskId: string) => void
  onOpen?: (task: ProjectTask) => void
  onChangeTag?: (taskId: string, tagLabel?: string) => void
  tags?: OrganizationTag[]
}

function SortableTaskCard({ task, statusKey, onToggle, onOpen, onChangeTag, tags = [] }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    data: { statusKey },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskBoardCard
        task={task}
        variant={task.status === "done" ? "completed" : "default"}
        onToggle={() => onToggle?.(task.id)}
        onOpen={() => onOpen?.(task)}
        onChangeTag={(tagLabel) => onChangeTag?.(task.id, tagLabel)}
        tags={tags}
      />
    </div>
  )
}
