import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { invalidateCache } from "@/lib/cache"
import type { TaskPriority, TaskStatus } from "@/lib/supabase/types"
import { upsertMissionControlHeartbeat } from "@/lib/services/mission-control-heartbeat"
import { handleTaskFailureWithRetry } from "@/lib/services/retry-service"

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

const validTaskStatuses: TaskStatus[] = ["todo", "in-progress", "done"]
const validTaskPriorities: TaskPriority[] = ["low", "medium", "high", "urgent", "no-priority"]

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

  if (event_type === "task_create" || event_type === "subtask_create") {
    let duplicateQuery = supabase
      .from("agent_events")
      .select("task_id")
      .eq("organization_id", org_id)
      .eq("event_type", event_type as AgentEventType)
      .eq("message", message)
      .eq("payload", payload ?? {})
      .not("task_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)

    duplicateQuery = agent_id ? duplicateQuery.eq("agent_id", agent_id) : duplicateQuery.is("agent_id", null)

    const { data: duplicateEvent } = await duplicateQuery.maybeSingle()

    if (duplicateEvent?.task_id) {
      await supabase.from("agent_events").insert({
        organization_id: org_id,
        agent_id: agent_id ?? null,
        task_id: duplicateEvent.task_id,
        event_type: event_type as AgentEventType,
        message,
        payload: payload ?? {},
      })

      return NextResponse.json({ ok: true, task_id: duplicateEvent.task_id, duplicate: true })
    }
  }

  const { data: insertedEvent, error: insertError } = await supabase
    .from("agent_events")
    .insert({
      organization_id: org_id,
      agent_id: agent_id ?? null,
      task_id: task_id ?? null,
      event_type: event_type as AgentEventType,
      message,
      payload: payload ?? {},
    })
    .select("id")
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  let createdTaskId: string | null = null
  let createdTaskProjectId: string | null = null
  let createdTaskAssigneeId: string | null = null

  if (event_type === "task_create" || event_type === "subtask_create") {
    const name = getPayloadString(payload, "name")
    const projectId = getPayloadString(payload, "project_id")
    const description = getPayloadString(payload, "description")
    const source = getPayloadString(payload, "source") ?? "agent"
    const assignedAgentId = getPayloadString(payload, "assigned_agent_id") ?? agent_id ?? null
    const priorityInput = getPayloadString(payload, "priority") ?? "medium"
    const parentTaskId = getPayloadString(payload, "parent_task_id")
    const statusInput = getPayloadString(payload, "status") ?? "todo"

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

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 400 })
    }

    if (project.organization_id !== org_id) {
      return NextResponse.json(
        { error: "Project does not belong to provided organization" },
        { status: 400 }
      )
    }

    let assigneeId = getPayloadString(payload, "assignee_id")

    if (!assigneeId) {
      const { data: ownerMembership } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org_id)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle()

      assigneeId = ownerMembership?.user_id ?? null
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

    const status: TaskStatus = validTaskStatuses.includes(statusInput as TaskStatus)
      ? (statusInput as TaskStatus)
      : "todo"
    const priority: TaskPriority = validTaskPriorities.includes(priorityInput as TaskPriority)
      ? (priorityInput as TaskPriority)
      : "medium"

    const { data: createdTask, error: createTaskError } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        parent_task_id: parentTaskId,
        name,
        description,
        status,
        assignee_id: assigneeId,
        priority,
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
    createdTaskProjectId = projectId
    createdTaskAssigneeId = assigneeId

    await supabase
      .from("agent_events")
      .update({ task_id: createdTaskId })
      .eq("id", insertedEvent.id)

    revalidatePath("/tasks")
    revalidatePath(`/projects/${projectId}`)
    await invalidateCache.task({
      taskId: createdTaskId,
      projectId,
      assigneeId: assigneeId,
      orgId: org_id,
    })
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
  const heartbeatEligibleEvent =
    event_type === "task_started" ||
    event_type === "task_progress" ||
    event_type === "task_completed" ||
    event_type === "task_failed" ||
    event_type === "heartbeat"

  if (agent_id && heartbeatEligibleEvent) {
    await upsertMissionControlHeartbeat({
      orgId: org_id,
      agentId: agent_id,
      taskId: effectiveTaskId,
      message,
      eventType: event_type,
    })
  }

  if (effectiveTaskId && event_type === "task_completed") {
    await supabase
      .from("tasks")
      .update({ dispatch_status: "completed", status: "done" })
      .eq("id", effectiveTaskId)

    revalidatePath("/tasks")
    if (createdTaskProjectId) {
      revalidatePath(`/projects/${createdTaskProjectId}`)
      await invalidateCache.task({
        taskId: effectiveTaskId,
        projectId: createdTaskProjectId,
        assigneeId: createdTaskAssigneeId,
        orgId: org_id,
      })
    }
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

    await handleTaskFailureWithRetry({
      orgId: org_id,
      taskId: effectiveTaskId,
      errorMessage: message,
      taskType: getPayloadString(payload, "task_type"),
    })
  }

  // ── Inbox Notifications ────────────────────────────────────────────
  // Notify org members for agent events (skip heartbeat & task_progress — too noisy)
  const silentEvents: string[] = ["heartbeat", "task_progress"]
  if (!silentEvents.includes(event_type)) {
    try {
      // Get agent name for the notification title
      let agentName = "Agent"
      if (agent_id) {
        const { data: agent } = await supabase
          .from("agents")
          .select("name")
          .eq("id", agent_id)
          .single()
        if (agent?.name) agentName = agent.name
      }

      // Get task name if we have a task_id
      let taskName: string | null = null
      if (effectiveTaskId) {
        const { data: task } = await supabase
          .from("tasks")
          .select("name")
          .eq("id", effectiveTaskId)
          .single()
        taskName = task?.name ?? null
      }

      // Get all org members to notify
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org_id)

      if (members && members.length > 0) {
        let itemType: "task_update" | "system" | "project_milestone" = "task_update"
        let title = message
        let notifMessage: string | null = null

        switch (event_type) {
          case "task_completed":
            title = taskName
              ? `${agentName} completed "${taskName}"`
              : `${agentName} completed a run`
            break

          case "task_started":
            title = taskName
              ? `${agentName} started working on "${taskName}"`
              : `${agentName} started a new run`
            break

          case "task_failed":
            title = taskName
              ? `${agentName} failed on "${taskName}"`
              : `${agentName} encountered an error`
            notifMessage = message
            break

          case "task_create":
            title = `${agentName} created a new task`
            notifMessage = getPayloadString(payload, "name") ?? message
            break

          case "subtask_create":
            title = `${agentName} created a subtask`
            notifMessage = getPayloadString(payload, "name") ?? message
            break

          case "approval_request":
            itemType = "system"
            title = `${agentName} is requesting your approval`
            notifMessage = message
            break

          case "agent_message":
            itemType = "system"
            title = `${agentName} sent a message`
            notifMessage = message
            break

          case "status_change":
            itemType = "system"
            title = `${agentName} status changed`
            notifMessage = message
            break

          default:
            title = `${agentName}: ${message.slice(0, 120)}`
            break
        }

        // Get project_id from the task if we don't have it from task creation
        let projectId = createdTaskProjectId
        if (!projectId && effectiveTaskId) {
          const { data: taskRow } = await supabase
            .from("tasks")
            .select("project_id")
            .eq("id", effectiveTaskId)
            .single()
          projectId = taskRow?.project_id ?? null
        }

        const inboxItems = members.map((m) => ({
          organization_id: org_id,
          user_id: m.user_id,
          actor_id: null,
          item_type: itemType,
          title,
          message: notifMessage,
          is_read: false,
          project_id: projectId ?? null,
          task_id: effectiveTaskId ?? null,
          client_id: null,
          metadata: { agent_id: agent_id ?? null, event_type },
        }))

        await supabase.from("inbox_items").insert(inboxItems)
      }
    } catch {
      // Non-critical — don't fail the whole event if inbox insert fails
    }
  }

  return NextResponse.json(createdTaskId ? { ok: true, task_id: createdTaskId } : { ok: true })
}
