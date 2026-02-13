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
