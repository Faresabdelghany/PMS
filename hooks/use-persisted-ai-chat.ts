"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  sendChatMessage,
  type ChatContext,
  type ChatResponse,
  type ProposedAction,
} from "@/lib/actions/ai"
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
  error: string | null
  currentConversationId: string | null
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  confirmAllActions: (messageId: string) => Promise<void>
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
  const router = useRouter()

  // Initialize messages from DB
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages.map(dbMessageToLocal)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    conversationId
  )

  // Ref to access current messages synchronously
  const messagesRef = useRef<Message[]>(messages)
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

          // Update URL without navigation
          router.replace(`/chat/${convId}`, { scroll: false })
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

        // Update local message ID with DB-assigned ID
        if (userMsgResult.data) {
          const dbId = userMsgResult.data.id
          setMessages((prev) =>
            prev.map((m) => (m.id === userMessage.id ? { ...m, id: dbId } : m))
          )
          userMessage.id = dbId
        }

        // 4. Call AI
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

        const aiResult = await sendChatMessage(chatMessages, contextWithAttachments)

        if (aiResult.error) {
          setError(aiResult.error)
          // Remove user message on AI error
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
          setIsLoading(false)
          return
        }

        const response = aiResult.data as ChatResponse

        // 5. Create assistant message
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: response.content,
          timestamp: new Date(),
        }

        // Handle multiple actions
        if (response.actions && response.actions.length > 0) {
          assistantMessage.multiAction = {
            actions: response.actions.map((a) => ({
              type: a.type,
              data: a.data,
              status: "pending" as ActionStatus,
            })),
            currentIndex: 0,
            isExecuting: false,
            createdIds: {},
          }
        }
        // Handle single action (legacy)
        else if (response.action) {
          assistantMessage.action = {
            type: response.action.type,
            data: response.action.data,
            status: "pending",
          }
        }

        // Add to local state
        setMessages((prev) => [...prev, assistantMessage])

        // 6. Save assistant message to DB
        const assistantMsgResult = await addMessage(convId, {
          role: "assistant",
          content: response.content,
          action_data: assistantMessage.action,
          multi_action_data: assistantMessage.multiAction,
        })

        // Update local message ID with DB-assigned ID
        if (assistantMsgResult.data) {
          const dbId = assistantMsgResult.data.id
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessage.id ? { ...m, id: dbId } : m))
          )
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message")
      } finally {
        setIsLoading(false)
      }
    },
    [organizationId, context, router]
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

    router.push("/chat")
  }, [router])

  return {
    messages,
    isLoading,
    error,
    currentConversationId,
    sendMessage,
    confirmAction,
    confirmAllActions,
    clearChat,
  }
}
