"use server"

import { startOfWeek, addDays, endOfDay } from "date-fns"
import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import { HEARTBEAT_PROTOCOL, isHeartbeatStale } from "@/lib/mission-control/heartbeat-protocol"

export type LiveOpsSessionStatus = "running" | "blocked" | "waiting" | "completed"
export type CalendarRunStatus = "success" | "failed" | "skipped" | "running" | "pending"

export interface LiveOpsSession {
  id: string
  agentId: string
  agentName: string
  taskId: string | null
  taskName: string | null
  taskSummary: string | null
  startedAt: string
  heartbeatAt: string
  status: LiveOpsSessionStatus
  blockerReason: string | null
}

export interface LiveOpsQueueItem {
  taskId: string
  taskName: string
  priority: string
  estimatedStartAt: string | null
  dependencies: string[]
}

export interface LiveOpsBlocker {
  sessionId: string
  taskId: string | null
  agentName: string
  reason: string
  heartbeatAt: string
}

export interface LiveOpsSnapshot {
  nowPlaying: LiveOpsSession[]
  queue: LiveOpsQueueItem[]
  blockers: LiveOpsBlocker[]
  heartbeat: {
    intervalSeconds: number
    timeoutSeconds: number
  }
}

export interface CalendarEntry {
  id: string
  agentId: string | null
  agentName: string
  taskId: string | null
  taskType: string
  scheduleExpr: string
  status: CalendarRunStatus
  lastRunAt: string | null
  nextRunAt: string
  runLogUrl: string | null
}

export interface AgentCalendarWeek {
  weekStart: string
  weekEnd: string
  entries: CalendarEntry[]
}

export async function getLiveOpsSnapshot(orgId: string): Promise<ActionResult<LiveOpsSnapshot>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const [sessionsResult, queueResult] = await Promise.all([
      supabase
        .from("agent_sessions" as any)
        .select(`
          id,
          agent_id,
          task_id,
          task_summary,
          started_at,
          heartbeat_at,
          status,
          blocker_reason,
          agent:agents(name),
          task:tasks(name)
        `)
        .eq("organization_id", orgId)
        .in("status", ["running", "blocked", "waiting"])
        .order("started_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, name, priority, created_at, parent_task_id, project:projects!inner(organization_id)")
        .eq("project.organization_id", orgId)
        .eq("dispatch_status", "pending")
        .eq("status", "todo")
        .order("created_at", { ascending: true })
        .limit(50),
    ])

    if (sessionsResult.error) return { error: sessionsResult.error.message }
    if (queueResult.error) return { error: queueResult.error.message }

    const nowPlaying: LiveOpsSession[] = ((sessionsResult.data ?? []) as any[]).map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent?.name ?? "Unknown Agent",
      taskId: row.task_id ?? null,
      taskName: row.task?.name ?? null,
      taskSummary: row.task_summary ?? null,
      startedAt: row.started_at,
      heartbeatAt: row.heartbeat_at,
      status: row.status,
      blockerReason: row.blocker_reason ?? null,
    }))

    const blockers: LiveOpsBlocker[] = nowPlaying
      .filter((session) => {
        if (session.status === "blocked") return true
        return isHeartbeatStale(session.heartbeatAt, HEARTBEAT_PROTOCOL.timeoutSeconds)
      })
      .map((session) => ({
        sessionId: session.id,
        taskId: session.taskId,
        agentName: session.agentName,
        reason: session.blockerReason ?? "Heartbeat stale",
        heartbeatAt: session.heartbeatAt,
      }))

    const queue: LiveOpsQueueItem[] = (queueResult.data ?? []).map((task) => ({
      taskId: task.id,
      taskName: task.name,
      priority: task.priority,
      estimatedStartAt: task.created_at ?? null,
      dependencies: task.parent_task_id ? [task.parent_task_id] : [],
    }))

    return {
      data: {
        nowPlaying,
        queue,
        blockers,
        heartbeat: {
          intervalSeconds: HEARTBEAT_PROTOCOL.intervalSeconds,
          timeoutSeconds: HEARTBEAT_PROTOCOL.timeoutSeconds,
        },
      },
    }
  } catch {
    return { error: "Not authorized" }
  }
}

export async function getAgentCalendarWeek(
  orgId: string,
  referenceDate?: string
): Promise<ActionResult<AgentCalendarWeek>> {
  try {
    const { supabase } = await requireOrgMember(orgId)
    const baseDate = referenceDate ? new Date(referenceDate) : new Date()
    const weekStartDate = startOfWeek(baseDate, { weekStartsOn: 1 })
    const weekEndDate = endOfDay(addDays(weekStartDate, 6))

    const { data, error } = await supabase
      .from("scheduled_runs" as any)
      .select(`
        id,
        agent_id,
        task_id,
        task_type,
        schedule_expr,
        last_status,
        last_run_at,
        next_run_at,
        run_log_url,
        agent:agents(name)
      `)
      .eq("organization_id", orgId)
      .gte("next_run_at", weekStartDate.toISOString())
      .lte("next_run_at", weekEndDate.toISOString())
      .eq("paused", false)
      .order("next_run_at", { ascending: true })

    if (error) return { error: error.message }

    return {
      data: {
        weekStart: weekStartDate.toISOString(),
        weekEnd: weekEndDate.toISOString(),
        entries: ((data ?? []) as any[]).map((row) => ({
          id: row.id,
          agentId: row.agent_id ?? null,
          agentName: row.agent?.name ?? "Unassigned",
          taskId: row.task_id ?? null,
          taskType: row.task_type,
          scheduleExpr: row.schedule_expr,
          status: row.last_status,
          lastRunAt: row.last_run_at ?? null,
          nextRunAt: row.next_run_at,
          runLogUrl: row.run_log_url ?? null,
        })),
      },
    }
  } catch {
    return { error: "Not authorized" }
  }
}
