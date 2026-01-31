// AI Type definitions - shared across the application
// These are pure type definitions with no runtime code

export interface WorkloadInsights {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  dueToday: number
  dueThisWeek: number
  highPriorityTasks: number
  urgentTasks: number
  hasUrgentOverdue: boolean  // Overdue by more than 3 days
  isOverloaded: boolean      // More than 15 active tasks
  oldestOverdueDays?: number // Days since oldest overdue task
}

export interface ChatContext {
  pageType: "projects_list" | "project_detail" | "my_tasks" | "clients_list" | "client_detail" | "settings" | "inbox" | "other"
  projectId?: string
  clientId?: string
  filters?: Record<string, unknown>
  // Full application data
  appData: {
    organization: { id: string; name: string }
    projects: { id: string; name: string; status: string; clientName?: string; dueDate?: string }[]
    clients: { id: string; name: string; status: string; projectCount: number }[]
    teams: { id: string; name: string; memberCount: number }[]
    members: { id: string; name: string; email: string; role: string }[]
    userTasks: { id: string; title: string; projectName: string; status: string; priority: string; dueDate?: string }[]
    inbox: { id: string; title: string; type: string; read: boolean; createdAt: string }[]
    workloadInsights?: WorkloadInsights
    // Detail data when on specific pages
    currentProject?: {
      id: string
      name: string
      description?: string
      status: string
      workstreams: { id: string; name: string }[]
      tasks: { id: string; title: string; status: string; priority: string; assignee?: string }[]
      notes: { id: string; title: string; content?: string }[]
      files: { id: string; name: string; type: string }[]
      members: { id: string; name: string; role: string }[]
    }
    currentClient?: {
      id: string
      name: string
      email?: string
      phone?: string
      status: string
      projects: { id: string; name: string; status: string }[]
    }
  }
  attachments?: { name: string; content: string }[]
}

export interface ProposedAction {
  type:
    | "create_task" | "update_task" | "delete_task" | "assign_task"
    | "create_project" | "update_project"
    | "create_workstream" | "update_workstream"
    | "create_client" | "update_client"
    | "create_note" | "update_note"
    | "add_project_member" | "add_team_member"
    | "change_theme"
  data: Record<string, unknown>
}

export interface SuggestedAction {
  label: string
  prompt: string
}
