/**
 * Centralized status constants for projects and tasks.
 * These values match the database ENUMs defined in supabase/migrations.
 */

// =============================================================================
// PROJECT STATUS
// =============================================================================

export const PROJECT_STATUSES = ["backlog", "planned", "active", "cancelled", "completed"] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  backlog: "Pre-Sales",
  planned: "Planned",
  active: "Active",
  cancelled: "Cancelled",
  completed: "Completed",
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  backlog: "text-muted-foreground",
  planned: "text-blue-500",
  active: "text-amber-500",
  cancelled: "text-red-500",
  completed: "text-emerald-500",
}

export const DEFAULT_PROJECT_STATUS: ProjectStatus = "planned"

// =============================================================================
// TASK STATUS
// =============================================================================

export const TASK_STATUSES = ["todo", "in-progress", "done"] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In Progress",
  done: "Done",
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "text-muted-foreground",
  "in-progress": "text-amber-500",
  done: "text-emerald-500",
}

export const DEFAULT_TASK_STATUS: TaskStatus = "todo"

// =============================================================================
// PROJECT PRIORITY
// =============================================================================

export const PROJECT_PRIORITIES = ["urgent", "high", "medium", "low"] as const

export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export const DEFAULT_PROJECT_PRIORITY: ProjectPriority = "medium"

// =============================================================================
// TASK PRIORITY
// =============================================================================

export const TASK_PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  "no-priority": "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export const DEFAULT_TASK_PRIORITY: TaskPriority = "medium"

// =============================================================================
// CLIENT STATUS
// =============================================================================

export const CLIENT_STATUSES = ["prospect", "active", "on_hold", "archived"] as const

export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  on_hold: "On Hold",
  archived: "Archived",
}

export const DEFAULT_CLIENT_STATUS: ClientStatus = "active"

// =============================================================================
// DELIVERABLE STATUS
// =============================================================================

export const DELIVERABLE_STATUSES = ["pending", "in_progress", "completed"] as const

export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status] ?? status
}

export function getProjectStatusColor(status: ProjectStatus): string {
  return PROJECT_STATUS_COLORS[status] ?? "text-muted-foreground"
}

export function getTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status
}

export function getTaskStatusColor(status: TaskStatus): string {
  return TASK_STATUS_COLORS[status] ?? "text-muted-foreground"
}

export function getTaskPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITY_LABELS[priority] ?? "No priority"
}

export function getProjectPriorityLabel(priority: ProjectPriority): string {
  return PROJECT_PRIORITY_LABELS[priority] ?? priority
}

export function getClientStatusLabel(status: ClientStatus): string {
  return CLIENT_STATUS_LABELS[status] ?? status
}

// =============================================================================
// INITIAL COUNT OBJECTS (for stats initialization)
// =============================================================================

export function createProjectStatusCounts(): Record<ProjectStatus, number> {
  return {
    backlog: 0,
    planned: 0,
    active: 0,
    cancelled: 0,
    completed: 0,
  }
}

export function createTaskStatusCounts(): Record<TaskStatus, number> {
  return {
    todo: 0,
    "in-progress": 0,
    done: 0,
  }
}

export function createProjectPriorityCounts(): Record<ProjectPriority, number> {
  return {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
}

export function createTaskPriorityCounts(): Record<TaskPriority, number> {
  return {
    "no-priority": 0,
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  }
}

export function createClientStatusCounts(): Record<ClientStatus, number> {
  return {
    prospect: 0,
    active: 0,
    on_hold: 0,
    archived: 0,
  }
}
