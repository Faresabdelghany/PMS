"use client"

import { useState, useCallback, useRef } from "react"
import { sendChatMessage, type ChatContext, type ChatResponse, type ProposedAction } from "@/lib/actions/ai"
import { executeAction, type ClientSideCallbacks } from "@/lib/actions/execute-ai-action"

// Re-export for consumers
export type { ClientSideCallbacks } from "@/lib/actions/execute-ai-action"

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

// =============================================================================
// Hook
// =============================================================================

export function useAIChat(context: ChatContext, callbacks?: ClientSideCallbacks): UseAIChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref to access current messages synchronously (React 18 batching workaround)
  const messagesRef = useRef<Message[]>([])
  messagesRef.current = messages

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

    // Get the message directly from ref (React 18 batching workaround)
    const message = messagesRef.current.find((m) => m.id === messageId)

    if (!message?.multiAction || message.multiAction.isExecuting) {
      return
    }

    // Copy the multiAction data before updating state
    const multiAction = { ...message.multiAction }

    // Mark as executing
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.multiAction
          ? { ...m, multiAction: { ...m.multiAction, isExecuting: true } }
          : m
      )
    )

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
