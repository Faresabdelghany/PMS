"use server"

import { requireAuth } from "./auth-helpers"
import { getProjects } from "./projects"
import { getClients } from "./clients"
import { getOrganizationMembers, getOrganization } from "./organizations"
import { getTeams } from "./teams"
import { getInboxItems } from "./inbox"
import { getMyTasks } from "./tasks"
import type { ActionResult } from "./types"
import type { ChatContext } from "./ai"

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
        })),
        teams: (teamsResult.data || []).map(t => ({
          id: t.id,
          name: t.name,
          memberCount: t.member_count || 0,
        })),
        members: (membersResult.data || []).map(m => ({
          id: m.user_id,
          name: m.profile.full_name || m.profile.email,
          email: m.profile.email,
          role: m.role,
        })),
        userTasks: (userTasksResult.data || []).map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          priority: t.priority,
          projectId: t.project_id || undefined,
          projectName: t.project?.name,
          dueDate: t.end_date || undefined,
        })),
        inbox: (inboxResult.data || []).map(i => ({
          id: i.id,
          type: i.type,
          title: i.title,
          isRead: i.is_read,
          createdAt: i.created_at,
        })),
      },
    }

    return { data: context }
  } catch (error) {
    console.error("Failed to get AI context:", error)
    return { error: "Failed to load context" }
  }
}
