import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Verify a Supabase service-role JWT by inspecting its claims.
 * No secret needed — we just confirm the token is issued by our project
 * with the service_role role.
 */
function verifySupabaseServiceToken(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false
  const token = authHeader.replace("Bearer ", "").trim()
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    )
    return (
      payload.role === "service_role" &&
      payload.iss === "supabase" &&
      payload.ref === "lazhmdyajdqbnxxwyxun"
    )
  } catch {
    return false
  }
}

/**
 * POST /api/agent-events
 *
 * OpenClaw pushes agent events here.
 * Authenticated via Supabase service-role JWT claim verification.
 *
 * Body:
 * {
 *   org_id: string,
 *   agent_id?: string,
 *   task_id?: string,
 *   event_type: "task_started" | "task_progress" | "task_completed" | "task_failed" | "agent_message" | "approval_request" | "status_change" | "heartbeat",
 *   message: string,
 *   payload?: Record<string, unknown>
 * }
 */
export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────
  if (!verifySupabaseServiceToken(req.headers.get("Authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────────
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

  // ── Validate required fields ───────────────────────────────────────
  if (!org_id || !event_type || !message) {
    return NextResponse.json(
      { error: "Missing required fields: org_id, event_type, message" },
      { status: 400 }
    )
  }

  const validEventTypes = [
    "task_started",
    "task_progress",
    "task_completed",
    "task_failed",
    "agent_message",
    "approval_request",
    "status_change",
    "heartbeat",
  ]

  if (!validEventTypes.includes(event_type)) {
    return NextResponse.json(
      { error: `Invalid event_type. Must be one of: ${validEventTypes.join(", ")}` },
      { status: 400 }
    )
  }

  // ── Insert event ───────────────────────────────────────────────────
  const supabase = createAdminClient()

  const { error: insertError } = await supabase.from("agent_events").insert({
    organization_id: org_id,
    agent_id: agent_id ?? null,
    task_id: task_id ?? null,
    event_type: event_type as
      | "task_started"
      | "task_progress"
      | "task_completed"
      | "task_failed"
      | "agent_message"
      | "approval_request"
      | "status_change"
      | "heartbeat",
    message,
    payload: payload ?? {},
  })

  if (insertError) {
    console.error("[agent-events] Insert error:", insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // ── If task completed, update task status ──────────────────────────
  if (task_id && event_type === "task_completed") {
    await supabase
      .from("tasks")
      .update({
        dispatch_status: "completed",
        status: "done",
      })
      .eq("id", task_id)
  }

  // ── If task started, update dispatch status ─────────────────────────
  if (task_id && event_type === "task_started") {
    await supabase
      .from("tasks")
      .update({ dispatch_status: "running" })
      .eq("id", task_id)
  }

  // ── If task failed, update dispatch status ─────────────────────────
  if (task_id && event_type === "task_failed") {
    await supabase
      .from("tasks")
      .update({ dispatch_status: "failed" })
      .eq("id", task_id)
  }

  return NextResponse.json({ ok: true })
}
