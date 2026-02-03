import type { SWRConfiguration } from "swr"

// Global SWR configuration
export const swrConfig: SWRConfiguration = {
  // Revalidate on focus (when user tabs back to the app)
  revalidateOnFocus: true,
  // Revalidate on network recovery
  revalidateOnReconnect: true,
  // Dedupe identical requests within 2 seconds
  dedupingInterval: 2000,
  // Retry failed requests with exponential backoff
  errorRetryCount: 3,
  // Don't revalidate on mount if data exists (prevents double fetch)
  revalidateIfStale: false,
}

// Cache key constants for consistency
export const SWRKeys = {
  aiStatus: "ai-status",
  aiSettings: "ai-settings",
  user: "user",
  profile: (userId: string) => `profile-${userId}`,
  projects: (orgId: string) => `projects-${orgId}`,
  project: (projectId: string) => `project-${projectId}`,
  tasks: (projectId: string) => `tasks-${projectId}`,
  clients: (orgId: string) => `clients-${orgId}`,
  organizationMembers: (orgId: string) => `org-members-${orgId}`,
} as const

// Longer stale times for data that doesn't change often
export const SWRStaleTime = {
  // AI settings rarely change - 5 minutes
  aiSettings: 5 * 60 * 1000,
  // User profile - 2 minutes
  user: 2 * 60 * 1000,
  // Projects list - 30 seconds
  projects: 30 * 1000,
  // Organization members - 1 minute
  orgMembers: 60 * 1000,
} as const
