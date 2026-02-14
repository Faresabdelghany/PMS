// lib/cache/keys.ts

/**
 * Cache key definitions for Vercel KV.
 * Pattern: pms:{entity}:{scope}:{id}
 */
export const CacheKeys = {
  // User-scoped (TTL: 10 min)
  user: (userId: string) => `pms:user:${userId}`,
  userOrgs: (userId: string) => `pms:user:orgs:${userId}`,
  colorTheme: (userId: string) => `pms:user:color-theme:${userId}`,

  // Org membership (TTL: 5 min)
  membership: (orgId: string, userId: string) =>
    `pms:membership:${orgId}:${userId}`,
  orgMembers: (orgId: string) => `pms:org:members:${orgId}`,

  // Sidebar (TTL: 5 min)
  sidebar: (orgId: string) => `pms:sidebar:${orgId}`,

  // Projects (TTL: 2 min)
  projects: (orgId: string) => `pms:projects:${orgId}`,
  project: (projectId: string) => `pms:project:${projectId}`,
  projectMembers: (projectId: string) => `pms:project:members:${projectId}`,

  // Clients (TTL: 2 min)
  clients: (orgId: string) => `pms:clients:${orgId}`,
  clientsWithCounts: (orgId: string) => `pms:clients-counts:${orgId}`,

  // Inbox (TTL: 30 sec)
  inbox: (userId: string) => `pms:inbox:${userId}`,

  // Teams (TTL: 5 min)
  teams: (orgId: string) => `pms:teams:${orgId}`,

  // Tags (TTL: 5 min)
  tags: (orgId: string) => `pms:tags:${orgId}`,

  // Labels (TTL: 5 min)
  labels: (orgId: string) => `pms:labels:${orgId}`,

  // Tasks (TTL: 30 sec)
  userTasks: (userId: string, orgId: string) =>
    `pms:tasks:user:${userId}:${orgId}`,
  projectTasks: (projectId: string) => `pms:tasks:project:${projectId}`,

  // Workstreams (TTL: 1 min)
  workstreams: (projectId: string) => `pms:workstreams:${projectId}`,

  // Session validation (TTL: 5 min)
  sessionValidated: (userId: string) => `pms:session:validated:${userId}`,

  // Project membership (TTL: 5 min)
  projectMembership: (projectId: string, userId: string) =>
    `pms:project:membership:${projectId}:${userId}`,

  // Search (TTL: 30 sec)
  search: (orgId: string, queryHash: string) =>
    `pms:search:${orgId}:${queryHash}`,

  // Conversations (TTL: 2 min)
  conversations: (userId: string, orgId: string) =>
    `pms:conversations:${userId}:${orgId}`,

  // AI Context (TTL: 2 min)
  aiContext: (userId: string, orgId: string) =>
    `pms:ai-context:${userId}:${orgId}`,

  // Dashboard stats (TTL: 30 sec)
  dashboardStats: (userId: string, orgId: string) =>
    `pms:dashboard-stats:${userId}:${orgId}`,

  // Performance metrics (TTL: 2 min)
  performanceMetrics: (orgId: string) => `pms:performance:${orgId}`,
} as const

/**
 * TTL values in seconds for each cache tier.
 */
export const CacheTTL = {
  // Tier 1: Stable data
  USER: 600, // 10 minutes
  ORGS: 600, // 10 minutes
  MEMBERSHIP: 300, // 5 minutes

  // Tier 2: Semi-stable data
  SIDEBAR: 300, // 5 minutes
  PROJECTS: 120, // 2 minutes
  CLIENTS: 120, // 2 minutes
  TEAMS: 300, // 5 minutes
  TAGS: 300, // 5 minutes
  LABELS: 300, // 5 minutes
  CONVERSATIONS: 120, // 2 minutes
  AI_CONTEXT: 120, // 2 minutes

  // Session
  SESSION: 300, // 5 minutes

  // Tier 3: Volatile data
  INBOX: 30, // 30 seconds
  TASKS: 30, // 30 seconds
  WORKSTREAMS: 60, // 1 minute
  SEARCH: 30, // 30 seconds
  DASHBOARD_STATS: 30, // 30 seconds
} as const
