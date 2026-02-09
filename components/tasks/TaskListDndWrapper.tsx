"use client"

import {
  DndContext,
  type DragEndEvent,
  closestCenter,
  MeasuringStrategy,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"

import { ProjectTaskListView, type TaskLike } from "@/components/tasks/task-helpers"
import type { ProjectTaskGroup } from "@/components/tasks/task-filter-utils"
import type { CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"

export type TaskListDndWrapperProps = {
  groups: ProjectTaskGroup[]
  allGroups: ProjectTaskGroup[]
  onToggleTask: (taskId: string) => void
  onAddTask: (context: CreateTaskContext) => void
  onEditTask?: (task: TaskLike) => void
  onDeleteTask?: (taskId: string) => void
  onReorder: (workstreamId: string | null, projectId: string, taskIds: string[]) => void
}

export function TaskListDndWrapper({
  groups,
  allGroups,
  onToggleTask,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onReorder,
}: TaskListDndWrapperProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeGroupIndex = allGroups.findIndex((group) =>
      group.tasks.some((task) => task.id === active.id)
    )
    if (activeGroupIndex === -1) return

    const activeGroup = allGroups[activeGroupIndex]

    const overGroupIndex = allGroups.findIndex((group) =>
      group.tasks.some((task) => task.id === over.id)
    )
    if (overGroupIndex === -1) return

    // Only allow reordering within the same group
    if (activeGroupIndex !== overGroupIndex) return

    const activeIndex = activeGroup.tasks.findIndex((task) => task.id === active.id)
    const overIndex = activeGroup.tasks.findIndex((task) => task.id === over.id)
    if (activeIndex === -1 || overIndex === -1) return

    const reorderedTasks = arrayMove(activeGroup.tasks, activeIndex, overIndex)
    const taskIds = reorderedTasks.map(t => t.id)

    const draggedTask = activeGroup.tasks.find(t => t.id === active.id)
    onReorder(draggedTask?.workstreamId || null, activeGroup.project.id, taskIds)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.BeforeDragging,
        },
      }}
    >
      <ProjectTaskListView
        groups={groups}
        onToggleTask={onToggleTask}
        onAddTask={onAddTask}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
      />
    </DndContext>
  )
}
