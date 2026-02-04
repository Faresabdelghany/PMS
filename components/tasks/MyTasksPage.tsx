"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { Plus, Sparkle } from "@phosphor-icons/react/dist/ssr"
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
  MeasuringStrategy,
} from "@dnd-kit/core"
import {
  arrayMove,
} from "@dnd-kit/sortable"

import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { ProjectWithRelations } from "@/lib/actions/projects"
import type { TaskPriority } from "@/lib/supabase/types"
import type { ProjectTask } from "@/lib/data/project-details"
import type { TaskData } from "@/components/tasks/TaskQuickCreateModal"

// Extended project type that includes workstreams for task creation modal
type ProjectWithWorkstreams = ProjectWithRelations & {
  workstreams?: { id: string; name: string }[]
}

// Valid TaskPriority values for type checking
const VALID_PRIORITIES: TaskPriority[] = ["no-priority", "low", "medium", "high", "urgent"]

// Convert TaskLike to TaskData for the TaskQuickCreateModal
function toTaskData(task: TaskLike): TaskData {
  const priority = task.priority && VALID_PRIORITIES.includes(task.priority as TaskPriority)
    ? (task.priority as TaskPriority)
    : undefined

  return {
    id: task.id,
    name: task.name,
    status: task.status,
    priority,
    tag: task.tag ?? undefined,
    assignee: task.assignee ? { id: "", name: task.assignee.name, avatarUrl: task.assignee.avatarUrl ?? null } : undefined,
    startDate: task.startDate ?? undefined,
    endDate: task.endDate ?? undefined,
    dueLabel: task.dueLabel ?? undefined,
    description: task.description ?? undefined,
    projectId: task.projectId || "",
    projectName: task.projectName || "Unknown Project",
    workstreamId: task.workstreamId ?? undefined,
    workstreamName: task.workstreamName ?? undefined,
  }
}

// Convert TaskLike to ProjectTask for the TaskWeekBoardView
function toProjectTask(task: TaskLike): ProjectTask {
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    priority: task.priority && VALID_PRIORITIES.includes(task.priority as TaskPriority)
      ? (task.priority as TaskPriority)
      : undefined,
    tag: task.tag ?? undefined,
    assignee: task.assignee ? { id: "", name: task.assignee.name, avatarUrl: task.assignee.avatarUrl ?? undefined } : undefined,
    startDate: task.startDate ?? undefined,
    endDate: task.endDate ?? undefined,
    dueLabel: task.dueLabel ?? undefined,
    description: task.description ?? undefined,
    projectId: task.projectId || "",
    projectName: task.projectName || "Unknown Project",
    workstreamId: task.workstreamId || "",
    workstreamName: task.workstreamName || "",
  }
}

import { deleteTask, updateTask, updateTaskStatus, reorderTasks } from "@/lib/actions/tasks"
import { DEFAULT_VIEW_OPTIONS, type FilterChip as FilterChipType, type ViewOptions } from "@/lib/view-options"
import type { FilterCounts } from "@/lib/data/projects"
import { TaskWeekBoardView } from "@/components/tasks/TaskWeekBoardView"
import {
  ProjectTaskListView,
  filterTasksByChips,
  computeTaskFilterCounts,
  type TaskLike,
  type ProjectTaskGroup,
} from "@/components/tasks/task-helpers"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
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
import { FilterPopover, type MemberOption, type TagOption } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { ViewOptionsPopover } from "@/components/view-options-popover"
import { TaskQuickCreateModal, type CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"
import type { OrganizationTag } from "@/lib/supabase/types"
import { formatDueLabel } from "@/lib/date-utils"
import { toast } from "sonner"
import { usePooledRealtime } from "@/hooks/realtime-context"
import type { Database } from "@/lib/supabase/types"

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]

// Re-export TaskLike as UITask for backward compatibility
export type UITask = TaskLike

// Convert Supabase task to UI format
function toUITask(task: TaskWithRelations): TaskLike {
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
    startDate: task.start_date ? new Date(task.start_date) : null,
    endDate: task.end_date ? new Date(task.end_date) : null,
    dueLabel: task.end_date ? formatDueLabel(new Date(task.end_date)) : null,
    projectId: task.project?.id || "",
    projectName: task.project?.name || "Unknown Project",
    workstreamId: task.workstream?.id || null,
    workstreamName: task.workstream?.name || null,
    description: task.description || null,
  }
}

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

interface MyTasksPageProps {
  initialTasks?: TaskWithRelations[]
  projects?: ProjectWithWorkstreams[]
  organizationId?: string
  userId?: string
  organizationMembers?: OrganizationMember[]
  organizationTags?: OrganizationTag[]
}

export function MyTasksPage({
  initialTasks = [],
  projects = [],
  organizationId,
  userId,
  organizationMembers = [],
  organizationTags = [],
}: MyTasksPageProps) {
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [filters, setFilters] = useState<FilterChipType[]>([])
  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS)

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [createContext, setCreateContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingTask, setEditingTask] = useState<UITask | undefined>(undefined)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Store refs to projects and members for use in realtime callbacks
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const membersRef = useRef(organizationMembers)
  membersRef.current = organizationMembers

  // Helper to build TaskWithRelations from raw task data
  const buildTaskWithRelations = useCallback((task: TaskRow): TaskWithRelations | null => {
    // Only include tasks assigned to current user
    if (task.assignee_id !== userId) return null

    const project = projectsRef.current.find(p => p.id === task.project_id)
    if (!project) return null // Task must belong to a known project

    const workstream = project.workstreams?.find(w => w.id === task.workstream_id)
    const assignee = membersRef.current.find(m => m.user_id === task.assignee_id)

    return {
      ...task,
      project: { id: project.id, name: project.name },
      workstream: workstream ? { id: workstream.id, name: workstream.name } : null,
      assignee: assignee ? {
        id: assignee.user_id,
        full_name: assignee.profile.full_name,
        email: assignee.profile.email,
        avatar_url: assignee.profile.avatar_url,
      } : null,
    }
  }, [userId])

  // Real-time subscription for tasks assigned to current user
  usePooledRealtime({
    table: "tasks",
    filter: userId ? `assignee_id=eq.${userId}` : undefined,
    enabled: !!organizationId && !!userId,
    onInsert: (task: TaskRow) => {
      const fullTask = buildTaskWithRelations(task)
      if (fullTask) {
        setTasks(prev => {
          // Avoid duplicates
          if (prev.some(t => t.id === fullTask.id)) return prev
          return [fullTask, ...prev]
        })
      }
    },
    onUpdate: (task: TaskRow) => {
      setTasks(prev => {
        const fullTask = buildTaskWithRelations(task)
        if (!fullTask) return prev

        const existingIndex = prev.findIndex(t => t.id === task.id)
        if (existingIndex >= 0) {
          // Update existing task
          return prev.map(t => t.id === task.id ? fullTask : t)
        } else {
          // Task was newly assigned to user, add it
          return [fullTask, ...prev]
        }
      })
    },
    onDelete: (task: TaskRow) => {
      setTasks(prev => prev.filter(t => t.id !== task.id))
    },
  })

  // Group tasks by project
  const groups = useMemo<ProjectTaskGroup[]>(() => {
    const projectMap = new Map<string, ProjectTaskGroup>()

    for (const task of tasks) {
      const projectId = task.project?.id
      if (!projectId) continue

      if (!projectMap.has(projectId)) {
        const project = projects.find(p => p.id === projectId)
        projectMap.set(projectId, {
          project: {
            id: projectId,
            name: task.project?.name || "Unknown Project",
            progress: project?.progress || 0,
            status: project?.status || "active",
          },
          tasks: [],
        })
      }

      projectMap.get(projectId)!.tasks.push(toUITask(task))
    }

    return Array.from(projectMap.values())
  }, [tasks, projects])

  const counts = useMemo<FilterCounts>(() => {
    const allTasks = groups.flatMap((g) => g.tasks)
    return computeTaskFilterCounts(allTasks)
  }, [groups])

  // Build member options for filter from organization members
  const filterMembers = useMemo<MemberOption[]>(() => {
    return organizationMembers.map((member) => ({
      id: member.user_id,
      label: member.profile.full_name || member.profile.email,
      avatar: member.profile.avatar_url,
    }))
  }, [organizationMembers])

  // Extract unique tags from tasks for filter
  const filterTags = useMemo<TagOption[]>(() => {
    const tagSet = new Set<string>()
    for (const task of tasks) {
      if (task.tag) tagSet.add(task.tag)
    }
    return Array.from(tagSet).map((tag) => ({
      id: tag.toLowerCase(),
      label: tag,
    }))
  }, [tasks])

  const visibleGroups = useMemo<ProjectTaskGroup[]>(() => {
    if (!filters.length) return groups

    return groups
      .map((group) => ({
        project: group.project,
        tasks: filterTasksByChips(group.tasks, filters),
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, filters])

  const allVisibleTasks = useMemo<TaskLike[]>(() => {
    return visibleGroups.flatMap((group) => group.tasks)
  }, [visibleGroups])

  // Memoize project options for TaskQuickCreateModal to prevent re-renders
  const projectOptions = useMemo(() =>
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      workstreams: p.workstreams?.map((ws) => ({
        id: ws.id,
        name: ws.name,
      })),
    })),
    [projects]
  )

  const openCreateTask = (context?: CreateTaskContext) => {
    setEditingTask(undefined)
    setCreateContext(context)
    setIsCreateTaskOpen(true)
  }

  const openEditTask = (task: UITask) => {
    setEditingTask(task)
    setCreateContext(undefined)
    setIsCreateTaskOpen(true)
  }

  const handleTaskCreated = useCallback((task: UITask) => {
    // The task will be added via real-time subscription or we add it optimistically
    const projectId = task.projectId || ""
    const projectName = task.projectName || "Unknown Project"
    const priority: TaskPriority = task.priority && VALID_PRIORITIES.includes(task.priority as TaskPriority)
      ? (task.priority as TaskPriority)
      : "no-priority"

    setTasks((prev) => {
      // Create a TaskWithRelations-like object for the new task
      const newTask: TaskWithRelations = {
        id: task.id,
        name: task.name,
        status: task.status,
        priority,
        tag: task.tag || null,
        description: task.description || null,
        start_date: task.startDate?.toISOString().split('T')[0] || null,
        end_date: task.endDate?.toISOString().split('T')[0] || null,
        project_id: projectId,
        workstream_id: task.workstreamId || null,
        assignee_id: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project: { id: projectId, name: projectName },
        workstream: task.workstreamId ? { id: task.workstreamId, name: task.workstreamName || "" } : null,
        assignee: task.assignee ? {
          id: "",
          full_name: task.assignee.name,
          email: "",
          avatar_url: task.assignee.avatarUrl || null
        } : null,
      }
      return [...prev, newTask]
    })
  }, [])

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

  const changeTaskTag = useCallback(async (taskId: string, tagLabel?: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, tag: tagLabel || null } : t
      )
    )

    const result = await updateTask(taskId, { tag: tagLabel || null })
    if (result.error) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, tag: task.tag } : t
        )
      )
      toast.error("Failed to update task tag")
    }
  }, [tasks])

  const moveTaskDate = useCallback(async (taskId: string, newDate: Date) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const dateStr = newDate.toISOString().split('T')[0]

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, start_date: dateStr } : t
      )
    )

    const result = await updateTask(taskId, { start_date: dateStr })
    if (result.error) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, start_date: task.start_date } : t
        )
      )
      toast.error("Failed to update task date")
    }
  }, [tasks])

  const handleTaskUpdated = useCallback((updated: UITask) => {
    const priority: TaskPriority = updated.priority && VALID_PRIORITIES.includes(updated.priority as TaskPriority)
      ? (updated.priority as TaskPriority)
      : "no-priority"

    setTasks((prev) =>
      prev.map((t) =>
        t.id === updated.id
          ? {
              ...t,
              name: updated.name,
              status: updated.status,
              priority,
              tag: updated.tag || null,
              description: updated.description || null,
              start_date: updated.startDate?.toISOString().split('T')[0] || null,
              end_date: updated.endDate?.toISOString().split('T')[0] || null,
            }
          : t
      )
    )
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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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
    const taskIds = reorderedTasks.map(t => t.id)

    // Optimistic update - update the sort order in local state
    // The actual reordering happens via the reorderTasks action
    const projectId = activeGroup.project.id
    const task = tasks.find(t => t.id === active.id)

    if (task) {
      await reorderTasks(task.workstream_id || null, projectId, taskIds)
    }
  }, [groups, tasks])

  if (!groups.length) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/70">
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
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-foreground">No tasks assigned to you</p>
            <p className="text-xs text-muted-foreground">
              Tasks assigned to you will appear here.
            </p>
          </div>
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
          editingTask={editingTask ? toTaskData(editingTask) : undefined}
          onTaskUpdated={handleTaskUpdated}
          projects={projectOptions}
          organizationMembers={organizationMembers}
          tags={organizationTags}
        />
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
              members={filterMembers}
              tags={filterTags}
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
              groups={visibleGroups}
              onToggleTask={toggleTask}
              onAddTask={(context) => openCreateTask(context)}
              onEditTask={openEditTask}
              onDeleteTask={(taskId) => setTaskToDelete(taskId)}
            />
          </DndContext>
        )}
        {viewOptions.viewType === "board" && (
          <TaskWeekBoardView
            tasks={allVisibleTasks.map(toProjectTask)}
            onAddTask={(context) => openCreateTask(context)}
            onToggleTask={toggleTask}
            onChangeTag={changeTaskTag}
            onMoveTaskDate={moveTaskDate}
            onOpenTask={(task) => openEditTask(task)}
            tags={organizationTags}
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
        editingTask={editingTask ? toTaskData(editingTask) : undefined}
        onTaskUpdated={handleTaskUpdated}
        projects={projectOptions}
        organizationMembers={organizationMembers}
        tags={organizationTags}
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
    </div>
  )
}
