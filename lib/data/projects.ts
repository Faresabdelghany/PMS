// Project types - data is now fetched from Supabase via lib/actions/projects.ts

import type { ProjectStatus, ProjectPriority, TaskStatus } from "@/lib/constants/status"

export type Project = {
  id: string
  name: string
  taskCount: number
  progress: number
  startDate: Date | null
  endDate: Date | null
  status: ProjectStatus
  priority: ProjectPriority
  tags: string[]
  members: string[]
  // Optional subtitle fields for card/list view
  client?: string
  typeLabel?: string
  durationLabel?: string
  tasks: Array<{
    id: string
    name: string
    assignee: string
    status: TaskStatus
    startDate: Date
    endDate: Date
  }>
}

export type FilterCounts = {
  status?: Record<string, number>
  priority?: Record<string, number>
  tags?: Record<string, number>
  members?: Record<string, number>
}

export function computeFilterCounts(list: Project[]): FilterCounts {
  const res: FilterCounts = {
    status: {},
    priority: {},
    tags: {},
    members: {},
  }
  for (const p of list) {
    // status
    res.status![p.status] = (res.status![p.status] || 0) + 1
    // priority
    res.priority![p.priority] = (res.priority![p.priority] || 0) + 1
    // tags
    for (const t of p.tags) {
      const id = t.toLowerCase()
      res.tags![id] = (res.tags![id] || 0) + 1
    }
    // members buckets
    if (p.members.length === 0) {
      res.members!["no-member"] = (res.members!["no-member"] || 0) + 1
    }
    if (p.members.length > 0) {
      res.members!["current"] = (res.members!["current"] || 0) + 1
    }
  }
  return res
}
