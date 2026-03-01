// Barrel file — re-exports all task actions for backward-compatible imports
// Import from "@/lib/actions/tasks" resolves here

export type { TaskFilters, TaskWithRelations } from "./types"
export type { PaginatedResult } from "../types"
export { getTasks, getMyTasks, getAllTasks, getTask, getSubtasks, getTaskStats } from "./queries"
export { createTask, updateTask, updateTaskStatus, updateTaskAssignee, deleteTask } from "./mutations"
export { reorderTasks, moveTaskToWorkstream } from "./reorder"
export { bulkUpdateTaskStatus } from "./bulk"
