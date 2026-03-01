const DEFAULT_MAX_PROJECT_IDS_PER_FILTER = 10

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]

  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function escapeRealtimeFilterValue(value: string): string {
  // Supabase realtime filters use PostgREST syntax. UUIDs are safe as-is,
  // but we still defensively strip commas/parentheses to avoid malformed clauses.
  return value.replace(/[(),]/g, "")
}

export function buildTaskProjectRealtimeFilters(
  projectIds: string[],
  maxPerFilter = DEFAULT_MAX_PROJECT_IDS_PER_FILTER,
  userId?: string
): string[] {
  const uniqueProjectIds = Array.from(
    new Set(projectIds.map((id) => id.trim()).filter(Boolean))
  )

  if (uniqueProjectIds.length === 0) return []

  const projectScopedFilters = chunk(uniqueProjectIds, maxPerFilter).map((group) => {
    const serialized = group.map(escapeRealtimeFilterValue).join(",")
    return `project_id=in.(${serialized})`
  })

  if (!userId) return projectScopedFilters

  const safeUserId = escapeRealtimeFilterValue(userId)
  return projectScopedFilters.flatMap((projectFilter) => [
    `and(${projectFilter},assignee_id.eq.${safeUserId})`,
    `and(${projectFilter},created_by.eq.${safeUserId})`,
  ])
}

export function countTasksVisibleToProjects(
  taskProjectIds: string[],
  scopedProjectIds: string[]
): number {
  const scoped = new Set(scopedProjectIds)
  return taskProjectIds.filter((projectId) => scoped.has(projectId)).length
}

export const TASK_REALTIME_MAX_PROJECT_IDS_PER_FILTER =
  DEFAULT_MAX_PROJECT_IDS_PER_FILTER
