import type { FilterCounts } from "@/lib/data/projects"
import type { FilterChip as FilterChipType } from "@/lib/view-options"
import type { TaskStatus } from "@/lib/constants/status"

// Hoisted regex patterns for performance (avoid recreating on each call)
const HTML_TAG_REGEX = /<[^>]+>/g
const WHITESPACE_REGEX = /\s+/g
const WHITESPACE_TO_DASH_REGEX = /\s+/g

// Generic task type that works with both mock data and Supabase data
export type TaskLike = {
  id: string
  name: string
  status: TaskStatus
  priority?: string | null
  tag?: string | null
  assignee?: {
    name: string
    avatarUrl?: string | null
  } | null
  startDate?: Date | null
  endDate?: Date | null
  dueLabel?: string | null
  projectId?: string
  projectName?: string
  workstreamId?: string | null
  workstreamName?: string | null
  description?: string | null
}

// Generic project type for grouping
export type ProjectLike = {
  id: string
  name: string
  progress?: number
  status?: string
  priority?: string
  typeLabel?: string | null
  durationLabel?: string | null
}

export type ProjectTaskGroup = {
  project: ProjectLike
  tasks: TaskLike[]
}

// Helper to normalize status (uses hoisted regex)
function normalizeStatus(s: string): string {
  return s.toLowerCase().replace(WHITESPACE_TO_DASH_REGEX, "-")
}

export function filterTasksByChips(tasks: TaskLike[], chips: FilterChipType[]): TaskLike[] {
  if (!chips.length) return tasks

  // Group chips by type and convert to Sets for O(1) lookup
  const statusValues = new Set(
    chips
      .filter((chip) => chip.key.toLowerCase() === "status")
      .map((chip) => normalizeStatus(chip.value))
  )

  const priorityValues = new Set(
    chips
      .filter((chip) => chip.key.toLowerCase() === "priority")
      .map((chip) => chip.value.toLowerCase())
  )

  const tagValues = new Set(
    chips
      .filter((chip) => chip.key.toLowerCase() === "tag" || chip.key.toLowerCase() === "tags")
      .map((chip) => chip.value.toLowerCase())
  )

  const memberValues = chips
    .filter((chip) => chip.key.toLowerCase().startsWith("member") || chip.key.toLowerCase() === "pic")
    .map((chip) => chip.value.toLowerCase())

  return tasks.filter((task) => {
    // Status filter
    if (statusValues.size > 0) {
      const taskStatus = normalizeStatus(task.status)
      if (!statusValues.has(taskStatus)) return false
    }

    // Priority filter
    if (priorityValues.size > 0) {
      const taskPriority = task.priority?.toLowerCase() || "no-priority"
      if (!priorityValues.has(taskPriority)) return false
    }

    // Tags filter
    if (tagValues.size > 0) {
      const taskTag = task.tag?.toLowerCase() || ""
      if (!tagValues.has(taskTag)) return false
    }

    // Member filter (kept as array for includes() substring matching)
    if (memberValues.length > 0) {
      const name = task.assignee?.name.toLowerCase() ?? ""

      const matches = memberValues.some((value) => {
        if ((value === "unassigned" || value === "no member") && !task.assignee) return true
        if (value && name.includes(value)) return true
        return false
      })
      if (!matches) return false
    }

    return true
  })
}

export function computeTaskFilterCounts(tasks: TaskLike[]): FilterCounts {
  const counts: FilterCounts = {
    status: {
      todo: 0,
      "in-progress": 0,
      done: 0,
    },
    priority: {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    tags: {},
    members: {
      unassigned: 0,
    },
  }

  for (const task of tasks) {
    if (task.status in counts.status!) {
      counts.status![task.status] = (counts.status![task.status] || 0) + 1
    }

    if (task.priority) {
      const priority = task.priority.toLowerCase()
      counts.priority![priority] = (counts.priority![priority] || 0) + 1
    }

    if (task.tag) {
      const tag = task.tag.toLowerCase()
      counts.tags![tag] = (counts.tags![tag] || 0) + 1
    }

    if (!task.assignee) {
      counts.members!.unassigned = (counts.members!.unassigned || 0) + 1
    } else {
      const name = task.assignee.name.toLowerCase()
      counts.members![name] = (counts.members![name] || 0) + 1
    }
  }

  return counts
}

export function getTaskDescriptionSnippet(task: TaskLike): string {
  if (!task.description) return ""
  const plain = task.description.replace(HTML_TAG_REGEX, " ").replace(WHITESPACE_REGEX, " ").trim()
  return plain
}
