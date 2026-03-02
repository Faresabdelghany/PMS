"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import { createAgentCommand } from "./agent-commands"
import { subscribeAgentToTask } from "./task-messages"
import { revalidatePath } from "next/cache"
import { CacheKeys, invalidate, invalidateCache } from "@/lib/cache"
import type { ActionResult } from "./types"
import type { TaskStatus } from "@/lib/supabase/types"

// ── Extended Types for Sprint 3 ─────────────────────────────────────

export type TaskType = "user" | "agent" | "recurring"
export type DispatchStatus = "pending" | "dispatched" | "running" | "completed" | "failed"

export interface OrgTaskWithRelations {
  id: string
  project_id: string
  name: string
  description: string | null
  status: TaskStatus
  priority: string
  tag: string | null
  assignee_id: string | null
  start_date: string | null
  end_date: string | null
  sort_order: number
  created_at: string
  updated_at: string
  // Sprint 3 new fields (optional until migration applied)
  assigned_agent_id?: string | null
  task_type?: TaskType
  dispatch_status?: DispatchStatus
  // Relations
  assignee?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  agent?: {
    id: string
    name: string
    role: string
    squad: string
    avatar_url: string | null
  } | null
  project?: {
    id: string
    name: string
    organization_id: string
  } | null
}

export interface OrgTaskStats {
  thisWeek: number
  inProgress: number
  total: number
  completionRate: number
  byStatus: Record<string, number>
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Get ALL tasks for an organization (across all projects)
 * Used by the Sprint 3 Mission Control Kanban board
 */
export async function getOrgTasks(
  orgId: string,
  filters?: {
    agentId?: string
    status?: TaskStatus
    taskType?: TaskType
    projectId?: string
  }
): Promise<ActionResult<OrgTaskWithRelations[]>> {
  const { supabase } = await requireAuth()

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles(id, full_name, email, avatar_url),
      agent:agents(id, name, role, squad, avatar_url),
      project:projects!inner(id, name, organization_id)
    `)
    .eq("project.organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(500)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.agentId) {
    query = query.eq("assigned_agent_id", filters.agentId)
  }
  if (filters?.taskType) {
    query = query.eq("task_type", filters.taskType)
  }
  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data: (data ?? []) as unknown as OrgTaskWithRelations[] }
}

/**
 * Get task stats for an organization (org-wide, not per-project)
 */
export async function getOrgTaskStats(orgId: string): Promise<ActionResult<OrgTaskStats>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      status,
      dispatch_status,
      created_at,
      project:projects!inner(organization_id)
    `)
    .eq("project.organization_id", orgId)

  if (error) {
    return { error: error.message }
  }

  const tasks = (data ?? []) as Array<{
    status: string
    dispatch_status: string | null
    created_at: string
  }>

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)

  const total = tasks.length
  const thisWeek = tasks.filter((t) => new Date(t.created_at) >= weekStart).length
  const inProgress = tasks.filter((t) => t.status === "in-progress").length
  const done = tasks.filter((t) => t.status === "done").length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  const byStatus: Record<string, number> = {}
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1
  }

  return {
    data: { thisWeek, inProgress, total, completionRate, byStatus },
  }
}

// ── Mutations ─────────────────────────────────────────────────────────

/**
 * Dispatch a task to an agent — creates an agent_command entry
 */
export async function dispatchTaskToAgent(
  orgId: string,
  taskId: string,
  agentId: string
): Promise<ActionResult<{ commandId: string }>> {
  const { user, supabase } = await requireAuth()

  // Get task details for the command payload
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, name, description, priority, status, project_id, assignee_id")
    .eq("id", taskId)
    .single()

  if (taskError || !task) {
    return { error: taskError?.message ?? "Task not found" }
  }

  // Update task with agent assignment and dispatch status
  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      assigned_agent_id: agentId,
      task_type: "agent" as const,
      dispatch_status: "dispatched" as const,
    })
    .eq("id", taskId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Create agent command
  const commandResult = await createAgentCommand(orgId, agentId, "run_task", {
    task_id: taskId,
    task_name: task.name,
    task_description: task.description,
    priority: task.priority,
  }, taskId)

  if (commandResult.error) {
    return { error: commandResult.error }
  }

  // Auto-subscribe the assigned agent to the task thread
  await subscribeAgentToTask(orgId, taskId, agentId)

  await invalidateCache.task({
    taskId,
    projectId: task.project_id,
    assigneeId: task.assignee_id,
    orgId,
  })
  await invalidate.key(CacheKeys.userTasks(user.id, orgId))
  revalidatePath("/tasks")

  return { data: { commandId: commandResult.data!.id } }
}

/**
 * Assign an agent to a task (without dispatching immediately)
 */
export async function assignAgentToTask(
  taskId: string,
  agentId: string | null
): Promise<ActionResult<void>> {
  const { supabase } = await requireAuth()

  // Fetch orgId + current agent in a single query
  const { data: taskRow } = await supabase
    .from("tasks")
    .select("assigned_agent_id, project_id, project:projects(organization_id)")
    .eq("id", taskId)
    .single()

  const hasAgentChanged = (taskRow?.assigned_agent_id ?? null) !== agentId

  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_agent_id: agentId,
      assignee_id: null,
      task_type: (agentId ? "agent" : "user") as "agent" | "user",
      ...(hasAgentChanged && { dispatch_status: "pending" as const }),
    })
    .eq("id", taskId)

  if (error) {
    return { error: error.message }
  }

  const orgId = (taskRow?.project as { organization_id?: string } | null)?.organization_id
  const projectId = taskRow?.project_id

  // Auto-subscribe the assigned agent to the task thread
  if (agentId && orgId) {
    await subscribeAgentToTask(orgId, taskId, agentId)
  }

  revalidatePath("/tasks")
  if (projectId && orgId) {
    await invalidateCache.task({ taskId, projectId, orgId })
  }
  return { data: undefined }
}
