"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"

// ── Types ────────────────────────────────────────────────────────────

export type AlertEntityType = "agent" | "task" | "session" | "gateway" | "cost"
export type AlertOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains"
export type AlertActionType = "notification" | "webhook" | "email"

export interface AlertRule {
  id: string
  organization_id: string
  name: string
  description: string | null
  entity_type: AlertEntityType
  condition_field: string
  condition_operator: AlertOperator
  condition_value: string
  action_type: AlertActionType
  action_target: string | null
  cooldown_minutes: number
  enabled: boolean
  last_triggered_at: string | null
  created_at: string
  updated_at: string
}

export interface AlertHistoryEntry {
  id: string
  rule_id: string
  organization_id: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
  rule?: AlertRule | null
}

// ── Validation ───────────────────────────────────────────────────────

const createAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  entity_type: z.enum(["agent", "task", "session", "gateway", "cost"]),
  condition_field: z.string().trim().min(1).max(100),
  condition_operator: z.enum(["=", "!=", ">", "<", ">=", "<=", "contains"]),
  condition_value: z.string().trim().min(1).max(500),
  action_type: z.enum(["notification", "webhook", "email"]).default("notification"),
  action_target: z.string().max(500).optional().nullable(),
  cooldown_minutes: z.number().int().min(1).max(10080).default(60),
  enabled: z.boolean().default(true),
})

const updateAlertRuleSchema = createAlertRuleSchema.partial()

// ── Actions ──────────────────────────────────────────────────────────

/**
 * List all alert rules for an organization, ordered by newest first.
 */
export async function getAlertRules(
  orgId: string
): Promise<ActionResult<AlertRule[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("alert_rules" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as AlertRule[] }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Create a new alert rule.
 */
export async function createAlertRule(
  orgId: string,
  input: z.infer<typeof createAlertRuleSchema>
): Promise<ActionResult<AlertRule>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const parsed = createAlertRuleSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid alert rule data" }
    }

    const { data, error } = await supabase
      .from("alert_rules" as any)
      .insert({
        organization_id: orgId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        entity_type: parsed.data.entity_type,
        condition_field: parsed.data.condition_field,
        condition_operator: parsed.data.condition_operator,
        condition_value: parsed.data.condition_value,
        action_type: parsed.data.action_type,
        action_target: parsed.data.action_target ?? null,
        cooldown_minutes: parsed.data.cooldown_minutes,
        enabled: parsed.data.enabled,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/alerts"))

    return { data: data as unknown as AlertRule }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Partially update an existing alert rule.
 */
export async function updateAlertRule(
  orgId: string,
  ruleId: string,
  input: Partial<z.infer<typeof createAlertRuleSchema>>
): Promise<ActionResult<AlertRule>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const parsed = updateAlertRuleSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid alert rule data" }
    }

    const { data, error } = await supabase
      .from("alert_rules" as any)
      .update(parsed.data)
      .eq("id", ruleId)
      .eq("organization_id", orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/alerts"))

    return { data: data as unknown as AlertRule }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Delete an alert rule.
 */
export async function deleteAlertRule(
  orgId: string,
  ruleId: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { error } = await supabase
      .from("alert_rules" as any)
      .delete()
      .eq("id", ruleId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    after(() => revalidatePath("/alerts"))

    return {}
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * Toggle the enabled state of an alert rule.
 */
export async function toggleAlertRule(
  orgId: string,
  ruleId: string,
  enabled: boolean
): Promise<ActionResult<AlertRule>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("alert_rules" as any)
      .update({ enabled })
      .eq("id", ruleId)
      .eq("organization_id", orgId)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/alerts"))

    return { data: data as unknown as AlertRule }
  } catch {
    return { error: "Not authorized" }
  }
}

/**
 * List alert history entries with optional filters.
 * Includes a join to the alert rule that triggered each entry.
 */
export async function getAlertHistory(
  orgId: string,
  filters?: { ruleId?: string; limit?: number }
): Promise<ActionResult<AlertHistoryEntry[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    let query = supabase
      .from("alert_history" as any)
      .select(`
        *,
        rule:alert_rules(*)
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    if (filters?.ruleId) {
      query = query.eq("rule_id", filters.ruleId)
    }

    query = query.limit(filters?.limit ?? 50)

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as AlertHistoryEntry[] }
  } catch {
    return { error: "Not authorized" }
  }
}
