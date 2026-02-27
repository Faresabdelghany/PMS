"use server"

import type { Task, TaskStatus, TaskPriority } from "@/lib/supabase/types"

export type TaskFilters = {
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  workstreamId?: string
  search?: string
}

export type TaskWithRelations = Task & {
  parent_task_id?: string | null
  source?: "manual" | "agent" | "speckit" | "system"
  subtask_count?: number
  done_subtask_count?: number
  parent?: { id: string; name: string } | null
  subtasks?: Array<{
    id: string
    name: string
    status: TaskStatus
    assignee_id: string | null
    assigned_agent_id?: string | null
    dispatch_status?: "pending" | "dispatched" | "running" | "completed" | "failed"
  }>
  assignee?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  workstream?: {
    id: string
    name: string
  } | null
  project?: {
    id: string
    name: string
  } | null
}
