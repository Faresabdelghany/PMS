"use server"

import { requireAuth } from "./auth-helpers"
import { getProjects } from "./projects"
import { getClients } from "./clients"
import { getOrganizationMembers, getOrganization } from "./organizations"
import { getTeams } from "./teams"
import { getInboxItems } from "./inbox"
import { getMyTasks } from "./tasks"
import type { ActionResult } from "./types"
import type { ChatContext, WorkloadInsights } from "./ai-types"

/**
 * Calculates workload insights from user tasks for AI context.
 * Helps the AI understand user's current workload and suggest helpful actions.
 */
function calculateWorkloadInsights(
  tasks: { status: string; priority: string; dueDate?: string }[]
): WorkloadInsights {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (7 - today.getDay())) // End of current week (Sunday)

  // Filter to only active tasks (not completed or cancelled)
  const activeTasks = tasks.filter(
    t => !["completed", "done", "cancelled", "archived"].includes(t.status.toLowerCase())
  )

  let overdueTasks = 0
  let dueToday = 0
  let dueThisWeek = 0
  let oldestOverdueDays = 0

  for (const task of activeTasks) {
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())

      if (dueDateOnly < today) {
        overdueTasks++
        const daysDiff = Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff > oldestOverdueDays) {
          oldestOverdueDays = daysDiff
        }
      } else if (dueDateOnly.getTime() === today.getTime()) {
        dueToday++
      } else if (dueDateOnly <= endOfWeek) {
        dueThisWeek++
      }
    }
  }

  const completedTasks = tasks.filter(
    t => ["completed", "done"].includes(t.status.toLowerCase())
  ).length

  const inProgressTasks = tasks.filter(
    t => ["in_progress", "in progress", "active"].includes(t.status.toLowerCase())
  ).length

  const highPriorityTasks = activeTasks.filter(
    t => t.priority.toLowerCase() === "high"
  ).length

  const urgentTasks = activeTasks.filter(
    t => t.priority.toLowerCase() === "urgent"
  ).length

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    dueToday,
    dueThisWeek,
    highPriorityTasks,
    urgentTasks,
    hasUrgentOverdue: oldestOverdueDays > 3,
    isOverloaded: activeTasks.length > 15,
    oldestOverdueDays: overdueTasks > 0 ? oldestOverdueDays : undefined,
  }
}

/**
 * Fetches all application data needed for AI chat context.
 * This is called when the user opens the AI chat from the sidebar.
 */
export async function getAIContext(): Promise<ActionResult<ChatContext>> {
  try {
    const { user, supabase } = await requireAuth()

    // Get user's organization
    const { data: orgMembership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single()

    if (!orgMembership) {
      return { error: "No organization found" }
    }

    const organizationId = orgMembership.organization_id

    // Fetch all data in parallel
    const [
      orgResult,
      projectsResult,
      clientsResult,
      membersResult,
      teamsResult,
      inboxResult,
      userTasksResult,
    ] = await Promise.all([
      getOrganization(organizationId),
      getProjects(organizationId),
      getClients(organizationId),
      getOrganizationMembers(organizationId),
      getTeams(organizationId),
      getInboxItems(),
      getMyTasks(organizationId),
    ])

    // Build context
    const context: ChatContext = {
      pageType: "other",
      appData: {
        organization: {
          id: organizationId,
          name: orgResult.data?.name || "",
        },
        projects: (projectsResult.data || []).map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          clientName: p.client?.name,
          dueDate: p.end_date || undefined,
        })),
        clients: (clientsResult.data || []).map(c => ({
          id: c.id,
          name: c.name,
          status: c.status || "active",
          projectCount: 0, // Project count not fetched in basic query
        })),
        teams: (teamsResult.data || []).map(t => ({
          id: t.id,
          name: t.name,
          memberCount: 0, // Member count not available in basic teams query
        })),
        members: (membersResult.data || []).map(m => ({
          id: m.user_id,
          name: m.profile.full_name || m.profile.email,
          email: m.profile.email,
          role: m.role,
        })),
        userTasks: (userTasksResult.data || []).map(t => ({
          id: t.id,
          title: t.name,
          status: t.status,
          priority: t.priority,
          projectId: t.project_id || undefined,
          projectName: t.project?.name || "Unknown",
          dueDate: t.end_date || undefined,
        })),
        inbox: (inboxResult.data || []).map(i => ({
          id: i.id,
          type: (i as { type?: string }).type || "notification",
          title: i.title,
          read: i.is_read,
          createdAt: i.created_at,
        })),
        // Calculate workload insights for AI to understand user's situation
        workloadInsights: calculateWorkloadInsights(
          (userTasksResult.data || []).map(t => ({
            status: t.status,
            priority: t.priority,
            dueDate: t.end_date || undefined,
          }))
        ),
      },
    }

    return { data: context }
  } catch {
    return { error: "Failed to load context" }
  }
}
