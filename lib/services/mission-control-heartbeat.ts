import { createAdminClient } from "@/lib/supabase/admin"
import { HEARTBEAT_PROTOCOL, type HeartbeatSessionStatus } from "@/lib/mission-control/heartbeat-protocol"

type UpsertHeartbeatInput = {
  orgId: string
  agentId: string
  taskId?: string | null
  message: string
  eventType: "task_started" | "task_progress" | "task_completed" | "task_failed" | "heartbeat"
}

function mapEventStatus(eventType: UpsertHeartbeatInput["eventType"]): HeartbeatSessionStatus {
  if (eventType === "task_started" || eventType === "task_progress") return "running"
  if (eventType === "task_failed") return "blocked"
  if (eventType === "task_completed") return "completed"
  return "waiting"
}

export async function upsertMissionControlHeartbeat(input: UpsertHeartbeatInput): Promise<void> {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  const status = mapEventStatus(input.eventType)

  const { data } = await supabase
    .from("agent_sessions" as any)
    .select("id")
    .eq("organization_id", input.orgId)
    .eq("agent_id", input.agentId)
    .is("task_id", input.taskId ?? null)
    .in("status", ["running", "waiting", "blocked"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const existingSession = data as { id: string } | null

  if (existingSession?.id) {
    await supabase
      .from("agent_sessions" as any)
      .update({
        status,
        task_id: input.taskId ?? null,
        task_summary: input.message,
        error_msg: input.eventType === "task_failed" ? input.message : null,
        blocker_reason: input.eventType === "task_failed" ? input.message : null,
        heartbeat_at: nowIso,
        metadata: {
          heartbeat_interval_seconds: HEARTBEAT_PROTOCOL.intervalSeconds,
          heartbeat_timeout_seconds: HEARTBEAT_PROTOCOL.timeoutSeconds,
        },
      })
      .eq("id", existingSession.id)
    return
  }

  await supabase
    .from("agent_sessions" as any)
    .insert({
      organization_id: input.orgId,
      agent_id: input.agentId,
      task_id: input.taskId ?? null,
      status,
      task_summary: input.message,
      started_at: nowIso,
      heartbeat_at: nowIso,
      error_msg: input.eventType === "task_failed" ? input.message : null,
      blocker_reason: input.eventType === "task_failed" ? input.message : null,
      metadata: {
        heartbeat_interval_seconds: HEARTBEAT_PROTOCOL.intervalSeconds,
        heartbeat_timeout_seconds: HEARTBEAT_PROTOCOL.timeoutSeconds,
      },
    })
}
