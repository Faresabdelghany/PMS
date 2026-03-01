"use server"

import { revalidatePath } from "next/cache"
import { requireAuth, requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import {
  runRequiredFieldsCheck,
  runReviewerApprovedCheck,
  runTestsPassingCheck,
  runPrMergedCheck,
  runDocumentationUpdatedCheck,
  type DoDCheckConfig,
  type DoDCheckResult,
} from "@/lib/mission-control/dod-runner"

type TaskForDoD = {
  id: string
  project_id: string
  organization_id: string
  task_type?: string | null
  name?: string | null
  description?: string | null
  assignee_id?: string | null
  end_date?: string | null
  [key: string]: unknown
}

type PolicyRow = {
  id: string
  name: string
  checks: unknown
  mode: "warn" | "block" | "auto-reopen"
}

const DEFAULT_REQUIRED_FIELDS = ["name", "description", "assignee_id"]

function toCheckConfigList(rawChecks: unknown): DoDCheckConfig[] {
  if (!Array.isArray(rawChecks)) return []
  return rawChecks.filter((check): check is DoDCheckConfig => {
    if (!check || typeof check !== "object") return false
    const type = (check as { type?: string }).type
    if (type === "required_fields") {
      return Array.isArray((check as { fields?: unknown }).fields)
    }
    return (
      type === "reviewer_approved" ||
      type === "tests_passing" ||
      type === "pr_merged" ||
      type === "documentation_updated"
    )
  })
}

async function hasReviewerApproval(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  orgId: string,
  taskId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("approvals" as any)
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "approved")
    .or(`payload->>task_id.eq.${taskId},payload->>taskId.eq.${taskId}`)
    .limit(1)
    .maybeSingle()

  return !!data
}

function runCheck(
  check: DoDCheckConfig,
  task: TaskForDoD,
  reviewerApproved: boolean
): DoDCheckResult {
  switch (check.type) {
    case "required_fields":
      return runRequiredFieldsCheck(task, check.fields)
    case "reviewer_approved":
      return runReviewerApprovedCheck(reviewerApproved)
    case "tests_passing":
      return runTestsPassingCheck(task)
    case "pr_merged":
      return runPrMergedCheck(task)
    case "documentation_updated":
      return runDocumentationUpdatedCheck(task)
  }
}

export type DoDEvaluationResult = {
  warnings: DoDCheckResult[]
  blockers: DoDCheckResult[]
}

export async function evaluateDoDForTask(
  task: TaskForDoD
): Promise<ActionResult<DoDEvaluationResult>> {
  try {
    const { supabase } = await requireAuth()

    const { data: policyRows, error: policyError } = await supabase
      .from("done_policies" as any)
      .select("id, name, checks, mode")
      .eq("organization_id", task.organization_id)
      .eq("active", true)
      .in("mode", ["warn", "block"])
      .or(`project_id.is.null,project_id.eq.${task.project_id}`)

    if (policyError) return { error: policyError.message }

    const normalizedPolicies = (policyRows ?? []) as unknown as PolicyRow[]

    const warnPolicies = normalizedPolicies.filter((p) => p.mode === "warn")
    const blockPolicies = normalizedPolicies.filter((p) => p.mode === "block")

    const warnChecks = warnPolicies.flatMap((p) => toCheckConfigList(p.checks))
    const blockChecks = blockPolicies.flatMap((p) => toCheckConfigList(p.checks))

    // Default checks if no policies exist
    if (warnChecks.length === 0 && blockChecks.length === 0) {
      warnChecks.push({ type: "required_fields", fields: DEFAULT_REQUIRED_FIELDS })
      warnChecks.push({ type: "reviewer_approved" })
    }

    const reviewerApproved = await hasReviewerApproval(
      supabase,
      task.organization_id,
      task.id
    )

    const warnings: DoDCheckResult[] = []
    for (const check of warnChecks) {
      const result = runCheck(check, task, reviewerApproved)
      if (!result.passed) warnings.push(result)
    }

    const blockers: DoDCheckResult[] = []
    for (const check of blockChecks) {
      const result = runCheck(check, task, reviewerApproved)
      if (!result.passed) blockers.push(result)
    }

    // Record results
    const allResults = [
      ...warnChecks.map((c) => ({ ...runCheck(c, task, reviewerApproved), mode: "warn" })),
      ...blockChecks.map((c) => ({ ...runCheck(c, task, reviewerApproved), mode: "block" })),
    ]

    if (allResults.length > 0) {
      const policyId = normalizedPolicies[0]?.id ?? null
      await supabase.from("done_check_results" as any).insert(
        allResults.map((result) => ({
          organization_id: task.organization_id,
          task_id: task.id,
          policy_id: policyId,
          check_name: result.checkName,
          passed: result.passed,
          message: result.message,
          metadata: { ...(result.metadata ?? {}), mode: result.mode },
        }))
      )
    }

    return { data: { warnings, blockers } }
  } catch {
    return { error: "Failed to evaluate DoD policy checks" }
  }
}

// Backward-compatible wrapper used by the after() in updateTask
export async function evaluateDoDWarningsForTask(
  task: TaskForDoD
): Promise<ActionResult<DoDCheckResult[]>> {
  const result = await evaluateDoDForTask(task)
  if (result.error) return { error: result.error }
  return { data: result.data?.warnings ?? [] }
}

export type TaskDoDWarning = {
  id: string
  check_name: string
  message: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

export async function getTaskDoDWarnings(
  taskId: string
): Promise<ActionResult<TaskDoDWarning[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("done_check_results" as any)
      .select("id, check_name, message, metadata, created_at")
      .eq("task_id", taskId)
      .eq("passed", false)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) return { error: error.message }

    return { data: (data ?? []) as unknown as TaskDoDWarning[] }
  } catch {
    return { error: "Failed to load DoD warnings" }
  }
}

// Override a blocker check result
export async function overrideDoDBlocker(
  taskId: string,
  checkName: string,
  reason: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireAuth()

    // Find the most recent failing check result for this check
    const { data: existingRaw, error: findError } = await supabase
      .from("done_check_results" as any)
      .select("id")
      .eq("task_id", taskId)
      .eq("check_name", checkName)
      .eq("passed", false)
      .eq("overridden", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) return { error: findError.message }

    const existing = existingRaw as unknown as { id: string } | null

    if (existing) {
      await supabase
        .from("done_check_results" as any)
        .update({
          overridden: true,
          override_reason: reason,
          overridden_by: user.id,
        })
        .eq("id", existing.id)
    }

    return {}
  } catch {
    return { error: "Failed to override DoD blocker" }
  }
}

// ── CRUD: DoD Policies ─────────────────────────────────────────────

export type DoDPolicy = {
  id: string
  organization_id: string
  project_id: string | null
  name: string
  task_type: string | null
  mode: "warn" | "block" | "auto-reopen"
  checks: DoDCheckConfig[]
  active: boolean
  created_at: string
  updated_at: string
  project?: { id: string; name: string } | null
}

export type DoDPolicyInsert = {
  name: string
  mode: "warn" | "block" | "auto-reopen"
  project_id?: string | null
  checks: DoDCheckConfig[]
  active?: boolean
}

export type DoDPolicyUpdate = Partial<DoDPolicyInsert>

export async function getDoDPolicies(
  orgId: string
): Promise<ActionResult<DoDPolicy[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("done_policies" as any)
      .select("*, project:projects(id, name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as DoDPolicy[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function createDoDPolicy(
  orgId: string,
  input: DoDPolicyInsert
): Promise<ActionResult<DoDPolicy>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("done_policies" as any)
      .insert({
        organization_id: orgId,
        name: input.name,
        mode: input.mode,
        project_id: input.project_id ?? null,
        checks: input.checks,
        active: input.active ?? true,
      })
      .select("*, project:projects(id, name)")
      .single()

    if (error) return { error: error.message }

    revalidatePath("/settings/dod")
    return { data: data as unknown as DoDPolicy }
  } catch {
    return { error: "Failed to create DoD policy" }
  }
}

export async function updateDoDPolicy(
  policyId: string,
  input: DoDPolicyUpdate
): Promise<ActionResult<DoDPolicy>> {
  try {
    const { supabase } = await requireAuth()

    const updateData: Record<string, unknown> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.mode !== undefined) updateData.mode = input.mode
    if (input.project_id !== undefined) updateData.project_id = input.project_id
    if (input.checks !== undefined) updateData.checks = input.checks
    if (input.active !== undefined) updateData.active = input.active

    const { data, error } = await supabase
      .from("done_policies" as any)
      .update(updateData)
      .eq("id", policyId)
      .select("*, project:projects(id, name)")
      .single()

    if (error) return { error: error.message }

    revalidatePath("/settings/dod")
    return { data: data as unknown as DoDPolicy }
  } catch {
    return { error: "Failed to update DoD policy" }
  }
}

export async function deleteDoDPolicy(
  policyId: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAuth()

    const { error } = await supabase
      .from("done_policies" as any)
      .delete()
      .eq("id", policyId)

    if (error) return { error: error.message }

    revalidatePath("/settings/dod")
    return {}
  } catch {
    return { error: "Failed to delete DoD policy" }
  }
}

export type DoDCheckResultHistory = {
  id: string
  task_id: string
  policy_id: string | null
  check_name: string
  passed: boolean
  message: string
  metadata: Record<string, unknown> | null
  overridden: boolean
  override_reason: string | null
  created_at: string
}

export async function getDoDCheckHistory(
  orgId: string
): Promise<ActionResult<DoDCheckResultHistory[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { data, error } = await supabase
      .from("done_check_results" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as DoDCheckResultHistory[] }
  } catch {
    return { error: "Not authorized" }
  }
}
