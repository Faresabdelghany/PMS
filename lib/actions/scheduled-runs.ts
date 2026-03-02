"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import { createAgentCommand } from "./agent-commands"

// ── Types ────────────────────────────────────────────────────────────

export interface ScheduledRun {
  id: string
  organization_id: string
  agent_id: string
  task_type: string
  cron_expression: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  paused: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ScheduledRunWithAgent extends ScheduledRun {
  agent?: { id: string; name: string; role: string; avatar_url: string | null } | null
}

// ── Validation ───────────────────────────────────────────────────────

const createScheduledRunSchema = z.object({
  agent_id: z.string().uuid(),
  task_type: z.string().trim().min(1).max(200),
  cron_expression: z.string().trim().min(1).max(100),
  next_run_at: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
})

const updateScheduledRunSchema = createScheduledRunSchema.partial()

// ── Actions ──────────────────────────────────────────────────────────

/**
 * List all scheduled runs for an organization, with agent join.
 */
export async function getScheduledRuns(
  orgId: string
): Promise<ActionResult<ScheduledRunWithAgent[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("scheduled_runs" as any)
      .select(`
        *,
        agent:agents(id, name, role, avatar_url)
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as ScheduledRunWithAgent[] }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Create a new scheduled run.
 */
export async function createScheduledRun(
  orgId: string,
  input: z.infer<typeof createScheduledRunSchema>
): Promise<ActionResult<ScheduledRun>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const parsed = createScheduledRunSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid scheduled run data" }
    }

    const { data, error } = await supabase
      .from("scheduled_runs" as any)
      .insert({
        organization_id: orgId,
        agent_id: parsed.data.agent_id,
        task_type: parsed.data.task_type,
        cron_expression: parsed.data.cron_expression,
        next_run_at: parsed.data.next_run_at ?? null,
        last_run_at: null,
        last_status: null,
        paused: false,
        metadata: parsed.data.metadata,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/scheduled-runs"))

    return { data: data as unknown as ScheduledRun }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Partially update an existing scheduled run.
 */
export async function updateScheduledRun(
  orgId: string,
  runId: string,
  input: Partial<z.infer<typeof createScheduledRunSchema>>
): Promise<ActionResult<ScheduledRun>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const parsed = updateScheduledRunSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid scheduled run data" }
    }

    const { data, error } = await supabase
      .from("scheduled_runs" as any)
      .update(parsed.data)
      .eq("id", runId)
      .eq("organization_id", orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/scheduled-runs"))

    return { data: data as unknown as ScheduledRun }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Delete a scheduled run.
 */
export async function deleteScheduledRun(
  orgId: string,
  runId: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { error } = await supabase
      .from("scheduled_runs" as any)
      .delete()
      .eq("id", runId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    after(() => revalidatePath("/scheduled-runs"))

    return {}
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Toggle the paused state of a scheduled run.
 */
export async function toggleSchedulePause(
  orgId: string,
  runId: string,
  paused: boolean
): Promise<ActionResult<ScheduledRun>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("scheduled_runs" as any)
      .update({ paused })
      .eq("id", runId)
      .eq("organization_id", orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/scheduled-runs"))

    return { data: data as unknown as ScheduledRun }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Manually trigger a scheduled run immediately.
 * Updates last_run_at and dispatches a run_task command via the agent bridge.
 */
export async function triggerManualRun(
  orgId: string,
  runId: string
): Promise<ActionResult<ScheduledRun>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    // Fetch the scheduled run to get agent_id and task_type
    const { data: run, error: fetchErr } = await supabase
      .from("scheduled_runs" as any)
      .select("*")
      .eq("id", runId)
      .eq("organization_id", orgId)
      .single()

    if (fetchErr || !run) return { error: "Scheduled run not found" }

    const typedRun = run as unknown as ScheduledRun

    if (typedRun.paused) {
      return { error: "Cannot trigger a paused schedule" }
    }

    // Dispatch run_task command via the agent bridge
    const cmdResult = await createAgentCommand(
      orgId,
      typedRun.agent_id,
      "run_task",
      {
        task_type: typedRun.task_type,
        scheduled_run_id: runId,
        ...typedRun.metadata,
      }
    )

    if (cmdResult.error) {
      return { error: cmdResult.error }
    }

    // Update last_run_at and last_status
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("scheduled_runs" as any)
      .update({ last_run_at: now, last_status: "triggered" })
      .eq("id", runId)
      .eq("organization_id", orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/scheduled-runs"))

    return { data: data as unknown as ScheduledRun }
  } catch {
    return { error: "Not authorized" }
  }
}
