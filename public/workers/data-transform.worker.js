/**
 * Web Worker for heavy data transformations
 * Offloads computation from main thread to improve INP
 */

self.addEventListener('message', (event) => {
  const { type, data } = event.data

  try {
    let result

    switch (type) {
      case 'transformProjectData':
        result = transformProjectData(data)
        break

      case 'sortTasks':
        result = sortTasks(data)
        break

      case 'computeStats':
        result = computeStats(data)
        break

      default:
        throw new Error(`Unknown operation: ${type}`)
    }

    self.postMessage({ success: true, result })
  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message,
    })
  }
})

/**
 * Transform project data (expensive operation)
 */
function transformProjectData(data) {
  // Heavy transformation logic
  const { supabaseProject, tasks, workstreams, organizationMembers } = data

  // Build member map for quick lookups
  const memberMap = new Map()
  for (const member of organizationMembers || []) {
    memberMap.set(member.user_id, member)
  }

  // Transform workstreams with tasks
  const transformedWorkstreams = (workstreams || []).map((ws) => {
    const wsTasks = (tasks || []).filter((t) => t.workstream_id === ws.id)
    const done = wsTasks.filter((t) => t.status === 'done').length
    const total = wsTasks.length

    return {
      id: ws.id,
      name: ws.name,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      tasks: wsTasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        priority: t.priority,
        assignee: t.assigned_to ? memberMap.get(t.assigned_to) : null,
      })),
    }
  })

  return {
    workstreams: transformedWorkstreams,
    totalTasks: tasks?.length || 0,
    completedTasks: tasks?.filter((t) => t.status === 'done').length || 0,
  }
}

/**
 * Sort tasks by various criteria
 */
function sortTasks(data) {
  const { tasks, sortBy, sortOrder } = data

  const sorted = [...tasks].sort((a, b) => {
    let aVal, bVal

    switch (sortBy) {
      case 'priority':
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, 'no-priority': 4 }
        aVal = priorityOrder[a.priority] ?? 4
        bVal = priorityOrder[b.priority] ?? 4
        break
      case 'status':
        const statusOrder = { 'in-progress': 0, todo: 1, done: 2 }
        aVal = statusOrder[a.status] ?? 1
        bVal = statusOrder[b.status] ?? 1
        break
      case 'dueDate':
        aVal = a.end_date ? new Date(a.end_date).getTime() : Infinity
        bVal = b.end_date ? new Date(b.end_date).getTime() : Infinity
        break
      default:
        aVal = a.order ?? 0
        bVal = b.order ?? 0
    }

    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  return sorted
}

/**
 * Compute project statistics
 */
function computeStats(data) {
  const { tasks, workstreams } = data

  const stats = {
    totalTasks: tasks?.length || 0,
    completedTasks: tasks?.filter((t) => t.status === 'done').length || 0,
    inProgressTasks: tasks?.filter((t) => t.status === 'in-progress').length || 0,
    todoTasks: tasks?.filter((t) => t.status === 'todo').length || 0,
    highPriorityTasks: tasks?.filter((t) => ['high', 'urgent'].includes(t.priority)).length || 0,
    overdueTasks: tasks?.filter((t) => {
      if (!t.end_date) return false
      return new Date(t.end_date) < new Date() && t.status !== 'done'
    }).length || 0,
    workstreamCount: workstreams?.length || 0,
  }

  stats.completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0

  return stats
}
