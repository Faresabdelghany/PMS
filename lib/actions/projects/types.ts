import type {
  Project,
  ProjectStatus,
  ProjectPriority,
  ProjectIntent,
  SuccessType,
  DeadlineType,
  WorkStructure,
  ProjectMember,
  DeliverableStatus,
  PaymentStatus,
  TaskPriority,
} from "@/lib/supabase/types"

// Extended type for guided wizard project creation
export type GuidedProjectInput = {
  // Base project fields
  name: string
  description?: string | null
  status?: ProjectStatus
  priority?: ProjectPriority
  start_date?: string | null
  end_date?: string | null
  client_id?: string | null
  type_label?: string | null
  tags?: string[]
  group_label?: string | null
  label_badge?: string | null

  // Guided wizard fields (stored in projects table)
  intent?: ProjectIntent | null
  success_type?: SuccessType | null
  deadline_type?: DeadlineType | null
  deadline_date?: string | null
  work_structure?: WorkStructure | null

  // Related data (stored in separate tables)
  deliverables?: { title: string; due_date?: string | null }[]
  metrics?: { name: string; target?: string | null }[]

  // Project members
  owner_id?: string
  contributor_ids?: string[]
  stakeholder_ids?: string[]

  // AI-generated starter content
  workstreams?: string[]
  starter_tasks?: {
    title: string
    description?: string
    priority: string
    workstream?: string
  }[]
}

export type ProjectFilters = {
  status?: ProjectStatus
  priority?: ProjectPriority
  clientId?: string
  teamId?: string
  search?: string
}

export type ProjectWithRelations = Project & {
  client?: { id: string; name: string } | null
  team?: { id: string; name: string } | null
  members?: (ProjectMember & {
    profile: { id: string; full_name: string | null; email: string; avatar_url: string | null }
  })[]
}

// Extended type for full project details with all related data
export type ProjectFullDetails = ProjectWithRelations & {
  scope: { id: string; item: string; is_in_scope: boolean; sort_order: number }[]
  outcomes: { id: string; item: string; sort_order: number }[]
  features: { id: string; item: string; priority: number; sort_order: number }[]
  deliverables: { id: string; title: string; due_date: string | null; value: number | null; status: DeliverableStatus; payment_status: PaymentStatus; sort_order: number }[]
  metrics: { id: string; name: string; target: string | null; sort_order: number }[]
  notes: { id: string; title: string; content: string | null; note_type: string; status: string; added_by_id: string | null; created_at: string; updated_at: string; author: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null }[]
  files: { id: string; name: string; file_type: string; size_bytes: number; url: string; storage_path: string; description: string | null; created_at: string; added_by_id: string; profiles: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null }[]
}

// Re-export types that are commonly needed
export type { TaskPriority }
