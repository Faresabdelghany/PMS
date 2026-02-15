export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Import status/priority types for local use in this file
import type {
  ProjectStatus as ProjectStatusType,
  ProjectPriority as ProjectPriorityType,
  TaskStatus as TaskStatusType,
  TaskPriority as TaskPriorityType,
  ClientStatus as ClientStatusType,
  DeliverableStatus as DeliverableStatusType,
} from "@/lib/constants/status"

// Re-export status/priority types from centralized constants
export type {
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  TaskPriority,
  ClientStatus,
  DeliverableStatus,
} from "@/lib/constants/status"

// Local type aliases for use within this file's Database interface
type ProjectStatus = ProjectStatusType
type ProjectPriority = ProjectPriorityType
type TaskStatus = TaskStatusType
type TaskPriority = TaskPriorityType
type ClientStatus = ClientStatusType
type DeliverableStatus = DeliverableStatusType

// Workflow enum types
export type WorkflowCategory = 'unstarted' | 'started' | 'finished' | 'canceled'
export type WorkflowEntityType = 'task' | 'project' | 'workstream'

// Color theme type
export type ColorThemeType = 'default' | 'forest' | 'ocean' | 'sunset' | 'rose' | 'supabase' | 'chatgpt' | 'midnight' | 'lavender' | 'ember' | 'mint' | 'slate'

// AI provider type (matches lib/constants/ai)
export type AIProviderDB = 'openai' | 'anthropic' | 'google' | 'groq' | 'mistral' | 'xai' | 'deepseek' | 'openrouter' | string

// Additional enum types (not status/priority related)
export type ProjectIntent = "delivery" | "experiment" | "internal"
export type SuccessType = "deliverable" | "metric" | "undefined"
export type DeadlineType = "none" | "target" | "fixed"
export type WorkStructure = "linear" | "milestones" | "multistream"
export type OrgMemberRole = "admin" | "member"
export type ProjectMemberRole = "owner" | "pic" | "member" | "viewer"
export type InvitationStatus = "pending" | "accepted" | "cancelled" | "expired"
export type NoteType = "general" | "meeting" | "audio"
export type NoteStatus = "completed" | "processing"
export type FileType = "pdf" | "zip" | "fig" | "doc" | "file" | "image" | "video" | "audio"
export type PaymentStatus = "unpaid" | "invoiced" | "paid"
export type InboxItemType = "comment" | "task_update" | "client_update" | "project_milestone" | "system"
export type LabelCategory = "type" | "duration" | "group" | "badge"
// Report enum types
export type ReportPeriodType = 'weekly' | 'monthly' | 'custom'
export type ReportProjectStatus = 'on_track' | 'behind' | 'at_risk' | 'halted' | 'completed'
export type ClientSatisfaction = 'satisfied' | 'neutral' | 'dissatisfied'
export type RiskType = 'blocker' | 'risk'
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RiskStatus = 'open' | 'mitigated' | 'resolved'
export type ReportHighlightType = 'highlight' | 'decision'

export type TaskActivityAction =
  | "created"
  | "status_changed"
  | "assignee_changed"
  | "assignee_removed"
  | "priority_changed"
  | "due_date_changed"
  | "start_date_changed"
  | "workstream_changed"
  | "description_changed"
  | "tag_changed"
  | "name_changed"

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: OrgMemberRole
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: OrgMemberRole
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: OrgMemberRole
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      teams: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          organization_id: string
          name: string
          status: ClientStatus
          industry: string | null
          website: string | null
          location: string | null
          owner_id: string | null
          primary_contact_name: string | null
          primary_contact_email: string | null
          segment: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          status?: ClientStatus
          industry?: string | null
          website?: string | null
          location?: string | null
          owner_id?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          segment?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          status?: ClientStatus
          industry?: string | null
          website?: string | null
          location?: string | null
          owner_id?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          segment?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          team_id: string | null
          client_id: string | null
          name: string
          description: string | null
          status: ProjectStatus
          priority: ProjectPriority
          progress: number
          start_date: string | null
          end_date: string | null
          intent: ProjectIntent | null
          success_type: SuccessType | null
          deadline_type: DeadlineType | null
          deadline_date: string | null
          work_structure: WorkStructure | null
          type_label: string | null
          duration_label: string | null
          location: string | null
          group_label: string | null
          label_badge: string | null
          tags: string[]
          currency: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          team_id?: string | null
          client_id?: string | null
          name: string
          description?: string | null
          status?: ProjectStatus
          priority?: ProjectPriority
          progress?: number
          start_date?: string | null
          end_date?: string | null
          intent?: ProjectIntent | null
          success_type?: SuccessType | null
          deadline_type?: DeadlineType | null
          deadline_date?: string | null
          work_structure?: WorkStructure | null
          type_label?: string | null
          duration_label?: string | null
          location?: string | null
          group_label?: string | null
          label_badge?: string | null
          tags?: string[]
          currency?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          team_id?: string | null
          client_id?: string | null
          name?: string
          description?: string | null
          status?: ProjectStatus
          priority?: ProjectPriority
          progress?: number
          start_date?: string | null
          end_date?: string | null
          intent?: ProjectIntent | null
          success_type?: SuccessType | null
          deadline_type?: DeadlineType | null
          deadline_date?: string | null
          work_structure?: WorkStructure | null
          type_label?: string | null
          duration_label?: string | null
          location?: string | null
          group_label?: string | null
          label_badge?: string | null
          tags?: string[]
          currency?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: ProjectMemberRole
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: ProjectMemberRole
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: ProjectMemberRole
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      workstreams: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          start_date: string | null
          end_date: string | null
          tag: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          tag?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          tag?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstreams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          workstream_id: string | null
          name: string
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          tag: string | null
          assignee_id: string | null
          start_date: string | null
          end_date: string | null
          sort_order: number
          source_report_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          workstream_id?: string | null
          name: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          tag?: string | null
          assignee_id?: string | null
          start_date?: string | null
          end_date?: string | null
          sort_order?: number
          source_report_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          workstream_id?: string | null
          name?: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          tag?: string | null
          assignee_id?: string | null
          start_date?: string | null
          end_date?: string | null
          sort_order?: number
          source_report_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workstream_id_fkey"
            columns: ["workstream_id"]
            isOneToOne: false
            referencedRelation: "workstreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          name: string
          file_type: FileType
          size_bytes: number
          storage_path: string
          url: string
          description: string | null
          added_by_id: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          file_type: FileType
          size_bytes: number
          storage_path: string
          url: string
          description?: string | null
          added_by_id: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          file_type?: FileType
          size_bytes?: number
          storage_path?: string
          url?: string
          description?: string | null
          added_by_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_added_by_id_fkey"
            columns: ["added_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_notes: {
        Row: {
          id: string
          project_id: string
          title: string
          content: string | null
          note_type: NoteType
          status: NoteStatus
          added_by_id: string
          audio_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          content?: string | null
          note_type?: NoteType
          status?: NoteStatus
          added_by_id: string
          audio_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          content?: string | null
          note_type?: NoteType
          status?: NoteStatus
          added_by_id?: string
          audio_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_added_by_id_fkey"
            columns: ["added_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: OrgMemberRole
          token: string
          status: InvitationStatus
          invited_by_id: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role?: OrgMemberRole
          token?: string
          status?: InvitationStatus
          invited_by_id: string
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          role?: OrgMemberRole
          token?: string
          status?: InvitationStatus
          invited_by_id?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_id_fkey"
            columns: ["invited_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_scope: {
        Row: {
          id: string
          project_id: string
          item: string
          is_in_scope: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          item: string
          is_in_scope?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          item?: string
          is_in_scope?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_scope_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_outcomes: {
        Row: {
          id: string
          project_id: string
          item: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          item: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          item?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_outcomes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_features: {
        Row: {
          id: string
          project_id: string
          item: string
          priority: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          item: string
          priority?: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          item?: string
          priority?: number
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_deliverables: {
        Row: {
          id: string
          project_id: string
          title: string
          due_date: string | null
          value: number | null
          status: DeliverableStatus
          payment_status: PaymentStatus
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          due_date?: string | null
          value?: number | null
          status?: DeliverableStatus
          payment_status?: PaymentStatus
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          due_date?: string | null
          value?: number | null
          status?: DeliverableStatus
          payment_status?: PaymentStatus
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_metrics: {
        Row: {
          id: string
          project_id: string
          name: string
          target: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          target?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          target?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      inbox_items: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          actor_id: string | null
          item_type: InboxItemType
          title: string
          message: string | null
          is_read: boolean
          project_id: string | null
          task_id: string | null
          client_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          actor_id?: string | null
          item_type: InboxItemType
          title: string
          message?: string | null
          is_read?: boolean
          project_id?: string | null
          task_id?: string | null
          client_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          actor_id?: string | null
          item_type?: InboxItemType
          title?: string
          message?: string | null
          is_read?: boolean
          project_id?: string | null
          task_id?: string | null
          client_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          color: string
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          color: string
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          color?: string
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_labels: {
        Row: {
          id: string
          organization_id: string
          category: LabelCategory
          name: string
          description: string | null
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category: LabelCategory
          name: string
          description?: string | null
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category?: LabelCategory
          name?: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_conversations: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          attachments: Json | null
          action_data: Json | null
          multi_action_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          attachments?: Json | null
          action_data?: Json | null
          multi_action_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          action_data?: Json | null
          multi_action_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          }
        ]
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          author_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      task_activities: {
        Row: {
          id: string
          task_id: string
          actor_id: string
          action: string
          old_value: string | null
          new_value: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          actor_id: string
          action: string
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          actor_id?: string
          action?: string
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      task_comment_reactions: {
        Row: {
          id: string
          comment_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      task_comment_attachments: {
        Row: {
          id: string
          comment_id: string
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          mime_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comment_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          }
        ]
      }
      reports: {
        Row: {
          id: string
          organization_id: string
          created_by: string
          title: string
          period_type: ReportPeriodType
          period_start: string
          period_end: string
          project_id: string | null
          status: ReportProjectStatus
          previous_status: ReportProjectStatus | null
          client_satisfaction: ClientSatisfaction
          previous_satisfaction: ClientSatisfaction | null
          progress_percent: number
          previous_progress: number | null
          narrative: string | null
          tasks_completed: number
          tasks_in_progress: number
          tasks_overdue: number
          financial_notes: string | null
          financial_total_value: number
          financial_paid_amount: number
          financial_invoiced_amount: number
          financial_unpaid_amount: number
          financial_currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          created_by: string
          title: string
          period_type?: ReportPeriodType
          period_start: string
          period_end: string
          project_id?: string | null
          status?: ReportProjectStatus
          previous_status?: ReportProjectStatus | null
          client_satisfaction?: ClientSatisfaction
          previous_satisfaction?: ClientSatisfaction | null
          progress_percent?: number
          previous_progress?: number | null
          narrative?: string | null
          tasks_completed?: number
          tasks_in_progress?: number
          tasks_overdue?: number
          financial_notes?: string | null
          financial_total_value?: number
          financial_paid_amount?: number
          financial_invoiced_amount?: number
          financial_unpaid_amount?: number
          financial_currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          created_by?: string
          title?: string
          period_type?: ReportPeriodType
          period_start?: string
          period_end?: string
          project_id?: string | null
          status?: ReportProjectStatus
          previous_status?: ReportProjectStatus | null
          client_satisfaction?: ClientSatisfaction
          previous_satisfaction?: ClientSatisfaction | null
          progress_percent?: number
          previous_progress?: number | null
          narrative?: string | null
          tasks_completed?: number
          tasks_in_progress?: number
          tasks_overdue?: number
          financial_notes?: string | null
          financial_total_value?: number
          financial_paid_amount?: number
          financial_invoiced_amount?: number
          financial_unpaid_amount?: number
          financial_currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      report_risks: {
        Row: {
          id: string
          report_id: string
          type: RiskType
          description: string
          severity: RiskSeverity
          status: RiskStatus
          mitigation_notes: string | null
          originated_report_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          type?: RiskType
          description: string
          severity?: RiskSeverity
          status?: RiskStatus
          mitigation_notes?: string | null
          originated_report_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          type?: RiskType
          description?: string
          severity?: RiskSeverity
          status?: RiskStatus
          mitigation_notes?: string | null
          originated_report_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_risks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_risks_originated_report_id_fkey"
            columns: ["originated_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          }
        ]
      }
      report_highlights: {
        Row: {
          id: string
          report_id: string
          type: ReportHighlightType
          description: string
          sort_order: number
        }
        Insert: {
          id?: string
          report_id: string
          type?: ReportHighlightType
          description: string
          sort_order?: number
        }
        Update: {
          id?: string
          report_id?: string
          type?: ReportHighlightType
          description?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_highlights_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          }
        ]
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          ai_provider: AIProviderDB
          ai_api_key_encrypted: string | null
          ai_model_preference: string | null
          timezone: string
          week_start_day: 'monday' | 'sunday' | 'saturday'
          open_links_in_app: boolean
          notifications_in_app: boolean
          notifications_email: boolean
          color_theme: ColorThemeType
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ai_provider?: AIProviderDB
          ai_api_key_encrypted?: string | null
          ai_model_preference?: string | null
          timezone?: string
          week_start_day?: 'monday' | 'sunday' | 'saturday'
          open_links_in_app?: boolean
          notifications_in_app?: boolean
          notifications_email?: boolean
          color_theme?: ColorThemeType
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ai_provider?: AIProviderDB
          ai_api_key_encrypted?: string | null
          ai_model_preference?: string | null
          timezone?: string
          week_start_day?: 'monday' | 'sunday' | 'saturday'
          open_links_in_app?: boolean
          notifications_in_app?: boolean
          notifications_email?: boolean
          color_theme?: ColorThemeType
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      workflow_statuses: {
        Row: {
          id: string
          organization_id: string
          entity_type: WorkflowEntityType
          category: WorkflowCategory
          name: string
          description: string | null
          color: string
          is_default: boolean
          is_locked: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          entity_type: WorkflowEntityType
          category: WorkflowCategory
          name: string
          description?: string | null
          color?: string
          is_default?: boolean
          is_locked?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          entity_type?: WorkflowEntityType
          category?: WorkflowCategory
          name?: string
          description?: string | null
          color?: string
          is_default?: boolean
          is_locked?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_org_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { proj_id: string }
        Returns: boolean
      }
      can_access_task: {
        Args: { t_id: string }
        Returns: boolean
      }
      get_task_project_id: {
        Args: { t_id: string }
        Returns: string
      }
      create_default_workflow_statuses: {
        Args: { org_id: string }
        Returns: void
      }
      get_conversation_with_messages: {
        Args: { p_conversation_id: string; p_message_limit?: number }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      get_ai_context_summary: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      bulk_reorder_tasks: {
        Args: { p_task_ids: string[]; p_sort_orders: number[]; p_project_id: string }
        Returns: undefined
      }
      bulk_reorder_workstreams: {
        Args: { p_workstream_ids: string[]; p_sort_orders: number[]; p_project_id: string }
        Returns: undefined
      }
      get_task_stats: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_client_stats: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_project_stats: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_project_counts_for_clients: {
        Args: { p_client_ids: string[] }
        Returns: {
          client_id: string
          total: number
          active: number
          planned: number
          completed: number
        }[]
      }
      get_project_details: {
        Args: { p_project_id: string }
        Returns: Json
      }
    }
    Enums: {
      project_status: ProjectStatus
      project_priority: ProjectPriority
      task_status: TaskStatus
      task_priority: TaskPriority
      client_status: ClientStatus
      org_member_role: OrgMemberRole
      project_member_role: ProjectMemberRole
      invitation_status: InvitationStatus
      note_type: NoteType
      note_status: NoteStatus
      file_type: FileType
      inbox_item_type: InboxItemType
      report_period_type: ReportPeriodType
      report_project_status: ReportProjectStatus
      client_satisfaction: ClientSatisfaction
      risk_type: RiskType
      risk_severity: RiskSeverity
      risk_status: RiskStatus
      report_highlight_type: ReportHighlightType
    }
  }
}

// Helper types for easier use
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type OrganizationInsert = Database["public"]["Tables"]["organizations"]["Insert"]
export type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"]

export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"]
export type OrganizationMemberInsert = Database["public"]["Tables"]["organization_members"]["Insert"]

export type Team = Database["public"]["Tables"]["teams"]["Row"]
export type TeamInsert = Database["public"]["Tables"]["teams"]["Insert"]
export type TeamUpdate = Database["public"]["Tables"]["teams"]["Update"]

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

export type Client = Database["public"]["Tables"]["clients"]["Row"]
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"]
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"]

export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]

export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"]
export type ProjectMemberInsert = Database["public"]["Tables"]["project_members"]["Insert"]

export type Workstream = Database["public"]["Tables"]["workstreams"]["Row"]
export type WorkstreamInsert = Database["public"]["Tables"]["workstreams"]["Insert"]
export type WorkstreamUpdate = Database["public"]["Tables"]["workstreams"]["Update"]

export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]

export type ProjectFile = Database["public"]["Tables"]["project_files"]["Row"]
export type ProjectFileInsert = Database["public"]["Tables"]["project_files"]["Insert"]

export type ProjectNote = Database["public"]["Tables"]["project_notes"]["Row"]
export type ProjectNoteInsert = Database["public"]["Tables"]["project_notes"]["Insert"]
export type ProjectNoteUpdate = Database["public"]["Tables"]["project_notes"]["Update"]

export type Invitation = Database["public"]["Tables"]["invitations"]["Row"]
export type InvitationInsert = Database["public"]["Tables"]["invitations"]["Insert"]
export type InvitationUpdate = Database["public"]["Tables"]["invitations"]["Update"]

// Extended types with relations
export type ProfileWithOrgs = Profile & {
  organization_members: (OrganizationMember & {
    organization: Organization
  })[]
}

export type ProjectWithRelations = Project & {
  client?: Client | null
  team?: Team | null
  project_members?: (ProjectMember & {
    profile: Profile
  })[]
  workstreams?: (Workstream & {
    tasks: Task[]
  })[]
}

export type ClientWithOwner = Client & {
  owner?: Profile | null
}

export type TaskWithRelations = Task & {
  assignee?: Profile | null
  workstream?: Workstream | null
  project?: Project | null
}

// Project extended data types
export type ProjectDeliverable = Database["public"]["Tables"]["project_deliverables"]["Row"]

export type ProjectMetric = Database["public"]["Tables"]["project_metrics"]["Row"]

export type ProjectScope = Database["public"]["Tables"]["project_scope"]["Row"]

export type ProjectOutcome = Database["public"]["Tables"]["project_outcomes"]["Row"]

export type ProjectFeature = Database["public"]["Tables"]["project_features"]["Row"]

export type InboxItem = Database["public"]["Tables"]["inbox_items"]["Row"]
export type InboxItemInsert = Database["public"]["Tables"]["inbox_items"]["Insert"]
export type InboxItemUpdate = Database["public"]["Tables"]["inbox_items"]["Update"]

// Extended inbox item with relations
export type InboxItemWithRelations = InboxItem & {
  actor?: Profile | null
  project?: Project | null
  task?: Task | null
  client?: Client | null
}

// Organization Tags & Labels
export type OrganizationTag = Database["public"]["Tables"]["organization_tags"]["Row"]
export type OrganizationTagLean = Pick<OrganizationTag, "id" | "name" | "color">
export type OrganizationTagInsert = Database["public"]["Tables"]["organization_tags"]["Insert"]
export type OrganizationTagUpdate = Database["public"]["Tables"]["organization_tags"]["Update"]

export type OrganizationLabel = Database["public"]["Tables"]["organization_labels"]["Row"]
export type OrganizationLabelInsert = Database["public"]["Tables"]["organization_labels"]["Insert"]
export type OrganizationLabelUpdate = Database["public"]["Tables"]["organization_labels"]["Update"]

// User Preferences (extended user_settings fields)
export type UserPreferences = {
  timezone: string
  week_start_day: 'monday' | 'sunday' | 'saturday'
  open_links_in_app: boolean
  notifications_in_app: boolean
  notifications_email: boolean
}

// User Settings (from Database)
export type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"]
export type UserSettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"]
export type UserSettingsUpdate = Database["public"]["Tables"]["user_settings"]["Update"]

// Workflow status types (from Database)
export type WorkflowStatusRow = Database["public"]["Tables"]["workflow_statuses"]["Row"]
export type WorkflowStatusInsert = Database["public"]["Tables"]["workflow_statuses"]["Insert"]
export type WorkflowStatusUpdate = Database["public"]["Tables"]["workflow_statuses"]["Update"]

// Chat types
export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']

// Task Comments & Activities
export type TaskComment = Database['public']['Tables']['task_comments']['Row']
export type TaskCommentInsert = Database['public']['Tables']['task_comments']['Insert']
export type TaskCommentUpdate = Database['public']['Tables']['task_comments']['Update']

export type TaskActivity = Database['public']['Tables']['task_activities']['Row']
export type TaskActivityInsert = Database['public']['Tables']['task_activities']['Insert']

export type TaskCommentReaction = Database['public']['Tables']['task_comment_reactions']['Row']
export type TaskCommentReactionInsert = Database['public']['Tables']['task_comment_reactions']['Insert']

export type TaskCommentAttachment = Database['public']['Tables']['task_comment_attachments']['Row']
export type TaskCommentAttachmentInsert = Database['public']['Tables']['task_comment_attachments']['Insert']

// Minimal profile type for task relations (matches our SELECT queries)
export type ProfileMinimal = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>

// Task Comment with relations
export type TaskCommentWithRelations = TaskComment & {
  author: ProfileMinimal
  reactions?: TaskCommentReaction[]
  attachments?: TaskCommentAttachment[]
}

// Task Activity with relations
export type TaskActivityWithRelations = TaskActivity & {
  actor: ProfileMinimal | null
}

// Timeline item - union of comments and activities
export type TaskTimelineItem =
  | { type: 'comment'; data: TaskCommentWithRelations }
  | { type: 'activity'; data: TaskActivityWithRelations }

// Report types
export type Report = Database['public']['Tables']['reports']['Row']
export type ReportInsert = Database['public']['Tables']['reports']['Insert']
export type ReportUpdate = Database['public']['Tables']['reports']['Update']

export type ReportRisk = Database['public']['Tables']['report_risks']['Row']
export type ReportRiskInsert = Database['public']['Tables']['report_risks']['Insert']
export type ReportRiskUpdate = Database['public']['Tables']['report_risks']['Update']

export type ReportHighlight = Database['public']['Tables']['report_highlights']['Row']
export type ReportHighlightInsert = Database['public']['Tables']['report_highlights']['Insert']
export type ReportHighlightUpdate = Database['public']['Tables']['report_highlights']['Update']

// Report with relations
export type ReportWithAuthor = Report & {
  author: ProfileMinimal
}

export type ReportWithFullRelations = Report & {
  author: ProfileMinimal
  project: Pick<Project, 'id' | 'name' | 'client_id' | 'status' | 'progress' | 'currency'> | null
  report_risks: ReportRisk[]
  report_highlights: ReportHighlight[]
}
