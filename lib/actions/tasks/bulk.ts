"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { CacheTags, revalidateTag } from "@/lib/cache-tags"
import { invalidate, CacheKeys } from "@/lib/cache"
import { requireAuth } from "../auth-helpers"
import type { TaskStatus } from "@/lib/supabase/types"
import type { ActionResult } from "../types"

// Bulk update task status
export async function bulkUpdateTaskStatus(
  taskIds: string[],
  status: TaskStatus
): Promise<ActionResult> {
  const { supabase } = await requireAuth()

  // Get task info for cache invalidation before update
  const { data: tasks } = await supabase
    .from("tasks")
    .select("project_id, assignee_id")
    .in("id", taskIds)

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .in("id", taskIds)

  if (error) {
    return { error: error.message }
  }

  after(async () => {
    // Invalidate individual task caches
    taskIds.forEach(id => revalidateTag(CacheTags.task(id)))
    revalidatePath("/projects")
    revalidatePath("/tasks")

    // KV cache invalidation - invalidate affected project and user task caches
    if (tasks && tasks.length > 0) {
      const projectIds = new Set<string>()
      const assigneeIds = new Set<string>()

      for (const task of tasks) {
        if (task.project_id) projectIds.add(task.project_id)
        if (task.assignee_id) assigneeIds.add(task.assignee_id)
      }

      // Get orgIds for all affected projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, organization_id")
        .in("id", Array.from(projectIds))

      const projectOrgMap = new Map(projects?.map(p => [p.id, p.organization_id]) ?? [])

      // Invalidate project task caches
      for (const projectId of projectIds) {
        await invalidate.key(CacheKeys.projectTasks(projectId))
      }

      // Invalidate user task caches
      for (const assigneeId of assigneeIds) {
        for (const [projectId, orgId] of projectOrgMap) {
          if (orgId) {
            await invalidate.key(CacheKeys.userTasks(assigneeId, orgId))
          }
        }
      }
    }
  })

  return {}
}
