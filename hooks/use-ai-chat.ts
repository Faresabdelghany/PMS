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
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  attachments?: Attachment[]
  action?: ActionState
  timestamp: Date
}

export interface UseAIChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  clearChat: () => void
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

// Execute an action based on its type
async function executeAction(action: ProposedAction): Promise<{ success: boolean; error?: string }> {
  const { type, data } = action

  try {
    switch (type) {
      // Task actions
      case "create_task": {
        const projectId = data.projectId as string
        if (!projectId) return { success: false, error: "Project ID is required" }
        const result = await createTask(projectId, {
          name: data.title as string,
          description: data.description as string | undefined,
          priority: data.priority as "no-priority" | "low" | "medium" | "high" | "urgent" | undefined,
          workstream_id: data.workstreamId as string | undefined,
        })
        if (result.error) return { success: false, error: result.error }
        return { success: true }
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
        return { success: true }
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
        return { success: true }
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
        return { success: true }
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
        return { success: true }
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

export function useAIChat(context: ChatContext): UseAIChatReturn {
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

        // If there's a proposed action, add it to the message
        if (response.action) {
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

    try {
      const actionResult = await executeAction(actionToExecute)

      // Update status based on result
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.action
            ? {
                ...m,
                action: {
                  ...m.action,
                  status: actionResult.success ? ("success" as ActionStatus) : ("error" as ActionStatus),
                  error: actionResult.error,
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
  }, []) // No dependencies needed - uses functional updates

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
    clearChat,
  }
}

// Re-export ChatContext type for convenience
export type { ChatContext } from "@/lib/actions/ai"
