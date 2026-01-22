"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { format } from "date-fns"
import { ChartBar, DotsSixVertical, FolderSimple, Plus, Sparkle } from "@phosphor-icons/react/dist/ssr"
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

import type { Project, FilterCounts } from "@/lib/data/projects"
import type { ProjectTask } from "@/lib/data/project-details"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { ProjectWithRelations } from "@/lib/actions/projects"
import { updateTaskStatus, reorderTasks, updateTask } from "@/lib/actions/tasks"
import { toProjectTask } from "@/lib/utils/task-converters"
import { DEFAULT_VIEW_OPTIONS, type FilterChip as FilterChipType, type ViewOptions } from "@/lib/view-options"
import { TaskWeekBoardView } from "@/components/tasks/TaskWeekBoardView"
import {
  ProjectTaskGroup,
  ProjectTaskListView,
  filterTasksByChips,
  computeTaskFilterCounts,
} from "@/components/tasks/task-helpers"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { FilterPopover } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { ViewOptionsPopover } from "@/components/view-options-popover"
import { TaskQuickCreateModal, type CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"

type MyTasksPageProps = {
  tasks: TaskWithRelations[]
  projects: ProjectWithRelations[]
  workstreamsByProject: Record<string, { id: string; name: string }[]>
  organizationId: string
}

export function MyTasksPage({
  tasks: initialTasks,
  projects,
  workstreamsByProject,
  organizationId,
}: MyTasksPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Convert Supabase tasks to UI format
  const convertedTasks = useMemo(() => {
    return initialTasks.map((task) => {
      const project = projects.find((p) => p.id === task.project_id)
      const workstream = task.workstream_id
        ? workstreamsByProject[task.project_id]?.find((ws) => ws.id === task.workstream_id)
        : undefined
      return toProjectTask(task, project?.name, workstream?.name)
    })
  }, [initialTasks, projects, workstreamsByProject])

  // Group tasks by project
  const [groups, setGroups] = useState<ProjectTaskGroup[]>(() => {
    const projectMap = new Map<string, ProjectTask[]>()

    for (const task of convertedTasks) {
      const existing = projectMap.get(task.projectId) || []
      existing.push(task)
      projectMap.set(task.projectId, existing)
    }

    const result: ProjectTaskGroup[] = []

    for (const [projectId, projectTasks] of projectMap.entries()) {
      const project = projects.find((p) => p.id === projectId)
      if (!project) continue

      const projectData: Project = {
        id: project.id,
        name: project.name,
        status: project.status,
        priority: project.priority,
        progress: project.progress,
        typeLabel: project.type_label || undefined,
        durationLabel: undefined,
        client: project.client?.name,
        members: project.members?.map((m) =>
          m.profile?.full_name || m.profile?.email || "Unknown"
        ) || [],
        taskCount: projectTasks.length,
        startDate: project.start_date ? new Date(project.start_date) : new Date(),
        endDate: project.end_date ? new Date(project.end_date) : new Date(),
        tags: project.tags || [],
        tasks: [],
      }

      result.push({
        project: projectData,
        tasks: projectTasks,
      })
    }

    return result
  })

  const [filters, setFilters] = useState<FilterChipType[]>([])
  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS)

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [createContext, setCreateContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined)

  // Subscribe to real-time task changes for user's tasks
  useRealtime({
    table: "tasks",
    event: "*",
    enabled: true,
    onUpdate: (updatedTask) => {
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          tasks: group.tasks.map((task) =>
            task.id === updatedTask.id
              ? {
                  ...task,
                  name: updatedTask.name,
                  status: updatedTask.status,
                  tag: updatedTask.tag || undefined,
                }
              : task
          ),
        }))
      )
    },
    onDelete: (deletedTask) => {
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          tasks: group.tasks.filter((task) => task.id !== deletedTask.id),
        }))
      )
    },
  })

  const counts = useMemo<FilterCounts>(() => {
    const allTasks = groups.flatMap((g) => g.tasks)
    return computeTaskFilterCounts(allTasks)
  }, [groups])

  const visibleGroups = useMemo<ProjectTaskGroup[]>(() => {
    if (!filters.length) return groups

    return groups
      .map((group) => ({
        project: group.project,
        tasks: filterTasksByChips(group.tasks, filters),
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, filters])

  const allVisibleTasks = useMemo<ProjectTask[]>(() => {
    return visibleGroups.flatMap((group) => group.tasks)
  }, [visibleGroups])

  const openCreateTask = (context?: CreateTaskContext) => {
    setEditingTask(undefined)
    setCreateContext(context)
    setIsCreateTaskOpen(true)
  }

  const openEditTask = (task: ProjectTask) => {
    setEditingTask(task)
    setCreateContext(undefined)
    setIsCreateTaskOpen(true)
  }

  const handleTaskCreated = (task: ProjectTask) => {
    // Add to local state directly
    setGroups((prev) => {
      const groupIndex = prev.findIndex((g) => g.project.id === task.projectId)
      if (groupIndex === -1) return prev

      return prev.map((group, idx) =>
        idx === groupIndex
          ? { ...group, tasks: [task, ...group.tasks] }
          : group
      )
    })
  }

  const toggleTask = async (taskId: string) => {
    // Find the task
    let foundTask: ProjectTask | undefined
    let foundGroupIndex = -1
    groups.forEach((group, index) => {
      const task = group.tasks.find((t) => t.id === taskId)
      if (task) {
        foundTask = task
        foundGroupIndex = index
      }
    })

    if (!foundTask || foundGroupIndex === -1) return

    const newStatus = foundTask.status === "done" ? "todo" : "done"

    // Optimistic update
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId ? { ...task, status: newStatus } : task
        ),
      }))
    )

    // Server update
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, newStatus)
      if (result.error) {
        toast.error("Failed to update task status")
        // Revert optimistic update
        setGroups((prev) =>
          prev.map((group) => ({
            ...group,
            tasks: group.tasks.map((task) =>
              task.id === taskId ? { ...task, status: foundTask!.status } : task
            ),
          }))
        )
      }
    })
  }

  const changeTaskTag = async (taskId: string, tagLabel?: string) => {
    // Optimistic update
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId ? { ...task, tag: tagLabel } : task
        ),
      }))
    )

    // Server update
    startTransition(async () => {
      const result = await updateTask(taskId, { tag: tagLabel || null })
      if (result.error) {
        toast.error("Failed to update task tag")
        // Revert optimistic update on error
        router.refresh()
      }
    })
  }

  const moveTaskDate = async (taskId: string, newDate: Date) => {
    // Optimistic update
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId ? { ...task, startDate: newDate } : task
        ),
      }))
    )

    // Server update
    startTransition(async () => {
      const result = await updateTask(taskId, {
        start_date: newDate.toISOString(),
      })
      if (result.error) {
        toast.error("Failed to update task date")
        // Revert optimistic update on error
        router.refresh()
      }
    })
  }

  const handleTaskUpdated = (updated: ProjectTask) => {
    // Update local state directly
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === updated.id ? updated : task
        ),
      }))
    )
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // Find the group containing the active task
    const activeGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === active.id)
    )

    if (activeGroupIndex === -1) return

    const activeGroup = groups[activeGroupIndex]

    // Find the group containing the over task
    const overGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === over.id)
    )

    if (overGroupIndex === -1) return

    // For now, only allow reordering within the same group
    if (activeGroupIndex !== overGroupIndex) return

    const activeIndex = activeGroup.tasks.findIndex((task) => task.id === active.id)
    const overIndex = activeGroup.tasks.findIndex((task) => task.id === over.id)

    if (activeIndex === -1 || overIndex === -1) return

    const reorderedTasks = arrayMove(activeGroup.tasks, activeIndex, overIndex)

    // Optimistic update
    setGroups((prev) =>
      prev.map((group, index) =>
        index === activeGroupIndex ? { ...group, tasks: reorderedTasks } : group
      )
    )

    // Server update
    startTransition(async () => {
      const workstreamId = activeGroup.tasks[activeIndex]?.workstreamId || null
      const taskIds = reorderedTasks
        .filter((t) => t.workstreamId === workstreamId)
        .map((t) => t.id)

      const result = await reorderTasks(workstreamId, activeGroup.project.id, taskIds)
      if (result.error) {
        toast.error("Failed to reorder tasks")
        // Revert optimistic update on error
        router.refresh()
      }
    })
  }

  if (!visibleGroups.length) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/70">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
            <p className="text-xs text-muted-foreground">No tasks assigned to you yet.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => openCreateTask()}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex flex-col border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openCreateTask()}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-3 pt-3">
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
              maxVisible={6}
            />
          </div>
          <div className="flex items-center gap-2">
            <ViewOptionsPopover options={viewOptions} onChange={setViewOptions} allowedViewTypes={["list", "board"]} />
            <div className="relative">
              <div className="relative rounded-xl border border-border bg-card/80 shadow-sm overflow-hidden">
                <Button className="h-8 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 relative z-10 px-3">
                  <Sparkle className="h-4 w-4" weight="fill" />
                  Ask AI
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
        {viewOptions.viewType === "list" && (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <ProjectTaskListView
              groups={visibleGroups}
              onToggleTask={toggleTask}
              onAddTask={(context) => openCreateTask(context)}
            />
          </DndContext>
        )}
        {viewOptions.viewType === "board" && (
          <TaskWeekBoardView
            tasks={allVisibleTasks}
            onAddTask={(context) => openCreateTask(context)}
            onToggleTask={toggleTask}
            onChangeTag={changeTaskTag}
            onMoveTaskDate={moveTaskDate}
            onOpenTask={openEditTask}
          />
        )}
      </div>

      <TaskQuickCreateModal
        open={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false)
          setEditingTask(undefined)
          setCreateContext(undefined)
        }}
        context={editingTask ? undefined : createContext}
        onTaskCreated={handleTaskCreated}
        editingTask={editingTask}
        onTaskUpdated={handleTaskUpdated}
        projects={projects}
        workstreamsByProject={workstreamsByProject}
        organizationId={organizationId}
      />
    </div>
  )
}
