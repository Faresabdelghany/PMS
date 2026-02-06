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

/**
 * Get comprehensive performance metrics for an organization
 */
export async function getPerformanceMetrics(
  orgId: string
): Promise<ActionResult<PerformanceMetrics>> {
  try {
    const { supabase } = await requireOrgMember(orgId)

    // Fetch projects and tasks in parallel
    const [projectsResult, tasksResult, membersResult] = await Promise.all([
      supabase
        .from("projects")
        .select("id, status, progress")
        .eq("organization_id", orgId),
      supabase
        .from("tasks")
        .select(`
          id,
          status,
          end_date,
          updated_at,
          assignee_id,
          projects!inner(organization_id)
        `)
        .eq("projects.organization_id", orgId),
      supabase
        .from("organization_members")
        .select(`
          user_id,
          profiles(full_name, avatar_url)
        `)
        .eq("organization_id", orgId),
    ])

    if (projectsResult.error) {
      return { error: `Failed to fetch projects: ${projectsResult.error.message}` }
    }
    if (tasksResult.error) {
      return { error: `Failed to fetch tasks: ${tasksResult.error.message}` }
    }
    if (membersResult.error) {
      return { error: `Failed to fetch members: ${membersResult.error.message}` }
    }

    const projects = projectsResult.data || []
    const tasks = tasksResult.data || []
    const members = membersResult.data || []

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)

    // Calculate project stats
    const projectStatusCounts = createProjectStatusCounts()
    let totalProgress = 0

    for (const project of projects) {
      const status = project.status as ProjectStatus
      if (status in projectStatusCounts) {
        projectStatusCounts[status]++
      }
      totalProgress += project.progress || 0
    }

    const projectStats = {
      total: projects.length,
      byStatus: projectStatusCounts,
      averageProgress: projects.length > 0 ? Math.round(totalProgress / projects.length) : 0,
      completionRate:
        projects.length > 0
          ? Math.round(
              (projectStatusCounts.completed / projects.length) * 100
            )
          : 0,
    }

    // Calculate task stats
    const taskStatusCounts = createTaskStatusCounts()
    let completedThisWeek = 0
    let completedThisMonth = 0
    let overdueCount = 0

    for (const task of tasks) {
      const status = task.status as TaskStatus
      if (status in taskStatusCounts) {
        taskStatusCounts[status]++
      }

      // Check completed tasks this week/month
      if (status === "done" && task.updated_at) {
        const updatedAt = new Date(task.updated_at)
        if (isAfter(updatedAt, weekStart)) {
          completedThisWeek++
        }
        if (isAfter(updatedAt, monthStart)) {
          completedThisMonth++
        }
      }

      // Check overdue tasks
      if (status !== "done" && task.end_date) {
        const dueDate = new Date(task.end_date)
        if (isBefore(dueDate, now)) {
          overdueCount++
        }
      }
    }

    const taskStats = {
      total: tasks.length,
      byStatus: taskStatusCounts,
      completedThisWeek,
      completedThisMonth,
      overdueCount,
    }

    // Calculate weekly trends (last 12 weeks)
    const weeklyTrends: Array<{ weekStart: string; tasksCompleted: number }> = []
    for (let i = 11; i >= 0; i--) {
      const weekStartDate = subWeeks(weekStart, i)
      const weekEndDate = subWeeks(weekStart, i - 1)

      const completedInWeek = tasks.filter((task) => {
        if (task.status !== "done" || !task.updated_at) return false
        const updatedAt = new Date(task.updated_at)
        return (
          isAfter(updatedAt, weekStartDate) &&
          (i === 0 || isBefore(updatedAt, weekEndDate))
        )
      }).length

      weeklyTrends.push({
        weekStart: format(weekStartDate, "MMM d"),
        tasksCompleted: completedInWeek,
      })
    }

    // Calculate team productivity
    const memberMap = new Map<
      string,
      { userName: string; avatarUrl: string | null; tasksCompleted: number }
    >()

    // Initialize all members with 0 tasks
    for (const member of members) {
      const profile = member.profiles as { full_name: string | null; avatar_url: string | null } | null
      memberMap.set(member.user_id, {
        userName: profile?.full_name || "Unknown",
        avatarUrl: profile?.avatar_url || null,
        tasksCompleted: 0,
      })
    }

    // Count completed tasks per member (this month)
    for (const task of tasks) {
      if (
        task.status === "done" &&
        task.assignee_id &&
        task.updated_at &&
        isAfter(new Date(task.updated_at), monthStart)
      ) {
        const member = memberMap.get(task.assignee_id)
        if (member) {
          member.tasksCompleted++
        }
      }
    }

    const teamProductivity = Array.from(memberMap.entries())
      .map(([userId, data]) => ({
        userId,
        ...data,
      }))
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
      .slice(0, 10) // Top 10 members

    return {
      data: {
        projectStats,
        taskStats,
        weeklyTrends,
        teamProductivity,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { error: message }
  }
}
