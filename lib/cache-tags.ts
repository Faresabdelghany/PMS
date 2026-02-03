import { revalidateTag as nextRevalidateTag } from "next/cache"

/**
 * Cache tag constants for granular revalidation
 *
 * Using revalidateTag() instead of revalidatePath() allows for more targeted
 * cache invalidation. When data changes, only the specific cached data is
 * invalidated rather than entire pages.
 *
 * Pattern: Use descriptive tags that can be invalidated together or separately
 * - Entity-level tags (e.g., "projects", "clients")
 * - Organization-scoped tags (e.g., "projects-{orgId}")
 * - Item-specific tags (e.g., "project-{id}")
 */

/**
 * Wrapper for revalidateTag - invalidates cached data with the given tag
 */
export function revalidateTag(tag: string): void {
  nextRevalidateTag(tag, { expire: 0 })
}

export const CacheTags = {
  // Projects
  projects: (orgId: string) => `projects-${orgId}`,
  project: (id: string) => `project-${id}`,
  projectDetails: (id: string) => `project-details-${id}`,
  projectMembers: (projectId: string) => `project-members-${projectId}`,

  // Clients
  clients: (orgId: string) => `clients-${orgId}`,
  client: (id: string) => `client-${id}`,

  // Tasks
  tasks: (projectId: string) => `tasks-${projectId}`,
  task: (id: string) => `task-${id}`,
  myTasks: (userId: string) => `my-tasks-${userId}`,
  taskTimeline: (taskId: string) => `task-timeline-${taskId}`,
  taskComments: (taskId: string) => `task-comments-${taskId}`,
  taskActivities: (taskId: string) => `task-activities-${taskId}`,

  // Workstreams
  workstreams: (projectId: string) => `workstreams-${projectId}`,
  workstream: (id: string) => `workstream-${id}`,

  // Organizations
  organizations: (userId: string) => `organizations-${userId}`,
  organization: (id: string) => `organization-${id}`,
  organizationMembers: (orgId: string) => `org-members-${orgId}`,

  // Files & Notes
  projectFiles: (projectId: string) => `project-files-${projectId}`,
  projectNotes: (projectId: string) => `project-notes-${projectId}`,

  // Teams
  teams: (orgId: string) => `teams-${orgId}`,
  team: (id: string) => `team-${id}`,

  // Tags (entity)
  tags: (orgId: string) => `tags-${orgId}`,

  // Inbox & Activity (user-specific, short TTL)
  inbox: (userId: string) => `inbox-${userId}`,
  activity: (userId: string) => `activity-${userId}`,

  // User settings (long TTL)
  userProfile: (userId: string) => `user-profile-${userId}`,
  userPreferences: (userId: string) => `user-preferences-${userId}`,
} as const
