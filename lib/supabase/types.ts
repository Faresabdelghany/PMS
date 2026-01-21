export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enum types
export type ProjectStatus = "backlog" | "planned" | "active" | "cancelled" | "completed"
export type ProjectPriority = "urgent" | "high" | "medium" | "low"
export type TaskStatus = "todo" | "in-progress" | "done"
export type TaskPriority = "no-priority" | "low" | "medium" | "high" | "urgent"
export type ClientStatus = "prospect" | "active" | "on_hold" | "archived"
export type OrgMemberRole = "admin" | "member"
export type ProjectMemberRole = "owner" | "pic" | "member" | "viewer"
export type InvitationStatus = "pending" | "accepted" | "cancelled" | "expired"
export type NoteType = "general" | "meeting" | "audio"
export type NoteStatus = "completed" | "processing"
export type FileType = "pdf" | "zip" | "fig" | "doc" | "file" | "image" | "video" | "audio"

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
          type_label: string | null
          tags: string[]
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
          type_label?: string | null
          tags?: string[]
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
          type_label?: string | null
          tags?: string[]
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
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
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
