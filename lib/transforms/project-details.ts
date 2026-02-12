import type { ProjectFullDetails } from "@/lib/actions/projects"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { Workstream } from "@/lib/supabase/types"
import type {
  WorkstreamTask,
  WorkstreamTaskStatus,
  TimelineTask,
  WorkstreamGroup,
  ProjectDetails,
  ProjectNote,
  NoteType,
  NoteStatus,
  ProjectFile,
} from "@/lib/data/project-details"
import { formatDueLabel, getDueTone } from "@/lib/date-utils"

// Workstream with tasks type from the action
export type WorkstreamWithTasks = Workstream & {
  tasks: {
    id: string
    name: string
    status: string
    priority: string
    assignee_id: string | null
    start_date: string | null
    end_date: string | null
    tag: string | null
    sort_order: number
  }[]
}

export type OrganizationMember = {
  id: string
  user_id: string
  role: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

// Transform Supabase project data to UI format
export function transformProjectToUI(
  supabaseProject: ProjectFullDetails,
  tasks: TaskWithRelations[],
  workstreams: WorkstreamWithTasks[],
  organizationMembers: OrganizationMember[]
): ProjectDetails {
  // Map scope to UI format
  const inScope = supabaseProject.scope
    .filter((s) => s.is_in_scope)
    .map((s) => s.item)
  const outOfScope = supabaseProject.scope
    .filter((s) => !s.is_in_scope)
    .map((s) => s.item)

  // Map outcomes to UI format
  const outcomes = supabaseProject.outcomes.map((o) => o.item)

  // Map features to UI format (grouped by priority)
  const p0Features = supabaseProject.features
    .filter((f) => f.priority === 0)
    .map((f) => f.item)
  const p1Features = supabaseProject.features
    .filter((f) => f.priority === 1)
    .map((f) => f.item)
  const p2Features = supabaseProject.features
    .filter((f) => f.priority === 2)
    .map((f) => f.item)

  // Map workstreams to UI format with proper types
  const uiWorkstreams: WorkstreamGroup[] = workstreams.map((ws) => ({
    id: ws.id,
    name: ws.name,
    description: ws.description,
    startDate: ws.start_date,
    endDate: ws.end_date,
    tag: ws.tag,
    tasks: ws.tasks.map((t): WorkstreamTask => {
      // Find assignee from organization members if assignee_id is present
      const assigneeMember = t.assignee_id
        ? organizationMembers.find((m) => m.user_id === t.assignee_id)
        : null

      // Parse dates
      const startDate = t.start_date ? new Date(t.start_date) : undefined
      const endDate = t.end_date ? new Date(t.end_date) : undefined

      // Map status to WorkstreamTaskStatus
      const status = (t.status === "todo" || t.status === "in-progress" || t.status === "done")
        ? t.status
        : "todo" as WorkstreamTaskStatus

      // Map priority to WorkstreamTask priority type
      const validPriorities = ["no-priority", "low", "medium", "high", "urgent"] as const
      const priority = validPriorities.includes(t.priority as typeof validPriorities[number])
        ? t.priority as typeof validPriorities[number]
        : undefined

      return {
        id: t.id,
        name: t.name,
        status,
        priority,
        startDate,
        endDate,
        dueLabel: endDate ? formatDueLabel(endDate) : undefined,
        dueTone: endDate ? getDueTone(endDate) : undefined,
        tag: t.tag || undefined,
        assignee: assigneeMember ? {
          id: assigneeMember.user_id,
          name: assigneeMember.profile.full_name || assigneeMember.profile.email,
          avatarUrl: assigneeMember.profile.avatar_url || undefined,
        } : undefined,
      }
    }),
  }))

  // Map tasks to timeline format - only include tasks with both start and end dates
  const timelineTasks: TimelineTask[] = tasks
    .filter((t) => t.start_date && t.end_date)
    .map((t) => {
      // Map TaskStatus to TimelineTask status: "todo" -> "planned"
      const status: "planned" | "in-progress" | "done" =
        t.status === "todo" ? "planned" :
        t.status === "in-progress" ? "in-progress" :
        "done"
      return {
        id: t.id,
        name: t.name,
        status,
        startDate: new Date(t.start_date!),
        endDate: new Date(t.end_date!),
      }
    })

  const statusLabel = supabaseProject.status === "active" ? "Active"
    : supabaseProject.status === "planned" ? "Planned"
    : supabaseProject.status === "completed" ? "Completed"
    : supabaseProject.status === "cancelled" ? "Cancelled"
    : "Backlog"

  const priorityLabel = supabaseProject.priority.charAt(0).toUpperCase() + supabaseProject.priority.slice(1)

  // Calculate time data
  const dueDate = supabaseProject.end_date ? new Date(supabaseProject.end_date) : null
  const now = new Date()
  let daysRemaining = 0
  let daysRemainingLabel = "No due date"

  if (dueDate) {
    daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining < 0) {
      daysRemainingLabel = `${Math.abs(daysRemaining)} days overdue`
    } else if (daysRemaining === 0) {
      daysRemainingLabel = "Due today"
    } else if (daysRemaining === 1) {
      daysRemainingLabel = "1 day remaining"
    } else {
      daysRemainingLabel = `${daysRemaining} days remaining`
    }
  }

  // Calculate estimate label from start and end dates
  let estimateLabel = "Not set"
  if (supabaseProject.start_date && supabaseProject.end_date) {
    const startDate = new Date(supabaseProject.start_date)
    const endDate = new Date(supabaseProject.end_date)
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (durationDays >= 7) {
      const weeks = Math.round(durationDays / 7)
      estimateLabel = `${weeks} week${weeks > 1 ? "s" : ""}`
    } else {
      estimateLabel = `${durationDays} day${durationDays > 1 ? "s" : ""}`
    }
  }

  return {
    id: supabaseProject.id,
    name: supabaseProject.name,
    description: supabaseProject.description || "",
    meta: {
      priorityLabel,
      locationLabel: "Remote", // Default value
      sprintLabel: "—", // No sprint data in current schema
      lastSyncLabel: "Just now", // Default value
    },
    backlog: {
      statusLabel: statusLabel as "Active" | "Backlog" | "Planned" | "Completed" | "Cancelled",
      groupLabel: supabaseProject.group_label || "General",
      priorityLabel,
      labelBadge: supabaseProject.label_badge || "Project",
      picUsers: (supabaseProject.members || [])
        .filter((m) => m.role === "owner" || m.role === "pic")
        .map((m) => ({
          id: m.profile.id,
          name: m.profile.full_name || m.profile.email,
          avatarUrl: m.profile.avatar_url || undefined,
        })),
      supportUsers: (supabaseProject.members || [])
        .filter((m) => m.role === "member")
        .map((m) => ({
          id: m.profile.id,
          name: m.profile.full_name || m.profile.email,
          avatarUrl: m.profile.avatar_url || undefined,
        })),
    },
    time: {
      estimateLabel,
      dueDate,
      daysRemainingLabel,
      progressPercent: supabaseProject.progress || 0,
    },
    scope: {
      inScope,
      outOfScope,
    },
    outcomes,
    keyFeatures: {
      p0: p0Features,
      p1: p1Features,
      p2: p2Features,
    },
    workstreams: uiWorkstreams,
    timelineTasks,
    files: (supabaseProject.files || []).map((file): ProjectFile => ({
      id: file.id,
      name: file.name,
      type: file.file_type as any,
      sizeMB: Math.round(file.size_bytes / 1024 / 1024 * 100) / 100,
      url: file.url,
      storagePath: file.storage_path || undefined,
      addedDate: new Date(file.created_at),
      addedBy: file.profiles ? {
        id: file.profiles.id,
        name: file.profiles.full_name || file.profiles.email,
        avatarUrl: file.profiles.avatar_url || undefined,
      } : {
        id: file.added_by_id,
        name: "Unknown",
        avatarUrl: undefined,
      },
      description: file.description || undefined,
    })),
    notes: (supabaseProject.notes || []).map((note): ProjectNote => ({
      id: note.id,
      title: note.title,
      content: note.content || undefined,
      noteType: note.note_type as NoteType,
      status: note.status as NoteStatus,
      addedDate: new Date(note.created_at),
      addedBy: note.author ? {
        id: note.author.id,
        name: note.author.full_name || note.author.email,
        avatarUrl: note.author.avatar_url || undefined,
      } : {
        id: note.added_by_id || "unknown",
        name: "Unknown",
        avatarUrl: undefined,
      },
    })),
    // Show the most recent files as quick links (limited to 5)
    quickLinks: (supabaseProject.files || []).slice(0, 5).map((file) => ({
      id: file.id,
      name: file.name,
      type: file.file_type as "pdf" | "zip" | "fig" | "doc" | "file",
      sizeMB: Math.round(file.size_bytes / 1024 / 1024 * 100) / 100,
      url: file.url,
      storagePath: file.storage_path || undefined,
    })),
  }
}
