// Project detail types - data is now fetched from Supabase via lib/actions/projects.ts
// Converters are available in lib/utils/ for transforming Supabase data to these UI types

import { getAvatarUrl } from "@/lib/assets/avatars"
import type { TaskStatus, TaskPriority } from "@/lib/constants/status"

// Re-export TaskStatus as WorkstreamTaskStatus for backwards compatibility
export type WorkstreamTaskStatus = TaskStatus

export type User = {
  id: string
  name: string
  avatarUrl?: string
  role?: string
}

export type ProjectMeta = {
  priorityLabel: string
  locationLabel: string
  sprintLabel: string
  lastSyncLabel: string
}

export type ProjectScope = {
  inScope: string[]
  outOfScope: string[]
}

export type KeyFeatures = {
  p0: string[]
  p1: string[]
  p2: string[]
}

// Timeline uses "planned" instead of "todo" for display purposes
export type TimelineTaskStatus = "planned" | "in-progress" | "done"

export type TimelineTask = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: TimelineTaskStatus
}

export type WorkstreamTask = {
  id: string
  name: string
  status: TaskStatus
  dueLabel?: string
  dueTone?: "danger" | "warning" | "muted"
  assignee?: User
  /** Optional start date for the task (used in task views). */
  startDate?: Date
  /** Optional end date for the task (used in task views). */
  endDate?: Date
  /** Optional priority identifier for the task. */
  priority?: TaskPriority
  /** Optional tag label for the task (e.g. Feature, Bug). */
  tag?: string
  /** Optional short description used in task lists. */
  description?: string
}

export type WorkstreamGroup = {
  id: string
  name: string
  tasks: WorkstreamTask[]
  /** Optional description of the workstream */
  description?: string | null
  /** Optional start date for the workstream */
  startDate?: string | null
  /** Optional end date for the workstream */
  endDate?: string | null
  /** Optional tag for the workstream */
  tag?: string | null
}

export type ProjectTask = WorkstreamTask & {
  projectId: string
  projectName: string
  workstreamId: string
  workstreamName: string
}

export type TimeSummary = {
  estimateLabel: string
  dueDate: Date | null
  daysRemainingLabel: string
  progressPercent: number
}

export type BacklogSummary = {
  statusLabel: "Active" | "Backlog" | "Planned" | "Completed" | "Cancelled"
  groupLabel: string
  priorityLabel: string
  labelBadge: string
  picUsers: User[]
  supportUsers?: User[]
}

export type QuickLink = {
  id: string
  name: string
  type: "pdf" | "zip" | "fig" | "doc" | "file"
  sizeMB: number
  url: string
  /** Storage path for generating fresh signed URLs (empty for link assets) */
  storagePath?: string
}

export type ProjectFile = QuickLink & {
  addedBy: User
  addedDate: Date
  description?: string
  isLinkAsset?: boolean
  attachments?: QuickLink[]
}

export type NoteType = "general" | "meeting" | "audio"
export type NoteStatus = "completed" | "processing"

export type TranscriptSegment = {
  id: string
  speaker: string
  timestamp: string
  text: string
}

export type AudioNoteData = {
  duration: string
  fileName: string
  aiSummary: string
  keyPoints: string[]
  insights: string[]
  transcript: TranscriptSegment[]
}

export type ProjectNote = {
  id: string
  title: string
  content?: string
  noteType: NoteType
  status: NoteStatus
  addedDate: Date
  addedBy: User
  audioData?: AudioNoteData
}

export type ProjectDetails = {
  id: string
  name: string
  description: string
  meta: ProjectMeta
  scope: ProjectScope
  outcomes: string[]
  keyFeatures: KeyFeatures
  timelineTasks: TimelineTask[]
  workstreams: WorkstreamGroup[]
  time: TimeSummary
  backlog: BacklogSummary
  quickLinks: QuickLink[]
  files: ProjectFile[]
  notes: ProjectNote[]
}

export function getProjectTasks(details: ProjectDetails): ProjectTask[] {
  const workstreams = details.workstreams ?? []

  return workstreams.flatMap((group) =>
    group.tasks.map((task) => ({
      ...task,
      projectId: details.id,
      projectName: details.name,
      workstreamId: group.id,
      workstreamName: group.name,
    })),
  )
}

export function userFromName(name: string, role?: string): User {
  return {
    id: name.trim().toLowerCase().replace(/\s+/g, "-"),
    name,
    avatarUrl: getAvatarUrl(name),
    role,
  }
}
