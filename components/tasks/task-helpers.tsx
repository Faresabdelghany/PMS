"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar"
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical"
import { DotsSixVertical } from "@phosphor-icons/react/dist/ssr/DotsSixVertical"
import { FolderSimple } from "@phosphor-icons/react/dist/ssr/FolderSimple"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  getProjectStatusLabel as getProjectStatusLabelFromConstants,
  getTaskStatusLabel,
  getTaskStatusColor,
  getTaskPriorityLabel,
  type TaskStatus,
} from "@/lib/constants/status"
import { capitalize } from "@/lib/utils"
import { TaskRowBase } from "@/components/tasks/TaskRowBase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProgressCircle } from "@/components/progress-circle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { INITIAL_VISIBLE_TASKS_PER_PROJECT } from "@/lib/constants"
import { LazySection } from "@/components/tasks/LazySection"
import type { CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"

// Re-export types and utilities from task-filter-utils for backward compatibility
export type { TaskLike, ProjectLike, ProjectTaskGroup } from "./task-filter-utils"
export { filterTasksByChips, computeTaskFilterCounts, getTaskDescriptionSnippet } from "./task-filter-utils"
import { getTaskDescriptionSnippet, type TaskLike, type ProjectTaskGroup } from "./task-filter-utils"

export type ProjectTasksSectionProps = {
  group: ProjectTaskGroup
  onToggleTask: (taskId: string) => void
  onTitleClick?: (taskId: string) => void
  onAddTask: (context: CreateTaskContext) => void
  onEditTask?: (task: TaskLike) => void
  onDeleteTask?: (taskId: string) => void
}

export function ProjectTasksSection({ group, onToggleTask, onTitleClick, onAddTask, onEditTask, onDeleteTask }: ProjectTasksSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const { project, tasks } = group
  const total = tasks.length
  const done = tasks.filter((t) => t.status === "done").length
  const percent = total ? Math.round((done / total) * 100) : 0

  const visibleTasks = expanded || tasks.length <= INITIAL_VISIBLE_TASKS_PER_PROJECT
    ? tasks
    : tasks.slice(0, INITIAL_VISIBLE_TASKS_PER_PROJECT)
  const hiddenCount = tasks.length - visibleTasks.length

  return (
    <section className="max-w-6xl mx-auto rounded-3xl border border-border bg-muted shadow-[var(--shadow-workstream)] p-3 space-y-2">
      <header className="flex items-center justify-between gap-4 px-0 py-1">
        <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
          <FolderSimple className="h-5 w-5" weight="regular" />
        </div>
        <div className="flex-1 space-y-1">
          <span className="text-sm font-semibold leading-tight">{project.name}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {project.priority && (
              <span className="inline-flex items-center gap-1">
                <ChartBar className="h-3 w-3" weight="regular" />
                <span className="font-medium">{capitalize(project.priority)}</span>
              </span>
            )}
            {project.priority && <div className="h-4 w-px bg-border/70 hidden sm:inline" />}
            {project.typeLabel && project.durationLabel && (
              <>
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium hidden sm:inline">
                  {project.typeLabel} {project.durationLabel}
                </span>
                <div className="h-4 w-px bg-border/70 hidden sm:inline" />
              </>
            )}
            {project.status && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium hidden sm:inline">
                {getProjectStatusLabel(project.status)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">
            {done}/{total}
          </span>
          <ProgressCircle progress={percent} color="var(--chart-2)" size={18} />
          <div className="h-4 w-px bg-border/80" />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 rounded-full text-muted-foreground hover:bg-transparent"
            aria-label="Add task"
            onClick={() =>
              onAddTask({
                projectId: project.id,
                workstreamName: tasks[0]?.workstreamName || undefined,
              })
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="space-y-1 px-2 py-3 bg-background rounded-2xl border border-border">
        <SortableContext items={visibleTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {visibleTasks.map((task) => (
            <TaskRowDnD
              key={task.id}
              task={task}
              onToggle={() => onToggleTask(task.id)}
              onTitleClick={onTitleClick}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full text-center py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/60"
          >
            Show {hiddenCount} more task{hiddenCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    </section>
  )
}

export type TaskBadgesProps = {
  workstreamName?: string | null
  className?: string
}

export function TaskBadges({ workstreamName, className }: TaskBadgesProps) {
  if (!workstreamName) return null

  return (
    <Badge variant="muted" className={cn("whitespace-nowrap text-[11px]", className)}>
      {workstreamName}
    </Badge>
  )
}

export type TaskStatusProps = {
  status: TaskLike["status"]
}

export function TaskStatus({ status }: TaskStatusProps) {
  const label = getTaskStatusLabel(status)
  const color = getTaskStatusColor(status)

  return <span className={cn("font-medium", color)}>{label}</span>
}

function getProjectStatusLabel(status: string): string {
  const label = getProjectStatusLabelFromConstants(status as import("@/lib/constants/status").ProjectStatus)
  return label !== status ? label : capitalize(status)
}

export type TaskPriorityProps = {
  priority: string
  className?: string
}

export function TaskPriority({ priority, className }: TaskPriorityProps) {
  const label = getPriorityLabel(priority)

  return (
    <span className={cn("rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>
      {label}
    </span>
  )
}

function getPriorityLabel(priority: string): string {
  return getTaskPriorityLabel(priority as import("@/lib/constants/status").TaskPriority)
}

export type TaskRowDnDProps = {
  task: TaskLike
  onToggle: () => void
  onTitleClick?: (taskId: string) => void
  onEdit?: (task: TaskLike) => void
  onDelete?: (taskId: string) => void
}

export function TaskRowDnD({ task, onToggle, onTitleClick, onEdit, onDelete }: TaskRowDnDProps) {
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
        onTitleClick={onTitleClick ? () => onTitleClick(task.id) : undefined}
        titleAriaLabel={task.name}
        titleSuffix={<TaskBadges workstreamName={task.workstreamName} className="hidden sm:inline" />}
        subtitle={<div className="hidden sm:inline">{getTaskDescriptionSnippet(task)}</div>}
        meta={
          <>
            <TaskStatus status={task.status} />
            {task.startDate && (
              <span className="text-muted-foreground hidden sm:inline">
                Start: {format(task.startDate, "MMM d")}
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

export type ProjectTaskListViewProps = {
  groups: ProjectTaskGroup[]
  onToggleTask: (taskId: string) => void
  onTitleClick?: (taskId: string) => void
  onAddTask: (context: CreateTaskContext) => void
  onEditTask?: (task: TaskLike) => void
  onDeleteTask?: (taskId: string) => void
}

export function ProjectTaskListView({ groups, onToggleTask, onTitleClick, onAddTask, onEditTask, onDeleteTask }: ProjectTaskListViewProps) {
  return (
    <>
      {groups.map((group, index) => {
        const section = (
          <ProjectTasksSection
            key={group.project.id}
            group={group}
            onToggleTask={onToggleTask}
            onTitleClick={onTitleClick}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        )
        // First section renders immediately; subsequent ones defer until near-viewport
        if (index === 0) return section
        return (
          <LazySection key={group.project.id} estimatedHeight={220}>
            {section}
          </LazySection>
        )
      })}
    </>
  )
}
