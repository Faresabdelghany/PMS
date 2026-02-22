"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import { requireOrgMember } from "./auth-helpers"
import { uuidSchema, validate } from "@/lib/validations"
import type {
  Agent,
  AgentInsert,
  AgentUpdate,
  AgentActivityRow,
  AgentActivityInsert,
  AgentDecision,
  AgentDecisionInsert,
  AgentWithSupervisor,
  AgentType,
  AgentStatus,
  AgentSquad,
} from "@/lib/supabase/types"
import type { ActionResult } from "./types"

// ── Validation Schemas ──────────────────────────────────────────────

const AGENT_TYPES: [AgentType, ...AgentType[]] = ["supreme", "lead", "specialist", "integration"]
const AGENT_STATUSES: [AgentStatus, ...AgentStatus[]] = ["online", "busy", "offline", "idle"]
const AGENT_SQUADS: [AgentSquad, ...AgentSquad[]] = ["engineering", "marketing", "all"]

const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Agent name is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  agent_type: z.enum(AGENT_TYPES).default("specialist"),
  squad: z.enum(AGENT_SQUADS).default("engineering"),
  status: z.enum(AGENT_STATUSES).default("offline"),
  ai_provider: z.string().max(100).optional().nullable(),
  ai_model: z.string().max(200).optional().nullable(),
  system_prompt: z.string().max(10000).optional().nullable(),
  capabilities: z.array(z.string().max(100)).max(50).default([]),
  skills: z.any().default([]),
  reports_to: z.string().uuid().optional().nullable(),
  performance_notes: z.string().max(5000).optional().nullable(),
  avatar_url: z.string().url().optional().nullable().or(z.literal("")).transform((v) => (v === "" ? null : v)),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

const updateAgentSchema = createAgentSchema.partial()

const createActivitySchema = z.object({
  agent_id: z.string().uuid(),
  activity_type: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  metadata: z.any().default({}),
})

const createDecisionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  question: z.string().max(5000).optional().nullable(),
  decision_summary: z.string().trim().min(1).max(5000),
  consulted_agents: z.array(z.string().uuid()).default([]),
  decided_by: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
})

// ── CRUD: Agents ────────────────────────────────────────────────────

export async function getAgents(
  orgId: string,
  filters?: { squad?: AgentSquad; status?: AgentStatus; type?: AgentType; search?: string }
): Promise<ActionResult<AgentWithSupervisor[]>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const supabase = await createClient()

  let query = supabase
    .from("agents")
    .select("*, supervisor:agents!agents_reports_to_fkey(id, name, role)")
    .eq("organization_id", orgId)

  if (filters?.squad) {
    query = query.eq("squad", filters.squad)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.type) {
    query = query.eq("agent_type", filters.type)
  }
  if (filters?.search) {
    const search = filters.search.replace(/[%_]/g, "")
    query = query.or(`name.ilike.%${search}%,role.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error } = await query.order("sort_order").order("name")

  if (error) return { error: error.message }

  // Supabase returns supervisor as array from join — unwrap to single object
  const agents = (data ?? []).map((row) => ({
    ...row,
    supervisor: Array.isArray(row.supervisor) ? row.supervisor[0] ?? null : row.supervisor,
  })) as AgentWithSupervisor[]

  return { data: agents }
}

export async function getAgent(id: string): Promise<ActionResult<AgentWithSupervisor>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("agents")
    .select("*, supervisor:agents!agents_reports_to_fkey(id, name, role)")
    .eq("id", id)
    .single()

  if (error) return { error: error.message }

  // Supabase returns supervisor as array from join — unwrap to single object
  const agent = {
    ...data,
    supervisor: Array.isArray(data.supervisor) ? data.supervisor[0] ?? null : data.supervisor,
  } as AgentWithSupervisor

  return { data: agent }
}

export async function createAgent(
  orgId: string,
  data: Omit<AgentInsert, "organization_id">
): Promise<ActionResult<Agent>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const validation = validate(createAgentSchema, data)
  if (!validation.success) return { error: validation.error }

  try {
    await requireOrgMember(orgId, true)
  } catch {
    return { error: "Admin access required to create agents" }
  }

  const supabase = await createClient()
  const { data: agent, error } = await supabase
    .from("agents")
    .insert({ ...validation.data, organization_id: orgId })
    .select()
    .single()

  if (error) return { error: error.message }

  after(() => {
    revalidatePath("/agents")
  })

  return { data: agent as Agent }
}

export async function updateAgent(
  id: string,
  data: AgentUpdate
): Promise<ActionResult<Agent>> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("agents")
    .select("organization_id")
    .eq("id", id)
    .single()

  if (!existing) return { error: "Agent not found" }

  try {
    await requireOrgMember(existing.organization_id, true)
  } catch {
    return { error: "Admin access required to update agents" }
  }

  const validation = validate(updateAgentSchema, data)
  if (!validation.success) return { error: validation.error }

  const { data: agent, error } = await supabase
    .from("agents")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  after(() => {
    revalidatePath("/agents")
  })

  return { data: agent as Agent }
}

export async function deleteAgent(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: agent } = await supabase
    .from("agents")
    .select("organization_id")
    .eq("id", id)
    .single()

  if (!agent) return { error: "Agent not found" }

  try {
    await requireOrgMember(agent.organization_id, true)
  } catch {
    return { error: "Admin access required to delete agents" }
  }

  const { error } = await supabase.from("agents").delete().eq("id", id)
  if (error) return { error: error.message }

  after(() => {
    revalidatePath("/agents")
  })

  return {}
}

// ── Agent Activities ────────────────────────────────────────────────

export async function getAgentActivities(
  agentId: string,
  limit = 50
): Promise<ActionResult<AgentActivityRow[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("agent_activities")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { error: error.message }
  return { data: (data ?? []) as AgentActivityRow[] }
}

export async function createAgentActivity(
  orgId: string,
  data: Omit<AgentActivityInsert, "organization_id">
): Promise<ActionResult<AgentActivityRow>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const validation = validate(createActivitySchema, data)
  if (!validation.success) return { error: validation.error }

  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member" }
  }

  const supabase = await createClient()
  const { data: activity, error } = await supabase
    .from("agent_activities")
    .insert({ ...validation.data, organization_id: orgId })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: activity as AgentActivityRow }
}

// ── Agent Decisions ─────────────────────────────────────────────────

export async function getAgentDecisions(
  orgId: string,
  limit = 50
): Promise<ActionResult<AgentDecision[]>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agent_decisions")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { error: error.message }
  return { data: (data ?? []) as AgentDecision[] }
}

export async function createAgentDecision(
  orgId: string,
  data: Omit<AgentDecisionInsert, "organization_id">
): Promise<ActionResult<AgentDecision>> {
  const orgValidation = validate(uuidSchema, orgId)
  if (!orgValidation.success) return { error: "Invalid organization ID" }

  const validation = validate(createDecisionSchema, data)
  if (!validation.success) return { error: validation.error }

  try {
    await requireOrgMember(orgId)
  } catch {
    return { error: "You must be an organization member" }
  }

  const supabase = await createClient()
  const { data: decision, error } = await supabase
    .from("agent_decisions")
    .insert({ ...validation.data, organization_id: orgId })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: decision as AgentDecision }
}
