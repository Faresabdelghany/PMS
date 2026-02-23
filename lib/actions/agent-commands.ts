"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import { z } from "zod"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export type AgentCommandType = "run_task" | "ping" | "pause" | "resume" | "cancel"
export type AgentCommandStatus = "pending" | "picked_up" | "completed" | "failed"

export interface AgentCommand {
  id: string
  organization_id: string
  agent_id: string
  task_id: string | null
  command_type: AgentCommandType
  payload: Record<string, unknown>
  status: AgentCommandStatus
  picked_up_at: string | null
  completed_at: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface AgentCommandWithAgent extends AgentCommand {
  agent?: {
    id: string
    name: string
    role: string
    squad: string
  } | null
}

// ── Validation ───────────────────────────────────────────────────────

const createCommandSchema = z.object({
  agent_id: z.string().uuid("Invalid agent ID"),
  command_type: z.enum(["run_task", "ping", "pause", "resume", "cancel"]),
  payload: z.record(z.unknown()).default({}),
  task_id: z.string().uuid().optional().nullable(),
})

// ── Actions ──────────────────────────────────────────────────────────

/**
 * Create an agent command (PMS → OpenClaw channel)
 */
export async function createAgentCommand(
  orgId: string,
  agentId: string,
  commandType: AgentCommandType,
  payload?: Record<string, unknown>,
  taskId?: string | null
): Promise<ActionResult<AgentCommand>> {
  const { supabase } = await requireAuth()

  const parsed = createCommandSchema.safeParse({
    agent_id: agentId,
    command_type: commandType,
    payload: payload ?? {},
    task_id: taskId,
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid command data" }
  }

  const { data, error } = await supabase
    .from("agent_commands")
    .insert({
      organization_id: orgId,
      agent_id: parsed.data.agent_id,
      command_type: parsed.data.command_type,
      payload: parsed.data.payload as Record<string, unknown>,
      task_id: parsed.data.task_id ?? null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as AgentCommand }
}

/**
 * Ping an agent with an optional message
 */
export async function pingAgent(
  orgId: string,
  agentId: string,
  message: string
): Promise<ActionResult<AgentCommand>> {
  return createAgentCommand(orgId, agentId, "ping", { message })
}

/**
 * Get agent commands with optional filters
 */
export async function getAgentCommands(
  orgId: string,
  filters?: {
    agentId?: string
    taskId?: string
    status?: AgentCommandStatus
    limit?: number
  }
): Promise<ActionResult<AgentCommandWithAgent[]>> {
  const { supabase } = await requireAuth()

  let query = supabase
    .from("agent_commands")
    .select(`
      *,
      agent:agents(id, name, role, squad)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (filters?.agentId) {
    query = query.eq("agent_id", filters.agentId)
  }
  if (filters?.taskId) {
    query = query.eq("task_id", filters.taskId)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  query = query.limit(filters?.limit ?? 50)

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  return { data: (data ?? []) as AgentCommandWithAgent[] }
}

/**
 * Cancel a pending command
 */
export async function cancelAgentCommand(
  orgId: string,
  commandId: string
): Promise<ActionResult<AgentCommand>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agent_commands")
    .update({ status: "failed", error: "Cancelled by user" })
    .eq("id", commandId)
    .eq("organization_id", orgId)
    .eq("status", "pending") // Only cancel pending commands
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: data as AgentCommand }
}
