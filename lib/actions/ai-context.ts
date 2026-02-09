"use server"

import { requireAuth } from "./auth-helpers"
import { getUserOrganizations } from "./organizations"
import { cacheGet, CacheKeys, CacheTTL } from "@/lib/cache"
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
 * Fetches all application data needed for AI chat context using a single RPC call.
 * Uses the get_ai_context_summary RPC function to consolidate 7 queries into 1.
 * Result is cached in KV for 2 minutes.
 */
export async function getAIContext(): Promise<ActionResult<ChatContext>> {
  try {
    // Fetch auth and org in parallel
    const [authResult, orgsResult] = await Promise.all([
      requireAuth(),
      getUserOrganizations(),
    ])

    const { user, supabase } = authResult

    if (orgsResult.error || !orgsResult.data?.length) {
      return { error: "No organization found" }
    }

    const organizationId = orgsResult.data[0].id

    // Use KV cache for AI context (2 min TTL)
    const rawData = await cacheGet(
      CacheKeys.aiContext(user.id, organizationId),
      async () => {
        // Single RPC call replaces 7 separate queries
        const { data, error } = await supabase.rpc("get_ai_context_summary", {
          p_org_id: organizationId,
          p_user_id: user.id,
        })

        if (error) throw error
        return data
      },
      CacheTTL.AI_CONTEXT
    )

    // Cast the RPC JSON result to the expected shape
    const contextData = rawData as unknown as {
      organization: { id: string; name: string }
      projects: { id: string; name: string; status: string; clientName?: string; dueDate?: string }[]
      clients: { id: string; name: string; status: string; projectCount: number }[]
      members: { id: string; name: string; email: string; role: string }[]
      teams: { id: string; name: string; memberCount: number }[]
      inbox: { id: string; title: string; type: string; read: boolean; createdAt: string }[]
      userTasks: { id: string; title: string; projectName: string; status: string; priority: string; dueDate?: string; projectId?: string }[]
    } | null

    // Build context from RPC result
    const userTasks = (contextData?.userTasks ?? []).map((t) => ({
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
    }))

    const context: ChatContext = {
      pageType: "other",
      appData: {
        organization: contextData?.organization ?? { id: organizationId, name: "" },
        projects: contextData?.projects ?? [],
        clients: contextData?.clients ?? [],
        teams: contextData?.teams ?? [],
        members: contextData?.members ?? [],
        userTasks: contextData?.userTasks ?? [],
        inbox: contextData?.inbox ?? [],
        workloadInsights: calculateWorkloadInsights(userTasks),
      },
    }

    return { data: context }
  } catch {
    return { error: "Failed to load context" }
  }
}
