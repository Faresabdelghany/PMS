"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  type ChatContext,
  type ProposedAction,
  type SuggestedAction,
} from "@/lib/actions/ai-types"
import {
  executeAction,
  type ClientSideCallbacks,
} from "@/lib/actions/execute-ai-action"
import {
  createConversation,
  addMessage,
  updateMessageActionData,
  deleteConversation,
} from "@/lib/actions/conversations"
import type { ChatMessage } from "@/lib/supabase/types"

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
  action?: ActionState
  multiAction?: MultiActionState
  suggestedActions?: SuggestedAction[]
  timestamp: Date
}

export interface UsePersistedAIChatOptions {
  organizationId: string
  conversationId: string | null
  initialMessages: ChatMessage[]
  context: ChatContext
  clientSideCallbacks?: ClientSideCallbacks
}

export interface UsePersistedAIChatReturn {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  currentConversationId: string | null
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  confirmAllActions: (messageId: string) => Promise<void>
  stopGeneration: () => void
  clearChat: () => Promise<void>
}

// =============================================================================
// Helpers
// =============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

function parseActionData(json: unknown): ActionState | undefined {
  if (!json || typeof json !== "object") return undefined
  const data = json as Record<string, unknown>
  if (!data.type || !data.status) return undefined
  return {
    type: data.type as ActionState["type"],
    data: (data.data as Record<string, unknown>) || {},
    status: data.status as ActionState["status"],
    error: data.error as string | undefined,
    createdEntity: data.createdEntity as ActionState["createdEntity"],
  }
}

function parseMultiActionData(json: unknown): MultiActionState | undefined {
  if (!json || typeof json !== "object") return undefined
  const data = json as Record<string, unknown>
  if (!Array.isArray(data.actions)) return undefined
  return {
    actions: data.actions as ActionState[],
    currentIndex: (data.currentIndex as number) || 0,
    isExecuting: (data.isExecuting as boolean) || false,
    createdIds: (data.createdIds as MultiActionState["createdIds"]) || {},
  }
}

function parseAttachments(json: unknown): Attachment[] | undefined {
  if (!json || !Array.isArray(json)) return undefined
  return json as Attachment[]
}

function dbMessageToLocal(dbMsg: ChatMessage): Message {
  return {
    id: dbMsg.id,
    role: dbMsg.role,
    content: dbMsg.content,
    attachments: parseAttachments(dbMsg.attachments),
    action: parseActionData(dbMsg.action_data),
    multiAction: parseMultiActionData(dbMsg.multi_action_data),
    timestamp: new Date(dbMsg.created_at),
  }
}

// Parse actions and suggestions from completed streamed text
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

  // Extract SUGGESTED_ACTIONS - handles multi-line formatted JSON
  // Uses greedy match to capture entire JSON array, expects at end of content
  const suggestionsMatch = content.match(/SUGGESTED_ACTIONS:\s*(\[[\s\S]*\])\s*$/)
  if (suggestionsMatch) {
    try {
      suggestedActions = JSON.parse(suggestionsMatch[1])
      content = content.replace(/SUGGESTED_ACTIONS:\s*\[[\s\S]*\]\s*$/, "").trim()
    } catch { /* ignore parse errors */ }
  }

  // Extract ACTIONS_JSON (multiple actions) - handles multi-line formatted JSON
  const actionsMatch = content.match(/ACTIONS_JSON:\s*(\[[\s\S]*\])\s*$/)
  if (actionsMatch) {
    try {
      actions = JSON.parse(actionsMatch[1])
      content = content.replace(/ACTIONS_JSON:\s*\[[\s\S]*\]\s*$/, "").trim()
    } catch { /* ignore parse errors */ }
  }

  // Extract ACTION_JSON - handles both single object AND array (fallback for AI mistakes)
  if (!actions) {
    // First try to match array format (AI mistakenly used ACTION_JSON for multiple actions)
    const actionArrayMatch = content.match(/ACTION_JSON:\s*(\[[\s\S]*\])\s*$/)
    if (actionArrayMatch) {
      try {
        actions = JSON.parse(actionArrayMatch[1])
        content = content.replace(/ACTION_JSON:\s*\[[\s\S]*\]\s*$/, "").trim()
      } catch { /* ignore parse errors */ }
    }

    // Then try single object format
    if (!actions) {
      const actionMatch = content.match(/ACTION_JSON:\s*(\{[\s\S]*\})\s*$/)
      if (actionMatch) {
        try {
          action = JSON.parse(actionMatch[1])
          content = content.replace(/ACTION_JSON:\s*\{[\s\S]*\}\s*$/, "").trim()
        } catch { /* ignore parse errors */ }
      }
    }
  }

  return { content, actions, action, suggestedActions }
}

function generateTitleFromContent(content: string): string {
  const maxLength = 50
  if (content.length <= maxLength) return content
  const truncated = content.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")
  return lastSpace > 20 ? truncated.slice(0, lastSpace) + "..." : truncated + "..."
}

// =============================================================================
// Hook
// =============================================================================

export function usePersistedAIChat({
  organizationId,
  conversationId,
  initialMessages,
  context,
  clientSideCallbacks,
}: UsePersistedAIChatOptions): UsePersistedAIChatReturn {

  // Initialize messages from DB
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages.map(dbMessageToLocal)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    conversationId
  )

  // Ref to access current messages synchronously
  const messagesRef = useRef<Message[]>(messages)

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
  messagesRef.current = messages

  // Ref to track current conversation ID synchronously
  const conversationIdRef = useRef<string | null>(conversationId)
  conversationIdRef.current = currentConversationId

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      setError(null)
      setIsLoading(true)

      let convId = conversationIdRef.current

      try {
        // 1. Create conversation if needed
        if (!convId) {
          const title = generateTitleFromContent(content)
          const result = await createConversation(organizationId, title)

          if (result.error || !result.data) {
            setError(result.error || "Failed to create conversation")
            setIsLoading(false)
            return
          }

          convId = result.data.id
          setCurrentConversationId(convId)
          conversationIdRef.current = convId
          // Note: URL update moved to after messages are saved
        }

        // 2. Create user message
        const userMessage: Message = {
          id: generateId(),
          role: "user",
          content,
          attachments,
          timestamp: new Date(),
        }

        // Add to local state immediately for UI
        setMessages((prev) => [...prev, userMessage])

        // 3. Save user message to DB
        const userMsgResult = await addMessage(convId, {
          role: "user",
          content,
          attachments: attachments,
        })

        // Handle message save failure
        if (userMsgResult.error || !userMsgResult.data) {
          setError(userMsgResult.error || "Failed to save message")
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
          setIsLoading(false)
          return
        }

        // Update local message ID with DB-assigned ID
        const dbId = userMsgResult.data.id
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessage.id ? { ...m, id: dbId } : m))
        )
        userMessage.id = dbId

        // 4. Prepare for streaming AI response
        const chatMessages = [...messagesRef.current].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const contextWithAttachments: ChatContext = {
          ...context,
          attachments: attachments?.map((a) => ({
            name: a.name,
            content: a.extractedText || "",
          })),
        }

        // Create assistant message placeholder for streaming
        const assistantMessageId = generateId()
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Create AbortController for this request
        abortControllerRef.current = new AbortController()

        // 5. Stream from API
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
        if (!reader) {
          throw new Error("Failed to read response stream")
        }

        const decoder = new TextDecoder()
        let fullContent = ""
        let buffer = "" // Buffer for incomplete SSE lines

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
                if (e instanceof SyntaxError) continue
                throw e
              }
            }
          }
        }

        setIsStreaming(false)

        // Parse completed response for actions and suggestions
        const parsed = parseStreamedResponse(fullContent)

        // Update final message with parsed content and any actions
        let finalMessage: Message = {
          ...assistantMessage,
          content: parsed.content,
        }

        // Handle multiple actions
        if (parsed.actions && parsed.actions.length > 0) {
          finalMessage.multiAction = {
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
          finalMessage.action = {
            type: parsed.action.type,
            data: parsed.action.data,
            status: "pending",
          }
        }

        // Handle suggested actions
        if (parsed.suggestedActions && parsed.suggestedActions.length > 0) {
          finalMessage.suggestedActions = parsed.suggestedActions
        }

        // Update local state with final parsed message
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? finalMessage : m))
        )

        // 6. Save assistant message to DB
        const assistantMsgResult = await addMessage(convId, {
          role: "assistant",
          content: parsed.content,
          action_data: finalMessage.action,
          multi_action_data: finalMessage.multiAction,
        })

        // Update local message ID with DB-assigned ID
        if (assistantMsgResult.data) {
          const dbAssistantId = assistantMsgResult.data.id
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, id: dbAssistantId } : m))
          )
          finalMessage.id = dbAssistantId
        }

        // Update URL after messages are saved (only for new conversations)
        // Use history.replaceState to avoid page navigation/remount
        if (!conversationId && convId && typeof window !== "undefined") {
          window.history.replaceState(null, "", `/chat/${convId}`)
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped generation, don't show error
          return
        }
        setError(err instanceof Error ? err.message : "Failed to send message")
      } finally {
        setIsStreaming(false)
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [organizationId, context, conversationId]
  )

  // -------------------------------------------------------------------------
  // confirmAction (single action)
  // -------------------------------------------------------------------------
  const confirmAction = useCallback(
    async (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId)
      if (!message?.action || message.action.status !== "pending") return

      const orgId = context.appData?.organization?.id

      // Mark as executing
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.action
            ? { ...m, action: { ...m.action, status: "executing" as ActionStatus } }
            : m
        )
      )

      // Prepare action data with orgId injection
      const actionData = { ...message.action.data }
      if (orgId && !actionData.orgId) {
        const actionsNeedingOrgId = ["create_project", "create_client"]
        if (actionsNeedingOrgId.includes(message.action.type)) {
          actionData.orgId = orgId
        }
      }

      try {
        const result = await executeAction(
          { type: message.action.type, data: actionData },
          clientSideCallbacks
        )

        // Update status
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.action
              ? {
                  ...m,
                  action: {
                    ...m.action,
                    status: result.success ? ("success" as ActionStatus) : ("error" as ActionStatus),
                    error: result.error,
                    createdEntity: result.createdEntity,
                  },
                }
              : m
          )
        )

        // Persist to DB
        const updatedMessage = messagesRef.current.find((m) => m.id === messageId)
        if (updatedMessage?.action && conversationIdRef.current) {
          await updateMessageActionData(messageId, updatedMessage.action)
        }
      } catch (err) {
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
    },
    [context, clientSideCallbacks]
  )

  // -------------------------------------------------------------------------
  // confirmAllActions (multiple actions)
  // -------------------------------------------------------------------------
  const confirmAllActions = useCallback(
    async (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId)
      if (!message?.multiAction || message.multiAction.isExecuting) return

      const orgId = context.appData?.organization?.id

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
      for (let i = 0; i < message.multiAction.actions.length; i++) {
        const action = message.multiAction.actions[i]

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

        if (actionData.projectId === "$NEW_PROJECT_ID" && createdIds.projectId) {
          actionData.projectId = createdIds.projectId
        }
        if (actionData.workstreamId === "$NEW_WORKSTREAM_ID" && createdIds.workstreamId) {
          actionData.workstreamId = createdIds.workstreamId
        }
        if (actionData.taskId === "$NEW_TASK_ID" && createdIds.taskId) {
          actionData.taskId = createdIds.taskId
        }
        if (actionData.clientId === "$NEW_CLIENT_ID" && createdIds.clientId) {
          actionData.clientId = createdIds.clientId
        }

        // Auto-inject orgId
        if (orgId && !actionData.orgId) {
          const actionsNeedingOrgId = ["create_project", "create_client"]
          if (actionsNeedingOrgId.includes(action.type)) {
            actionData.orgId = orgId
          }
        }

        try {
          const result = await executeAction(
            { type: action.type, data: actionData },
            clientSideCallbacks
          )

          // Track created entity IDs
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

          // Stop on failure
          if (!result.success) break
        } catch (err) {
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

      // Persist to DB
      const updatedMessage = messagesRef.current.find((m) => m.id === messageId)
      if (updatedMessage?.multiAction && conversationIdRef.current) {
        await updateMessageActionData(
          messageId,
          updatedMessage.action,
          updatedMessage.multiAction
        )
      }
    },
    [context, clientSideCallbacks]
  )

  // -------------------------------------------------------------------------
  // clearChat
  // -------------------------------------------------------------------------
  const clearChat = useCallback(async () => {
    if (conversationIdRef.current) {
      await deleteConversation(conversationIdRef.current)
    }

    setMessages([])
    setError(null)
    setCurrentConversationId(null)
    conversationIdRef.current = null

    // Navigate to /chat for a fresh start
    if (typeof window !== "undefined") {
      window.location.href = "/chat"
    }
  }, [])

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    currentConversationId,
    sendMessage,
    confirmAction,
    confirmAllActions,
    stopGeneration,
    clearChat,
  }
}
