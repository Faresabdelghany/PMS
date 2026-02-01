"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { type ChatContext, type ProposedAction, type SuggestedAction } from "@/lib/actions/ai-types"
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
  suggestedActions?: SuggestedAction[] // Follow-up suggestions
  timestamp: Date
}

export interface UseAIChatReturn {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  confirmAllActions: (messageId: string) => Promise<void>
  stopGeneration: () => void
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

// Helper to extract balanced JSON from a string starting at given character
function extractBalancedJson(str: string, openChar: '{' | '['): { json: string; endIndex: number } | null {
  const closeChar = openChar === '{' ? '}' : ']'
  if (!str.startsWith(openChar)) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\' && inString) {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === openChar) depth++
    else if (char === closeChar) {
      depth--
      if (depth === 0) {
        return { json: str.slice(0, i + 1), endIndex: i }
      }
    }
  }

  return null
}

// Extract a JSON keyword (like ACTION_JSON or ACTIONS_JSON) from anywhere in content
function extractJsonKeyword(
  content: string,
  keyword: string
): { json: unknown; remainingContent: string } | null {
  const keywordIndex = content.indexOf(keyword + ':')
  if (keywordIndex === -1) return null

  const afterKeyword = content.slice(keywordIndex + keyword.length + 1).trimStart()
  const firstChar = afterKeyword[0]

  if (firstChar !== '{' && firstChar !== '[') return null

  const extracted = extractBalancedJson(afterKeyword, firstChar as '{' | '[')
  if (!extracted) return null

  try {
    const json = JSON.parse(extracted.json)
    // Remove the keyword and JSON from content, keeping text before and after
    const before = content.slice(0, keywordIndex).trim()
    const after = afterKeyword.slice(extracted.endIndex + 1).trim()
    const remainingContent = (before + (before && after ? '\n' : '') + after).trim()
    return { json, remainingContent }
  } catch {
    return null
  }
}

// Parse actions and suggestions from completed text
function parseStreamedResponse(text: string): {
  content: string
  actions?: ProposedAction[]
  action?: ProposedAction
  suggestedActions?: SuggestedAction[]
} {
  let content = text
  let actions: ProposedAction[] | undefined
  let action: ProposedAction | undefined
  let suggestedActions: SuggestedAction[] | undefined

  // Extract SUGGESTED_ACTIONS from anywhere in content
  const suggestionsResult = extractJsonKeyword(content, 'SUGGESTED_ACTIONS')
  if (suggestionsResult && Array.isArray(suggestionsResult.json)) {
    suggestedActions = suggestionsResult.json as SuggestedAction[]
    content = suggestionsResult.remainingContent
  }

  // Extract ACTIONS_JSON (multiple actions) from anywhere in content
  const actionsResult = extractJsonKeyword(content, 'ACTIONS_JSON')
  if (actionsResult) {
    if (Array.isArray(actionsResult.json)) {
      actions = actionsResult.json as ProposedAction[]
      content = actionsResult.remainingContent
    } else if (typeof actionsResult.json === 'object' && actionsResult.json !== null) {
      // AI mistakenly used ACTIONS_JSON with single object - treat as single action
      action = actionsResult.json as ProposedAction
      content = actionsResult.remainingContent
    }
  }

  // Extract ACTION_JSON from anywhere in content
  if (!actions) {
    const actionResult = extractJsonKeyword(content, 'ACTION_JSON')
    if (actionResult) {
      if (Array.isArray(actionResult.json)) {
        // AI mistakenly used ACTION_JSON for multiple actions
        actions = actionResult.json as ProposedAction[]
      } else if (typeof actionResult.json === 'object') {
        action = actionResult.json as ProposedAction
      }
      content = actionResult.remainingContent
    }
  }

  return { content, actions, action, suggestedActions }
}

export function useAIChat(context: ChatContext, callbacks?: ClientSideCallbacks): UseAIChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref to access current messages synchronously (React 18 batching workaround)
  const messagesRef = useRef<Message[]>([])
  messagesRef.current = messages

  // AbortController for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setIsLoading(false)
  }, [])

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

      // Create assistant message placeholder for streaming
      const assistantMessageId = generateId()
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        // Build chat messages for API
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

        // Create AbortController for this request
        abortControllerRef.current = new AbortController()

        // Stream from API
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // Ensure cookies are sent for auth
          body: JSON.stringify({
            messages: chatMessages,
            context: contextWithAttachments,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to get AI response")
        }

        setIsStreaming(true)
        setIsLoading(false)

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ""
        let buffer = "" // Buffer for incomplete SSE lines

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            // Append chunk to buffer and split by newlines
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data === "[DONE]") continue

                try {
                  const json = JSON.parse(data)
                  if (json.text) {
                    fullContent += json.text
                    // Update message content progressively
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: fullContent }
                          : m
                      )
                    )
                  }
                  if (json.error) {
                    throw new Error(json.error)
                  }
                } catch (e) {
                  if (e instanceof SyntaxError) continue // Skip malformed JSON
                  throw e
                }
              }
            }
          }
        }

        // Parse completed response for actions and suggestions
        const parsed = parseStreamedResponse(fullContent)

        // Update final message with parsed content and any actions
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMessageId) return m

            const updatedMessage: Message = {
              ...m,
              content: parsed.content,
            }

            // Handle multiple actions
            if (parsed.actions && parsed.actions.length > 0) {
              updatedMessage.multiAction = {
                actions: parsed.actions.map((a) => ({
                  type: a.type,
                  data: a.data,
                  status: "pending" as ActionStatus,
                })),
                currentIndex: 0,
                isExecuting: false,
                createdIds: {},
              }
            }
            // Handle single action
            else if (parsed.action) {
              updatedMessage.action = {
                type: parsed.action.type,
                data: parsed.action.data,
                status: "pending",
              }
            }

            // Handle suggested actions
            if (parsed.suggestedActions && parsed.suggestedActions.length > 0) {
              updatedMessage.suggestedActions = parsed.suggestedActions
            }

            return updatedMessage
          })
        )
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped generation, don't show error
          return
        }
        setError(err instanceof Error ? err.message : "Failed to send message")
        // Remove both messages on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== userMessage.id && m.id !== assistantMessageId)
        )
      } finally {
        setIsStreaming(false)
        setIsLoading(false)
        abortControllerRef.current = null
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
    isStreaming,
    error,
    sendMessage,
    confirmAction,
    confirmAllActions,
    stopGeneration,
    clearChat,
  }
}

// Re-export ChatContext type for convenience
export type { ChatContext } from "@/lib/actions/ai-types"
