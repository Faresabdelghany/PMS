import type { ProposedAction } from "./ai-types"

// Task actions
import { createTask, updateTask, deleteTask, updateTaskAssignee } from "./tasks"
// Project actions
import { createProject, updateProject, addProjectMember } from "./projects"
// Workstream actions
import { createWorkstream, updateWorkstream } from "./workstreams"
// Client actions
import { createClientAction, updateClient } from "./clients"
// Note actions
import { createNote, updateNote } from "./notes"

// =============================================================================
// Types
// =============================================================================

export interface ExecuteActionResult {
  success: boolean
  error?: string
  createdEntity?: {
    type: string
    id: string
    name: string
  }
}

export interface ClientSideCallbacks {
  setTheme?: (theme: string) => void
}

type ActionHandler = (
  data: Record<string, unknown>,
  callbacks?: ClientSideCallbacks
) => Promise<ExecuteActionResult>

// =============================================================================
// Action Handlers
// =============================================================================

async function handleChangeTheme(
  data: Record<string, unknown>,
  callbacks?: ClientSideCallbacks
): Promise<ExecuteActionResult> {
  const theme = data.theme as string
  if (!theme) return { success: false, error: "Theme value is required" }

  const validThemes = ["light", "dark", "system"]
  if (!validThemes.includes(theme)) {
    return { success: false, error: `Invalid theme. Must be one of: ${validThemes.join(", ")}` }
  }

  if (!callbacks?.setTheme) {
    return { success: false, error: "Theme change is not available" }
  }

  callbacks.setTheme(theme)
  return { success: true }
}

async function handleCreateTask(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const projectId = data.projectId as string
  if (!projectId) return { success: false, error: "Project ID is required" }

  const result = await createTask(projectId, {
    name: data.title as string,
    description: data.description as string | undefined,
    priority: data.priority as "no-priority" | "low" | "medium" | "high" | "urgent" | undefined,
    workstream_id: data.workstreamId as string | undefined,
    assignee_id: data.assigneeId as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return {
    success: true,
    createdEntity: result.data ? { type: "task", id: result.data.id, name: result.data.name } : undefined
  }
}

async function handleUpdateTask(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const taskId = data.taskId as string
  if (!taskId) return { success: false, error: "Task ID is required" }

  const updateData: Record<string, unknown> = {}
  if (data.title) updateData.name = data.title
  if (data.status) updateData.status = data.status
  if (data.priority) updateData.priority = data.priority
  if (data.assigneeId !== undefined) updateData.assignee_id = data.assigneeId

  const result = await updateTask(taskId, updateData)
  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleDeleteTask(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const taskId = data.taskId as string
  if (!taskId) return { success: false, error: "Task ID is required" }

  const result = await deleteTask(taskId)
  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleAssignTask(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const taskId = data.taskId as string
  const assigneeId = data.assigneeId as string | null
  if (!taskId) return { success: false, error: "Task ID is required" }

  const result = await updateTaskAssignee(taskId, assigneeId)
  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleCreateProject(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const orgId = data.orgId as string
  if (!orgId) return { success: false, error: "Organization ID is required" }

  const result = await createProject(orgId, {
    name: data.name as string,
    description: data.description as string | undefined,
    client_id: data.clientId as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return {
    success: true,
    createdEntity: result.data ? { type: "project", id: result.data.id, name: result.data.name } : undefined
  }
}

async function handleUpdateProject(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const projectId = data.projectId as string
  if (!projectId) return { success: false, error: "Project ID is required" }

  const updateData: Record<string, unknown> = {}
  if (data.name) updateData.name = data.name
  if (data.status) updateData.status = data.status
  if (data.description !== undefined) updateData.description = data.description

  const result = await updateProject(projectId, updateData)
  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleAddProjectMember(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const projectId = data.projectId as string
  const userId = data.userId as string
  const role = (data.role as "owner" | "pic" | "member" | "viewer") || "member"

  if (!projectId || !userId) {
    return { success: false, error: "Project ID and User ID are required" }
  }

  const result = await addProjectMember(projectId, userId, role)
  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleCreateWorkstream(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const projectId = data.projectId as string
  const name = data.name as string

  if (!projectId || !name) {
    return { success: false, error: "Project ID and name are required" }
  }

  const result = await createWorkstream({
    projectId,
    name,
    description: data.description as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return {
    success: true,
    createdEntity: result.data ? { type: "workstream", id: result.data.id, name: result.data.name } : undefined
  }
}

async function handleUpdateWorkstream(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const workstreamId = data.workstreamId as string
  if (!workstreamId) return { success: false, error: "Workstream ID is required" }

  const result = await updateWorkstream(workstreamId, {
    name: data.name as string | undefined,
    description: data.description as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleCreateClient(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const orgId = data.orgId as string
  if (!orgId) return { success: false, error: "Organization ID is required" }

  const result = await createClientAction(orgId, {
    name: data.name as string,
    primary_contact_email: data.email as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return {
    success: true,
    createdEntity: result.data ? { type: "client", id: result.data.id, name: result.data.name } : undefined
  }
}

async function handleUpdateClient(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const clientId = data.clientId as string
  if (!clientId) return { success: false, error: "Client ID is required" }

  const updateData: Record<string, unknown> = {}
  if (data.name) updateData.name = data.name
  if (data.email) updateData.primary_contact_email = data.email
  if (data.status) updateData.status = data.status

  const result = await updateClient(clientId, updateData)
  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleCreateNote(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const projectId = data.projectId as string
  if (!projectId) return { success: false, error: "Project ID is required" }

  const result = await createNote(projectId, {
    title: data.title as string,
    content: data.content as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return {
    success: true,
    createdEntity: result.data ? { type: "note", id: result.data.id, name: result.data.title } : undefined
  }
}

async function handleUpdateNote(data: Record<string, unknown>): Promise<ExecuteActionResult> {
  const noteId = data.noteId as string
  if (!noteId) return { success: false, error: "Note ID is required" }

  const result = await updateNote(noteId, {
    title: data.title as string | undefined,
    content: data.content as string | undefined,
  })

  if (result.error) return { success: false, error: result.error }

  return { success: true }
}

async function handleAddTeamMember(): Promise<ExecuteActionResult> {
  return { success: false, error: "Adding team members is not supported via this interface" }
}

// =============================================================================
// Action Handler Registry
// =============================================================================

const actionHandlers: Record<string, ActionHandler> = {
  change_theme: handleChangeTheme,
  create_task: handleCreateTask,
  update_task: handleUpdateTask,
  delete_task: handleDeleteTask,
  assign_task: handleAssignTask,
  create_project: handleCreateProject,
  update_project: handleUpdateProject,
  add_project_member: handleAddProjectMember,
  create_workstream: handleCreateWorkstream,
  update_workstream: handleUpdateWorkstream,
  create_client: handleCreateClient,
  update_client: handleUpdateClient,
  create_note: handleCreateNote,
  update_note: handleUpdateNote,
  add_team_member: handleAddTeamMember,
}

// =============================================================================
// Execute Action
// =============================================================================

/**
 * Execute an AI-proposed action.
 * This is a shared utility used by both useAIChat and usePersistedAIChat hooks.
 *
 * Note: Client-side actions (like change_theme) require callbacks to be passed.
 * For server-side execution, those actions will return an error.
 */
export async function executeAction(
  action: ProposedAction,
  callbacks?: ClientSideCallbacks
): Promise<ExecuteActionResult> {
  const { type, data } = action

  try {
    const handler = actionHandlers[type]

    if (!handler) {
      return { success: false, error: `Unknown action type: ${type}` }
    }

    return await handler(data, callbacks)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred",
    }
  }
}
