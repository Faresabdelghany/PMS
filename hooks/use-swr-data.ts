"use client"

import useSWR from "swr"

/**
 * SWR hook for projects list with stale-while-revalidate.
 * @param orgId - Organization ID
 * @param initialData - Server-rendered data for instant hydration
 */
export function useProjects(orgId: string | null, initialData?: any[]) {
  return useSWR(
    orgId ? ["projects", orgId] : null,
    async () => {
      const { getProjects } = await import("@/lib/actions/projects")
      const result = await getProjects(orgId!)
      return result.data ?? []
    },
    {
      fallbackData: initialData,
      refreshInterval: 120_000,
    }
  )
}

/**
 * SWR hook for tasks list.
 * @param projectId - Project ID
 * @param initialData - Server-rendered data for instant hydration
 */
export function useTasks(projectId: string | null, initialData?: any[]) {
  return useSWR(
    projectId ? ["tasks", projectId] : null,
    async () => {
      const { getTasks } = await import("@/lib/actions/tasks")
      const result = await getTasks(projectId!)
      return result.data ?? []
    },
    {
      fallbackData: initialData,
      refreshInterval: 30_000,
    }
  )
}

/**
 * SWR hook for current user's tasks.
 * @param orgId - Organization ID
 * @param initialData - Server-rendered data for instant hydration
 */
export function useMyTasks(orgId: string | null, initialData?: any[]) {
  return useSWR(
    orgId ? ["myTasks", orgId] : null,
    async () => {
      const { getMyTasks } = await import("@/lib/actions/tasks")
      const result = await getMyTasks(orgId!)
      return result.data ?? []
    },
    {
      fallbackData: initialData,
      refreshInterval: 30_000,
    }
  )
}

/**
 * SWR hook for clients list.
 * @param orgId - Organization ID
 * @param initialData - Server-rendered data for instant hydration
 */
export function useClients(orgId: string | null, initialData?: any[]) {
  return useSWR(
    orgId ? ["clients", orgId] : null,
    async () => {
      const { getClients } = await import("@/lib/actions/clients")
      const result = await getClients(orgId!)
      return result.data ?? []
    },
    {
      fallbackData: initialData,
      refreshInterval: 120_000,
    }
  )
}

/**
 * SWR hook for inbox items.
 * @param initialData - Server-rendered data for instant hydration
 */
export function useInboxItems(initialData?: any[]) {
  return useSWR(
    "inbox",
    async () => {
      const { getInboxItems } = await import("@/lib/actions/inbox")
      const result = await getInboxItems()
      return result.data ?? []
    },
    {
      fallbackData: initialData,
      refreshInterval: 30_000,
    }
  )
}

/**
 * SWR hook for unread inbox count (for badge).
 * @param initialData - Server-rendered data for instant hydration
 */
export function useUnreadCount(initialData?: number) {
  return useSWR(
    "unreadCount",
    async () => {
      const { getUnreadCount } = await import("@/lib/actions/inbox")
      const result = await getUnreadCount()
      return result.data ?? 0
    },
    {
      fallbackData: initialData,
      refreshInterval: 15_000,
    }
  )
}
