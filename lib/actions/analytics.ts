"use server"

import { requireOrgMember } from "./auth-helpers"
import type { ActionResult } from "./types"
import type { ProjectStatus, TaskStatus } from "@/lib/constants/status"
import {
  createProjectStatusCounts,
  createTaskStatusCounts,
} from "@/lib/constants/status"
import {
  startOfWeek,
  startOfMonth,
  subWeeks,
  format,
  isAfter,
  isBefore,
} from "date-fns"

export type PerformanceMetrics = {
  projectStats: {
    total: number
    byStatus: Record<ProjectStatus, number>
    averageProgress: number
    completionRate: number
  }
  taskStats: {
    total: number
    byStatus: Record<TaskStatus, number>
    completedThisWeek: number
    completedThisMonth: number
    overdueCount: number
  }
  weeklyTrends: Array<{ weekStart: string; tasksCompleted: number }>
  teamProductivity: Array<{
    userId: string
    userName: string
    avatarUrl: string | null
    tasksCompleted: number
  }>
}

type ProjectRow = { id: string; status: string; progress: number | null }
type TaskRow = { id: string; status: string; end_date: string | null; updated_at: string | null; assignee_id: string | null }
type MemberRow = { user_id: string; profiles: { full_name: string | null; avatar_url: string | null } | null }

function calcProjectStats(projects: ProjectRow[]) {
  const byStatus = createProjectStatusCounts()
  let totalProgress = 0

  for (const project of projects) {
    const status = project.status as ProjectStatus
    if (status in byStatus) byStatus[status]++
    totalProgress += project.progress || 0
  }

  return {
    total: projects.length,
    byStatus,
    averageProgress: projects.length > 0 ? Math.round(totalProgress / projects.length) : 0,
    completionRate: projects.length > 0 ? Math.round((byStatus.completed / projects.length) * 100) : 0,
  }
}

function calcTaskStats(tasks: TaskRow[], weekStart: Date, monthStart: Date, now: Date) {
  const byStatus = createTaskStatusCounts()
  let completedThisWeek = 0
  let completedThisMonth = 0
  let overdueCount = 0

  for (const task of tasks) {
    const status = task.status as TaskStatus
    if (status in byStatus) byStatus[status]++

    if (status === "done" && task.updated_at) {
      const updatedAt = new Date(task.updated_at)
      if (isAfter(updatedAt, weekStart)) completedThisWeek++
      if (isAfter(updatedAt, monthStart)) completedThisMonth++
    }

    if (status !== "done" && task.end_date && isBefore(new Date(task.end_date), now)) {
      overdueCount++
    }
  }

  return { total: tasks.length, byStatus, completedThisWeek, completedThisMonth, overdueCount }
}

function calcWeeklyTrends(tasks: TaskRow[], weekStart: Date) {
  const trends: Array<{ weekStart: string; tasksCompleted: number }> = []

  for (let i = 11; i >= 0; i--) {
    const start = subWeeks(weekStart, i)
    const end = subWeeks(weekStart, i - 1)

    const count = tasks.filter((t) => {
      if (t.status !== "done" || !t.updated_at) return false
      const d = new Date(t.updated_at)
      return isAfter(d, start) && (i === 0 || isBefore(d, end))
    }).length

    trends.push({ weekStart: format(start, "MMM d"), tasksCompleted: count })
  }

  return trends
}

function calcTeamProductivity(tasks: TaskRow[], members: MemberRow[], monthStart: Date) {
  const map = new Map<string, { userName: string; avatarUrl: string | null; tasksCompleted: number }>()

  for (const m of members) {
    const profile = m.profiles as { full_name: string | null; avatar_url: string | null } | null
    map.set(m.user_id, { userName: profile?.full_name || "Unknown", avatarUrl: profile?.avatar_url || null, tasksCompleted: 0 })
  }

  for (const task of tasks) {
    if (task.status !== "done" || !task.assignee_id || !task.updated_at) continue
    if (!isAfter(new Date(task.updated_at), monthStart)) continue
    const member = map.get(task.assignee_id)
    if (member) member.tasksCompleted++
  }

  return Array.from(map.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 10)
}

/**
 * Get comprehensive performance metrics for an organization
 */
export async function getPerformanceMetrics(
  orgId: string
): Promise<ActionResult<PerformanceMetrics>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    const [projectsResult, tasksResult, membersResult] = await Promise.all([
      supabase.from("projects").select("id, status, progress").eq("organization_id", orgId),
      supabase.from("tasks").select("id, status, end_date, updated_at, assignee_id, projects!inner(organization_id)").eq("projects.organization_id", orgId),
      supabase.from("organization_members").select("user_id, profiles(full_name, avatar_url)").eq("organization_id", orgId),
    ])

    if (projectsResult.error) return { error: `Failed to fetch projects: ${projectsResult.error.message}` }
    if (tasksResult.error) return { error: `Failed to fetch tasks: ${tasksResult.error.message}` }
    if (membersResult.error) return { error: `Failed to fetch members: ${membersResult.error.message}` }

    const projects = (projectsResult.data || []) as ProjectRow[]
    const tasks = (tasksResult.data || []) as TaskRow[]
    const members = (membersResult.data || []) as MemberRow[]

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)

    return {
      data: {
        projectStats: calcProjectStats(projects),
        taskStats: calcTaskStats(tasks, weekStart, monthStart, now),
        weeklyTrends: calcWeeklyTrends(tasks, weekStart),
        teamProductivity: calcTeamProductivity(tasks, members, monthStart),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { error: message }
  }
}
