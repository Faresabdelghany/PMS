"use client"

import { useState, useCallback } from "react"
import { sendChatMessage, type ChatContext, type ChatResponse, type ProposedAction } from "@/lib/actions/ai"

// Task actions
import { createTask, updateTask, deleteTask, updateTaskAssignee } from "@/lib/actions/tasks"
// Project actions
import { createProject, updateProject, addProjectMember } from "@/lib/actions/projects"
// Workstream actions
import { createWorkstream, updateWorkstream } from "@/lib/actions/workstreams"
// Client actions
import { createClientAction, updateClient } from "@/lib/actions/clients"
// Note actions
import { createNote, updateNote } from "@/lib/actions/notes"

// Client-side action callbacks
export interface ClientSideCallbacks {
  setTheme?: (theme: string) => void
}

// =============================================================================
// Types
// =============================================================================

export interface Attachment {
  id: string
  name: string
  type: string
  extractedText?: string
}

export type ActionStatus = "pending" | "executing" | "success" | "error"

export interface ActionState {
  type: ProposedAction["type"]
  data: Record<string, unknown>
  status: ActionStatus
  error?: string
  createdEntity?: { type: string; id: string; name: string }
}

// For tracking multiple actions
export interface MultiActionState {
  actions: ActionState[]
  currentIndex: number
  isExecuting: boolean
  createdIds: {
    projectId?: string
    workstreamId?: string
    taskId?: string
    clientId?: string
    noteId?: string
  }
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  attachments?: Attachment[]
  action?: ActionState           // Single action (legacy)
  multiAction?: MultiActionState // Multiple actions
  timestamp: Date
}

export interface UseAIChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  confirmAllActions: (messageId: string) => Promise<void>
  clearChat: () => void
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

// Execute an action based on its type - returns success, error, and optionally created entity info
async function executeAction(
  action: ProposedAction,
  callbacks?: ClientSideCallbacks
): Promise<{ success: boolean; error?: string; createdEntity?: { type: string; id: string; name: string } }> {
  const { type, data } = action

  try {
    switch (type) {
      // Client-side actions
      case "change_theme": {
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
      // Task actions
      case "create_task": {
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

      case "update_task": {
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

      case "delete_task": {
        const taskId = data.taskId as string
        if (!taskId) return { success: false, error: "Task ID is required" }
        const result = await deleteTask(taskId)
        if (result.error) return { success: false, error: result.error }
        return { success: true }
      }

      case "assign_task": {
        const taskId = data.taskId as string
        const assigneeId = data.assigneeId as string | null
        if (!taskId) return { success: false, error: "Task ID is required" }
        const result = await updateTaskAssignee(taskId, assigneeId)
        if (result.error) return { success: false, error: result.error }
        return { success: true }
      }

      // Project actions
      case "create_project": {
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

      case "update_project": {
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

      case "add_project_member": {
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

      // Workstream actions
      case "create_workstream": {
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

      case "update_workstream": {
        const workstreamId = data.workstreamId as string
        if (!workstreamId) return { success: false, error: "Workstream ID is required" }
        const result = await updateWorkstream(workstreamId, {
          name: data.name as string | undefined,
          description: data.description as string | undefined,
        })
        if (result.error) return { success: false, error: result.error }
        return { success: true }
      }

      // Client actions
      case "create_client": {
        const orgId = data.orgId as string
        if (!orgId) return { success: false, error: "Organization ID is required" }
        const result = await createClientAction(orgId, {
          name: data.name as string,
          primary_contact_email: data.email as string | undefined,
          // Note: phone is not a direct field, using primary_contact_name for now
        })
        if (result.error) return { success: false, error: result.error }
        return {
          success: true,
          createdEntity: result.data ? { type: "client", id: result.data.id, name: result.data.name } : undefined
        }
      }

      case "update_client": {
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

      // Note actions
      case "create_note": {
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

      case "update_note": {
        const noteId = data.noteId as string
        if (!noteId) return { success: false, error: "Note ID is required" }
        const result = await updateNote(noteId, {
          title: data.title as string | undefined,
          content: data.content as string | undefined,
        })
        if (result.error) return { success: false, error: result.error }
        return { success: true }
      }

      // Team member action - not available in teams.ts, return not supported
      case "add_team_member": {
        return { success: false, error: "Adding team members is not supported via this interface" }
      }

      default:
        return { success: false, error: `Unknown action type: ${type}` }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred",
    }
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useAIChat(context: ChatContext, callbacks?: ClientSideCallbacks): UseAIChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      setError(null)
      setIsLoading(true)

      // Create and add user message
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        attachments,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])

      try {
        // Build chat messages for API (just content and role)
        const chatMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        // Add attachments to context if provided
        const contextWithAttachments: ChatContext = {
          ...context,
          attachments: attachments?.map((a) => ({
            name: a.name,
            content: a.extractedText || "",
          })),
        }

        // Send to AI
        const result = await sendChatMessage(chatMessages, contextWithAttachments)

        if (result.error) {
          setError(result.error)
          // Remove user message on error
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
          return
        }

        const response = result.data as ChatResponse

        // Create assistant message
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: response.content,
          timestamp: new Date(),
        }

        // Handle multiple actions
        if (response.actions && response.actions.length > 0) {
          assistantMessage.multiAction = {
            actions: response.actions.map(a => ({
              type: a.type,
              data: a.data,
              status: "pending" as ActionStatus,
            })),
            currentIndex: 0,
            isExecuting: false,
            createdIds: {},
          }
        }
        // Handle single action (legacy support)
        else if (response.action) {
          assistantMessage.action = {
            type: response.action.type,
            data: response.action.data,
            status: "pending",
          }
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message")
        // Remove user message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      } finally {
        setIsLoading(false)
      }
    },
    [context, messages]
  )

  const confirmAction = useCallback(async (messageId: string) => {
    let actionToExecute: { type: ProposedAction["type"]; data: Record<string, unknown> } | null = null

    // Use functional update to atomically read current state AND set executing
    // This avoids stale closure issues with the messages array
    setMessages((prev) => {
      const message = prev.find((m) => m.id === messageId)
      if (message?.action && message.action.status === "pending") {
        actionToExecute = { type: message.action.type, data: message.action.data }
        return prev.map((m) =>
          m.id === messageId && m.action
            ? { ...m, action: { ...m.action, status: "executing" as ActionStatus } }
            : m
        )
      }
      return prev
    })

    if (!actionToExecute) return

    // Cast to non-null since we checked above (TypeScript doesn't track closure mutations)
    const actionData = actionToExecute as { type: ProposedAction["type"]; data: Record<string, unknown> }

    // Auto-inject orgId from context for actions that need it
    const orgId = context.appData?.organization?.id
    if (orgId && !actionData.data.orgId) {
      const actionsNeedingOrgId = ["create_project", "create_client"]
      if (actionsNeedingOrgId.includes(actionData.type)) {
        actionData.data.orgId = orgId
      }
    }

    try {
      const actionResult = await executeAction(actionData, callbacks)

      // Update status based on result, including created entity info if available
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.action
            ? {
                ...m,
                action: {
                  ...m.action,
                  status: actionResult.success ? ("success" as ActionStatus) : ("error" as ActionStatus),
                  error: actionResult.error,
                  createdEntity: actionResult.createdEntity,
                },
              }
            : m
        )
      )
    } catch (err) {
      // Defensive error handling for unexpected exceptions
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.action
            ? {
                ...m,
                action: {
                  ...m.action,
                  status: "error" as ActionStatus,
                  error: err instanceof Error ? err.message : "An unexpected error occurred",
                },
              }
            : m
        )
      )
    }
  }, [context, callbacks]) // context needed for orgId injection, callbacks for client-side actions

  // Execute all actions sequentially with automatic ID injection
  const confirmAllActions = useCallback(async (messageId: string) => {
    const orgId = context.appData?.organization?.id

    // Get the message and start execution
    let multiAction: MultiActionState | undefined
    setMessages((prev) => {
      const message = prev.find((m) => m.id === messageId)
      if (message?.multiAction && !message.multiAction.isExecuting) {
        multiAction = { ...message.multiAction }
        return prev.map((m) =>
          m.id === messageId && m.multiAction
            ? { ...m, multiAction: { ...m.multiAction, isExecuting: true } }
            : m
        )
      }
      return prev
    })

    if (!multiAction) return

    const createdIds: MultiActionState["createdIds"] = {}

    // Execute each action sequentially
    for (let i = 0; i < multiAction.actions.length; i++) {
      const action = multiAction.actions[i]

      // Update current index and set action to executing
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.multiAction
            ? {
                ...m,
                multiAction: {
                  ...m.multiAction,
                  currentIndex: i,
                  actions: m.multiAction.actions.map((a, idx) =>
                    idx === i ? { ...a, status: "executing" as ActionStatus } : a
                  ),
                },
              }
            : m
        )
      )

      // Replace placeholder IDs with actual created IDs
      const actionData = { ...action.data }

      // Replace $NEW_PROJECT_ID
      if (actionData.projectId === "$NEW_PROJECT_ID" && createdIds.projectId) {
        actionData.projectId = createdIds.projectId
      }
      // Replace $NEW_WORKSTREAM_ID
      if (actionData.workstreamId === "$NEW_WORKSTREAM_ID" && createdIds.workstreamId) {
        actionData.workstreamId = createdIds.workstreamId
      }
      // Replace $NEW_TASK_ID
      if (actionData.taskId === "$NEW_TASK_ID" && createdIds.taskId) {
        actionData.taskId = createdIds.taskId
      }
      // Replace $NEW_CLIENT_ID
      if (actionData.clientId === "$NEW_CLIENT_ID" && createdIds.clientId) {
        actionData.clientId = createdIds.clientId
      }

      // Auto-inject orgId for actions that need it
      if (orgId && !actionData.orgId) {
        const actionsNeedingOrgId = ["create_project", "create_client"]
        if (actionsNeedingOrgId.includes(action.type)) {
          actionData.orgId = orgId
        }
      }

      try {
        const result = await executeAction({ type: action.type, data: actionData }, callbacks)

        // Track created entity IDs for subsequent actions
        if (result.success && result.createdEntity) {
          switch (result.createdEntity.type) {
            case "project":
              createdIds.projectId = result.createdEntity.id
              break
            case "workstream":
              createdIds.workstreamId = result.createdEntity.id
              break
            case "task":
              createdIds.taskId = result.createdEntity.id
              break
            case "client":
              createdIds.clientId = result.createdEntity.id
              break
            case "note":
              createdIds.noteId = result.createdEntity.id
              break
          }
        }

        // Update action status
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.multiAction
              ? {
                  ...m,
                  multiAction: {
                    ...m.multiAction,
                    createdIds: { ...createdIds },
                    actions: m.multiAction.actions.map((a, idx) =>
                      idx === i
                        ? {
                            ...a,
                            status: result.success ? ("success" as ActionStatus) : ("error" as ActionStatus),
                            error: result.error,
                            createdEntity: result.createdEntity,
                          }
                        : a
                    ),
                  },
                }
              : m
          )
        )

        // Stop execution if an action fails
        if (!result.success) {
          break
        }
      } catch (err) {
        // Update action with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.multiAction
              ? {
                  ...m,
                  multiAction: {
                    ...m.multiAction,
                    actions: m.multiAction.actions.map((a, idx) =>
                      idx === i
                        ? {
                            ...a,
                            status: "error" as ActionStatus,
                            error: err instanceof Error ? err.message : "An unexpected error occurred",
                          }
                        : a
                    ),
                  },
                }
              : m
          )
        )
        break
      }
    }

    // Mark execution as complete
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.multiAction
          ? { ...m, multiAction: { ...m.multiAction, isExecuting: false } }
          : m
      )
    )
  }, [context, callbacks])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    confirmAction,
    confirmAllActions,
    clearChat,
  }
}

// Re-export ChatContext type for convenience
export type { ChatContext } from "@/lib/actions/ai"
