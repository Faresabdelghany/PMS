"use server"

import { createClient } from "@/lib/supabase/server"

export type DashboardKPIs = {
  totalProjects: number
  activeTasks: number
  activeAgents: number
  completedThisWeek: number
}

export type DailyCompletions = {
  date: string
  count: number
}

export type TaskStatusDistribution = {
  date: string
  todo: number
  inProgress: number
  done: number
}

export async function getDashboardKPIs(orgId: string): Promise<DashboardKPIs> {
  const supabase = await createClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [projectsResult, activeTasksResult, agentsResult, completedResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("tasks")
      .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
      .eq("project.organization_id", orgId)
      .neq("status", "done")
      .is("parent_task_id", null),
    supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .neq("status", "offline"),
    supabase
      .from("tasks")
      .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
      .eq("project.organization_id", orgId)
      .eq("status", "done")
      .gte("updated_at", sevenDaysAgo.toISOString()),
  ])

  return {
    totalProjects: projectsResult.count ?? 0,
    activeTasks: activeTasksResult.count ?? 0,
    activeAgents: agentsResult.count ?? 0,
    completedThisWeek: completedResult.count ?? 0,
  }
}

export async function getDailyCompletions(orgId: string): Promise<DailyCompletions[]> {
  const supabase = await createClient()
  const now = new Date()
  const results: DailyCompletions[] = []

  // Build all 7 queries, then run in parallel
  const queries = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now)
    dayStart.setDate(now.getDate() - (6 - i))
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)

    return {
      label: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      promise: supabase
        .from("tasks")
        .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
        .eq("project.organization_id", orgId)
        .eq("status", "done")
        .gte("updated_at", dayStart.toISOString())
        .lt("updated_at", dayEnd.toISOString()),
    }
  })

  const counts = await Promise.all(queries.map((q) => q.promise))

  for (let i = 0; i < queries.length; i++) {
    results.push({
      date: queries[i].label,
      count: counts[i].count ?? 0,
    })
  }

  return results
}

export type TaskPriorityBreakdown = {
  priority: string
  count: number
}

export type AgentWorkloadItem = {
  agentName: string
  taskCount: number
}

export type AgentActivityDay = {
  date: string
  events: number
}

export async function getTaskPriorityBreakdown(orgId: string): Promise<TaskPriorityBreakdown[]> {
  const supabase = await createClient()

  const priorities = ["high", "medium", "low"] as const

  const queries = priorities.map((p) =>
    supabase
      .from("tasks")
      .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
      .eq("project.organization_id", orgId)
      .eq("priority", p)
  )

  const results = await Promise.all(queries)

  return priorities.map((p, i) => ({
    priority: p.charAt(0).toUpperCase() + p.slice(1),
    count: results[i].count ?? 0,
  }))
}

export async function getAgentWorkload(orgId: string): Promise<AgentWorkloadItem[]> {
  const supabase = await createClient()

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name")

  if (!agents?.length) return []

  const queries = agents.map((agent) =>
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_agent_id", agent.id)
      .neq("status", "done")
  )

  const results = await Promise.all(queries)

  return agents
    .map((agent, i) => ({
      agentName: agent.name,
      taskCount: results[i].count ?? 0,
    }))
    .filter((item) => item.taskCount > 0)
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 10)
}

export async function getAgentActivityTimeline(orgId: string): Promise<AgentActivityDay[]> {
  const supabase = await createClient()
  const now = new Date()

  const queries = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now)
    dayStart.setDate(now.getDate() - (6 - i))
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)

    return {
      label: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      promise: supabase
        .from("agent_events" as any)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", dayStart.toISOString())
        .lt("created_at", dayEnd.toISOString()),
    }
  })

  const counts = await Promise.all(queries.map((q) => q.promise))

  return queries.map((q, i) => ({
    date: q.label,
    events: (counts[i] as any).count ?? 0,
  }))
}

export async function getTaskStatusDistribution(orgId: string): Promise<TaskStatusDistribution[]> {
  const supabase = await createClient()
  const now = new Date()

  // Build all queries for 7 days in parallel (3 per day = 21 queries)
  const dayConfigs = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - i))
    day.setHours(23, 59, 59, 999)
    return {
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      cutoff: day.toISOString(),
    }
  })

  const allQueries = dayConfigs.flatMap((d) => [
    supabase
      .from("tasks")
      .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
      .eq("project.organization_id", orgId)
      .eq("status", "todo")
      .lte("created_at", d.cutoff),
    supabase
      .from("tasks")
      .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
      .eq("project.organization_id", orgId)
      .eq("status", "in-progress")
      .lte("created_at", d.cutoff),
    supabase
      .from("tasks")
      .select("id, project:projects!inner(organization_id)", { count: "exact", head: true })
      .eq("project.organization_id", orgId)
      .eq("status", "done")
      .lte("created_at", d.cutoff),
  ])

  const allResults = await Promise.all(allQueries)

  return dayConfigs.map((d, i) => ({
    date: d.label,
    todo: allResults[i * 3].count ?? 0,
    inProgress: allResults[i * 3 + 1].count ?? 0,
    done: allResults[i * 3 + 2].count ?? 0,
  }))
}
