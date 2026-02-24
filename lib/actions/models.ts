"use server"

import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export interface AgentModel {
  id: string
  name: string
  role: string
  model: string | null
  status: string
  avatar_url: string | null
}

// ── Actions ──────────────────────────────────────────────────────────

export async function getAgentModels(
  orgId: string
): Promise<ActionResult<AgentModel[]>> {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("agents")
    .select("id, name, role, status, avatar_url")
    .eq("organization_id", orgId)
    .order("name")

  if (error) return { error: error.message }
  return { data: (data ?? []) as unknown as AgentModel[] }
}

export async function updateAgentModel(
  agentId: string,
  model: string
): Promise<ActionResult<void>> {
  const { supabase } = await requireAuth()

  const { error } = await (supabase as any)
    .from("agents")
    .update({ model })
    .eq("id", agentId)

  if (error) return { error: error.message }
  return { data: undefined }
}
