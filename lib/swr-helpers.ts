import { mutate } from "swr"

/**
 * Invalidate SWR cache after mutations.
 * Call these from client components after server action mutations.
 */
export const swrInvalidate = {
  projects: (orgId: string) => mutate(["projects", orgId]),
  tasks: (projectId: string) => mutate(["tasks", projectId]),
  myTasks: (orgId: string) => mutate(["myTasks", orgId]),
  clients: (orgId: string) => mutate(["clients", orgId]),
  inbox: () => mutate("inbox"),
  unreadCount: () => mutate("unreadCount"),
  all: () => mutate(() => true, undefined, { revalidate: true }),
}
