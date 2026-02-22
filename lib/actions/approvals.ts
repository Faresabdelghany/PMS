"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireOrgMember, requireAuth } from "./auth-helpers"
import type { ActionResult } from "./types"

export type Approval = {
  id: string
  org_id: string
  agent_id: string | null
  title: string
  description: string | null
  payload: Record<string, unknown> | null
  status: "pending" | "approved" | "rejected" | "cancelled"
  decision_reason: string | null
  decided_by: string | null
  created_at: string
  updated_at: string
}

export type ApprovalInsert = Omit<Approval, "id" | "created_at" | "updated_at">
export type ApprovalUpdate = Partial<Omit<Approval, "id" | "org_id" | "created_at" | "updated_at">>

// ── CRUD: Approvals ─────────────────────────────────────────────────

export async function getApprovals(
  orgId: string,
  status?: Approval["status"]
): Promise<ActionResult<Approval[]>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    let query = supabase
      .from("approvals" as any)
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data: (data ?? []) as unknown as Approval[] }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getApproval(id: string): Promise<ActionResult<Approval>> {
  try {
    const { supabase } = await requireAuth()

    const { data, error } = await supabase
      .from("approvals" as any)
      .select("*")
      .eq("id", id)
      .single()

    if (error) return { error: error.message }
    return { data: data as unknown as Approval }
  } catch {
    return { error: "Not authenticated" }
  }
}

export async function createApproval(
  orgId: string,
  input: {
    title: string
    description?: string
    payload?: Record<string, unknown>
    agent_id?: string
  }
): Promise<ActionResult<Approval>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const title = input.title?.trim()
    if (!title) return { error: "Title is required" }

    const { data, error } = await supabase
      .from("approvals" as any)
      .insert({
        org_id: orgId,
        title,
        description: input.description?.trim() || null,
        payload: input.payload ?? null,
        agent_id: input.agent_id ?? null,
        status: "pending",
      })
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/mission-control/approvals"))

    return { data: data as unknown as Approval }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function updateApproval(
  id: string,
  updates: ApprovalUpdate
): Promise<ActionResult<Approval>> {
  try {
    const { supabase, user } = await requireAuth()

    // Fetch the approval to get org_id for membership check
    const { data: existing, error: fetchErr } = await supabase
      .from("approvals" as any)
      .select("org_id")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) return { error: "Approval not found" }

    await requireOrgMember((existing as any).org_id)

    // If making a decision, stamp decided_by
    const payload: ApprovalUpdate = { ...updates }
    if (updates.status && updates.status !== "pending") {
      payload.decided_by = user.id
    }

    const { data, error } = await supabase
      .from("approvals" as any)
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return { error: error.message }

    after(() => revalidatePath("/mission-control/approvals"))

    return { data: data as unknown as Approval }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getPendingApprovalsCount(
  orgId: string
): Promise<ActionResult<number>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const { count, error } = await supabase
      .from("approvals" as any)
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending")

    if (error) return { data: 0 }
    return { data: count ?? 0 }
  } catch {
    return { data: 0 }
  }
}
