"use server"

import { requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"
import {
  runRequiredFieldsCheck,
  runReviewerApprovedCheck,
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
    return type === "reviewer_approved"
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

export async function evaluateDoDWarningsForTask(
  task: TaskForDoD
): Promise<ActionResult<DoDCheckResult[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data: policyRows, error: policyError } = await supabase
      .from("done_policies" as any)
      .select("id, checks, mode")
      .eq("organization_id", task.organization_id)
      .eq("active", true)
      .eq("mode", "warn")
      .or(`project_id.is.null,project_id.eq.${task.project_id}`)

    if (policyError) return { error: policyError.message }

    const normalizedPolicies = (policyRows ?? []) as unknown as PolicyRow[]
    const allChecks = normalizedPolicies.flatMap((policy) =>
      toCheckConfigList(policy.checks)
    )

    if (allChecks.length === 0) {
      allChecks.push({ type: "required_fields", fields: DEFAULT_REQUIRED_FIELDS })
      allChecks.push({ type: "reviewer_approved" })
    }

    const reviewerApproved = await hasReviewerApproval(
      supabase,
      task.organization_id,
      task.id
    )

    const results: DoDCheckResult[] = []
    for (const check of allChecks) {
      if (check.type === "required_fields") {
        results.push(runRequiredFieldsCheck(task, check.fields))
      } else if (check.type === "reviewer_approved") {
        results.push(runReviewerApprovedCheck(reviewerApproved))
      }
    }

    const failedResults = results.filter((result) => !result.passed)

    if (results.length > 0) {
      const policyId = normalizedPolicies[0]?.id ?? null
      await supabase.from("done_check_results" as any).insert(
        results.map((result) => ({
          organization_id: task.organization_id,
          task_id: task.id,
          policy_id: policyId,
          check_name: result.checkName,
          passed: result.passed,
          message: result.message,
          metadata: result.metadata ?? {},
        }))
      )
    }

    return { data: failedResults }
  } catch {
    return { error: "Failed to evaluate DoD policy checks" }
  }
}

export type TaskDoDWarning = {
  id: string
  check_name: string
  message: string
  created_at: string
}

export async function getTaskDoDWarnings(
  taskId: string
): Promise<ActionResult<TaskDoDWarning[]>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("done_check_results" as any)
      .select("id, check_name, message, created_at")
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
