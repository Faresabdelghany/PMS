import { format, differenceInDays, isPast, isToday } from "date-fns"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { Workstream } from "@/lib/supabase/types"
import type {
  User,
  WorkstreamTask,
  WorkstreamGroup,
  ProjectTask,
  WorkstreamTaskStatus,
} from "@/lib/data/project-details"

/**
 * Converts a Supabase task to the UI WorkstreamTask type
 */
export function toWorkstreamTask(task: TaskWithRelations): WorkstreamTask {
  const assignee = task.assignee
    ? {
        id: task.assignee.id,
        name: task.assignee.full_name?.trim() || task.assignee.email,
        avatarUrl: task.assignee.avatar_url || undefined,
      }
    : undefined

  const { dueLabel, dueTone } = computeDueInfo(task.end_date)

  return {
    id: task.id,
    name: task.name,
    status: task.status as WorkstreamTaskStatus,
    dueLabel,
    dueTone,
    assignee,
    startDate: task.start_date ? new Date(task.start_date) : undefined,
    priority: task.priority,
    tag: task.tag || undefined,
    description: task.description || undefined,
  }
}

/**
 * Converts a Supabase task to the UI ProjectTask type (includes project/workstream info)
 */
export function toProjectTask(
  task: TaskWithRelations,
  projectName?: string,
  workstreamName?: string
): ProjectTask {
  const base = toWorkstreamTask(task)

  return {
    ...base,
    projectId: task.project_id,
    projectName: projectName || task.project?.name || "",
    workstreamId: task.workstream_id || "",
    workstreamName: workstreamName || task.workstream?.name || "No Workstream",
  }
}

/**
 * Converts Supabase workstreams and tasks to UI WorkstreamGroup format
 */
export function toWorkstreamGroups(
  workstreams: Workstream[],
  tasks: TaskWithRelations[]
): WorkstreamGroup[] {
  // Create a map of workstream ID to tasks
  const tasksByWorkstream = new Map<string, TaskWithRelations[]>()

  // Initialize with empty arrays for each workstream
  for (const ws of workstreams) {
    tasksByWorkstream.set(ws.id, [])
  }

  // Group tasks by workstream
  for (const task of tasks) {
    if (task.workstream_id) {
      const existing = tasksByWorkstream.get(task.workstream_id) || []
      existing.push(task)
      tasksByWorkstream.set(task.workstream_id, existing)
    }
  }

  // Convert to WorkstreamGroup format
  return workstreams.map((ws) => ({
    id: ws.id,
    name: ws.name,
    tasks: (tasksByWorkstream.get(ws.id) || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toWorkstreamTask),
  }))
}

/**
 * Computes due label and tone based on end date
 */
function computeDueInfo(endDate: string | null): {
  dueLabel?: string
  dueTone?: "danger" | "warning" | "muted"
} {
  if (!endDate) {
    return {}
  }

  const due = new Date(endDate)
  const today = new Date()
  const daysUntil = differenceInDays(due, today)

  let dueLabel: string
  let dueTone: "danger" | "warning" | "muted" | undefined

  if (isToday(due)) {
    dueLabel = "Due today"
    dueTone = "warning"
  } else if (isPast(due)) {
    dueLabel = `Overdue (${format(due, "MMM d")})`
    dueTone = "danger"
  } else if (daysUntil <= 3) {
    dueLabel = `Due ${format(due, "EEE")}`
    dueTone = "warning"
  } else if (daysUntil <= 7) {
    dueLabel = `Due ${format(due, "MMM d")}`
    dueTone = "muted"
  } else {
    dueLabel = format(due, "MMM d")
    dueTone = undefined
  }

  return { dueLabel, dueTone }
}

