"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "./auth-helpers"
import { z } from "zod"
import type { ActionResult } from "./types"
import { createAgentCommand } from "./agent-commands"

// ── Types ────────────────────────────────────────────────────────────

export type SessionStatus = "running" | "blocked" | "waiting" | "completed"

export interface AgentSession {
  id: string
  organization_id: string
  agent_id: string
  task_id: string | null
  status: SessionStatus
  started_at: string
  ended_at: string | null  // not in DB; kept for UI compat — maps to updated_at for completed sessions
  input_tokens: number
  output_tokens: number
  error_msg: string | null
  blocker_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentSessionWithAgent extends AgentSession {
  agent?: { id: string; name: string; role: string; avatar_url: string | null } | null
  task?: { id: string; name: string } | null
}

// ── Validation ───────────────────────────────────────────────────────

const createSessionSchema = z.object({
  agent_id: z.string().uuid("Invalid agent ID"),
  task_id: z.string().uuid("Invalid task ID").optional().nullable(),
  instructions: z.string().max(5000).optional().nullable(),
})

const updateStatusSchema = z.object({
  status: z.enum(["running", "blocked", "waiting", "completed"]),
  metadata: z.record(z.unknown()).optional(),
})

// ── Actions ──────────────────────────────────────────────────────────

/**
 * List sessions with optional filters, ordered by created_at DESC.
 * Fetches sessions first, then resolves agent/task relations separately
 * to avoid PostgREST join issues with tables not in the generated types.
 */
export async function getSessions(
  orgId: string,
  filters?: {
    status?: SessionStatus
    agentId?: string
    limit?: number
  }
): Promise<ActionResult<AgentSessionWithAgent[]>> {
  const { supabase } = await requireAuth()

  let query = supabase
    .from("agent_sessions" as any)
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.agentId) {
    query = query.eq("agent_id", filters.agentId)
  }

  query = query.limit(filters?.limit ?? 50)

  const { data, error } = await query

  if (error) return { error: error.message }

  const rows = (data ?? []) as any[]

  if (rows.length === 0) return { data: [] }

  // Collect unique agent and task IDs for batch lookup
  const agentIds = [...new Set(rows.map((r) => r.agent_id).filter(Boolean))]
  const taskIds = [...new Set(rows.map((r) => r.task_id).filter(Boolean))]

  // Fetch related agents and tasks in parallel
  const [agentsResult, tasksResult] = await Promise.all([
    agentIds.length > 0
      ? supabase
          .from("agents")
          .select("id, name, role, avatar_url")
          .in("id", agentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    taskIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, name")
          .in("id", taskIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  // Build lookup maps
  const agentMap = new Map<string, { id: string; name: string; role: string; avatar_url: string | null }>()
  for (const a of (agentsResult.data ?? []) as any[]) {
    agentMap.set(a.id, a)
  }

  const taskMap = new Map<string, { id: string; name: string }>()
  for (const t of (tasksResult.data ?? []) as any[]) {
    taskMap.set(t.id, t)
  }

  // Merge relations into session rows; synthesize ended_at from updated_at for completed sessions
  const sessions = rows.map((row) => ({
    ...row,
    ended_at: row.status === "completed" ? (row.updated_at ?? null) : null,
    agent: row.agent_id ? agentMap.get(row.agent_id) ?? null : null,
    task: row.task_id ? taskMap.get(row.task_id) ?? null : null,
  })) as AgentSessionWithAgent[]

  return { data: sessions }
}

/**
 * Get a single session by ID with agent and task data.
 * Resolves relations separately to avoid PostgREST join issues.
 */
export async function getSession(
  orgId: string,
  sessionId: string
): Promise<ActionResult<AgentSessionWithAgent>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agent_sessions" as any)
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", sessionId)
    .single()

  if (error) return { error: error.message }

  const row = data as any

  // Fetch related agent and task in parallel
  const [agentResult, taskResult] = await Promise.all([
    row.agent_id
      ? supabase
          .from("agents")
          .select("id, name, role, avatar_url")
          .eq("id", row.agent_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    row.task_id
      ? supabase
          .from("tasks")
          .select("id, name")
          .eq("id", row.task_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const session = {
    ...row,
    ended_at: row.status === "completed" ? (row.updated_at ?? null) : null,
    agent: agentResult.data ?? null,
    task: taskResult.data ?? null,
  } as AgentSessionWithAgent

  return { data: session }
}

/**
 * Create a new session and dispatch a run_task command to the agent.
 */
export async function createSession(
  orgId: string,
  agentId: string,
  taskId?: string | null,
  instructions?: string | null
): Promise<ActionResult<AgentSession>> {
  const { supabase } = await requireAuth()

  const parsed = createSessionSchema.safeParse({
    agent_id: agentId,
    task_id: taskId,
    instructions,
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid session data" }
  }

  const { data, error } = await supabase
    .from("agent_sessions" as any)
    .insert({
      organization_id: orgId,
      agent_id: parsed.data.agent_id,
      task_id: parsed.data.task_id ?? null,
      status: "running",
      started_at: new Date().toISOString(),
      input_tokens: 0,
      output_tokens: 0,
      metadata: {},
    })
    .select()
    .single()

  if (error) return { error: error.message }

  const session = data as unknown as AgentSession

  // Dispatch run_task command to the agent via the agent commands bridge
  await createAgentCommand(
    orgId,
    parsed.data.agent_id,
    "run_task",
    {
      session_id: session.id,
      task_id: parsed.data.task_id ?? null,
      instructions: parsed.data.instructions ?? null,
    },
    parsed.data.task_id
  )

  return { data: session }
}

/**
 * Update a session's status and optionally merge additional metadata.
 */
export async function updateSessionStatus(
  orgId: string,
  sessionId: string,
  status: SessionStatus,
  metadata?: Record<string, unknown>
): Promise<ActionResult<AgentSession>> {
  const { supabase } = await requireAuth()

  const parsed = updateStatusSchema.safeParse({ status, metadata })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid status data" }
  }

  const updatePayload: Record<string, unknown> = {
    status: parsed.data.status,
  }

  if (parsed.data.metadata) {
    updatePayload.metadata = parsed.data.metadata
  }

  // updated_at is set automatically by the DB trigger

  const { data, error } = await supabase
    .from("agent_sessions" as any)
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("organization_id", orgId)
    .select()
    .single()

  if (error) return { error: error.message }

  return { data: data as unknown as AgentSession }
}

/**
 * Terminate a session — sets status to completed. updated_at is set by DB trigger.
 */
export async function terminateSession(
  orgId: string,
  sessionId: string
): Promise<ActionResult<AgentSession>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agent_sessions" as any)
    .update({
      status: "completed",
    })
    .eq("id", sessionId)
    .eq("organization_id", orgId)
    .select()
    .single()

  if (error) return { error: error.message }

  return { data: data as unknown as AgentSession }
}

/**
 * Get session counts grouped by status for an organization.
 */
export async function getSessionStats(
  orgId: string
): Promise<
  ActionResult<{
    running: number
    blocked: number
    waiting: number
    completed: number
    total: number
  }>
> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agent_sessions" as any)
    .select("status")
    .eq("organization_id", orgId)

  if (error) return { error: error.message }

  const rows = (data ?? []) as unknown as { status: SessionStatus }[]

  const counts = {
    running: 0,
    blocked: 0,
    waiting: 0,
    completed: 0,
    total: rows.length,
  }

  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status]++
    }
  }

  return { data: counts }
}
