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
} as const
