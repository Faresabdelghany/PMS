import type { FilterCounts } from "@/lib/data/projects"
import type { FilterChip as FilterChipType } from "@/lib/view-options"
import type { TaskStatus } from "@/lib/constants/status"

// Hoisted regex patterns for performance (avoid recreating on each call)
const WHITESPACE_REGEX = /\s+/g
const WHITESPACE_TO_DASH_REGEX = /\s+/g

/** Strip HTML tags using indexOf loop — avoids regex backtracking (S5852). */
function stripHtmlTags(input: string): string {
  let result = ""
  let pos = 0
  let tagStart = input.indexOf("<", pos)
  while (tagStart !== -1) {
    result += input.substring(pos, tagStart) + " "
    const tagEnd = input.indexOf(">", tagStart + 1)
    pos = tagEnd === -1 ? input.length : tagEnd + 1
    tagStart = input.indexOf("<", pos)
  }
  result += input.substring(pos)
  return result
}

// Generic task type that works with both mock data and Supabase data
export type TaskLike = {
  id: string
  name: string
  status: TaskStatus
  priority?: string | null
  tag?: string | null
  assignee?: {
    id?: string
    name: string
    avatarUrl?: string | null
  } | null
  assignedAgent?: {
    id: string
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
  subtaskCount?: number
  doneSubtaskCount?: number
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

  const agentValues = new Set(
    chips
      .filter((chip) => chip.key.toLowerCase() === "agent")
      .map((chip) => chip.value.toLowerCase())
  )

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
      const humanName = task.assignee?.name.toLowerCase() ?? ""
      const agentName = task.assignedAgent?.name.toLowerCase() ?? ""

      const matches = memberValues.some((value) => {
        if ((value === "unassigned" || value === "no member") && !task.assignee && !task.assignedAgent) return true
        if (value && humanName.includes(value)) return true
        if (value && agentName.includes(value)) return true
        return false
      })
      if (!matches) return false
    }

    // Agent filter
    if (agentValues.size > 0) {
      const hasAgent = !!task.assignedAgent
      const agentName = task.assignedAgent?.name.toLowerCase() ?? ""
      const matchesSpecificAgent = Array.from(agentValues)
        .filter((value) => value !== "all")
        .some((value) => agentName.includes(value))

      if (agentValues.has("all")) {
        if (!hasAgent) return false
      } else if (!matchesSpecificAgent) {
        return false
      }
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
    agents: {},
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

    if (!task.assignee && !task.assignedAgent) {
      counts.members!.unassigned = (counts.members!.unassigned || 0) + 1
    } else {
      const name = (task.assignee?.name || task.assignedAgent?.name || "").toLowerCase()
      if (name) {
        counts.members![name] = (counts.members![name] || 0) + 1
      }
    }

    if (task.assignedAgent) {
      const agentName = task.assignedAgent.name.toLowerCase()
      counts.agents![agentName] = (counts.agents![agentName] || 0) + 1
    }
  }

  return counts
}

export function getTaskDescriptionSnippet(task: TaskLike): string {
  if (!task.description) return ""
  const plain = stripHtmlTags(task.description).replace(WHITESPACE_REGEX, " ").trim()
  return plain
}
