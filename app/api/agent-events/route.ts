import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type AgentEventType =
  | "task_started"
  | "task_progress"
  | "task_completed"
  | "task_failed"
  | "agent_message"
  | "approval_request"
  | "status_change"
  | "heartbeat"
  | "task_create"
  | "subtask_create"

const validEventTypes: AgentEventType[] = [
  "task_started",
  "task_progress",
  "task_completed",
  "task_failed",
  "agent_message",
  "approval_request",
  "status_change",
  "heartbeat",
  "task_create",
  "subtask_create",
]

function verifySupabaseServiceToken(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false
  const token = authHeader.replace("Bearer ", "").trim()
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"))
    return (
      payload.role === "service_role" &&
      payload.iss === "supabase" &&
      payload.ref === "lazhmdyajdqbnxxwyxun"
    )
  } catch {
    return false
  }
}

function getPayloadString(payload: Record<string, unknown> | undefined, key: string): string | null {
  const value = payload?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export async function POST(req: NextRequest) {
  if (!verifySupabaseServiceToken(req.headers.get("Authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    org_id: string
    agent_id?: string | null
    task_id?: string | null
    event_type: string
    message: string
    payload?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { org_id, agent_id, task_id, event_type, message, payload } = body

  if (!org_id || !event_type || !message) {
    return NextResponse.json(
      { error: "Missing required fields: org_id, event_type, message" },
      { status: 400 }
    )
  }

  if (!validEventTypes.includes(event_type as AgentEventType)) {
    return NextResponse.json(
      { error: `Invalid event_type. Must be one of: ${validEventTypes.join(", ")}` },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { error: insertError } = await supabase.from("agent_events").insert({
    organization_id: org_id,
    agent_id: agent_id ?? null,
    task_id: task_id ?? null,
    event_type: event_type as AgentEventType,
    message,
    payload: payload ?? {},
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  let createdTaskId: string | null = null

  if (event_type === "task_create" || event_type === "subtask_create") {
    const name = getPayloadString(payload, "name")
    const projectId = getPayloadString(payload, "project_id")
    const description = getPayloadString(payload, "description")
    const source = getPayloadString(payload, "source") ?? "agent"
    const assignedAgentId = getPayloadString(payload, "assigned_agent_id") ?? agent_id ?? null
    const priority = getPayloadString(payload, "priority") ?? "medium"
    const parentTaskId = getPayloadString(payload, "parent_task_id")

    if (!name || !projectId) {
      return NextResponse.json(
        { error: "task_create/subtask_create require payload.name and payload.project_id" },
        { status: 400 }
      )
    }

    if (event_type === "subtask_create" && !parentTaskId) {
      return NextResponse.json(
        { error: "subtask_create requires payload.parent_task_id" },
        { status: 400 }
      )
    }

    if (parentTaskId) {
      const { data: parentTask } = await supabase
        .from("tasks")
        .select("id")
        .eq("id", parentTaskId)
        .eq("project_id", projectId)
        .single()

      if (!parentTask) {
        return NextResponse.json({ error: "Parent task not found in provided project" }, { status: 400 })
      }
    }

    let lastTaskQuery = supabase
      .from("tasks")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)

    lastTaskQuery = parentTaskId
      ? lastTaskQuery.eq("parent_task_id", parentTaskId)
      : lastTaskQuery.is("parent_task_id", null)

    const { data: lastTask } = await lastTaskQuery.maybeSingle()

    const nextSortOrder = (lastTask?.sort_order ?? -1) + 1

    const { data: createdTask, error: createTaskError } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        parent_task_id: parentTaskId,
        name,
        description,
        priority: priority as "low" | "medium" | "high" | "urgent" | "no-priority",
        source: source as "manual" | "agent" | "speckit" | "system",
        task_type: "agent",
        dispatch_status: "pending",
        assigned_agent_id: assignedAgentId,
        sort_order: nextSortOrder,
      })
      .select("id")
      .single()

    if (createTaskError || !createdTask) {
      return NextResponse.json(
        { error: createTaskError?.message ?? "Failed to create task" },
        { status: 500 }
      )
    }

    createdTaskId = createdTask.id
  }

  if (payload?.gateway_id) {
    await supabase
      .from("gateways" as any)
      .update({ status: "online", last_seen_at: new Date().toISOString() })
      .eq("id", payload.gateway_id)
      .eq("org_id", org_id)
  } else {
    await supabase
      .from("gateways" as any)
      .update({ status: "online", last_seen_at: new Date().toISOString() })
      .eq("org_id", org_id)
  }

  if (agent_id && event_type !== "heartbeat") {
    await supabase.from("agent_activities" as any).insert({
      agent_id,
      organization_id: org_id,
      activity_type: event_type,
      title: message,
      description: (task_id ?? createdTaskId) ? `Task: ${task_id ?? createdTaskId}` : null,
      metadata: payload ?? {},
    })
  }

  const effectiveTaskId = task_id ?? createdTaskId

  if (effectiveTaskId && event_type === "task_completed") {
    await supabase
      .from("tasks")
      .update({ dispatch_status: "completed", status: "done" })
      .eq("id", effectiveTaskId)
  }

  if (effectiveTaskId && event_type === "task_started") {
    await supabase
      .from("tasks")
      .update({ dispatch_status: "running", status: "in-progress" })
      .eq("id", effectiveTaskId)
  }

  if (effectiveTaskId && event_type === "task_failed") {
    await supabase
      .from("tasks")
      .update({ dispatch_status: "failed" })
      .eq("id", effectiveTaskId)
  }

  return NextResponse.json(createdTaskId ? { ok: true, task_id: createdTaskId } : { ok: true })
}

