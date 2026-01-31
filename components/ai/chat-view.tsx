"use client"

import { useEffect, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  StarFour,
  Trash,
  SpinnerGap,
  Plus,
  Warning,
  ChartBar,
  MagnifyingGlass,
  Lightbulb,
} from "@phosphor-icons/react"
import { useAIStatus } from "@/hooks/use-ai-status"
import {
  usePersistedAIChat,
  type Attachment,
} from "@/hooks/use-persisted-ai-chat"
import type { ClientSideCallbacks } from "@/lib/actions/execute-ai-action"
import type { ChatContext } from "@/lib/actions/ai"
import type { ChatConversation, ChatMessage } from "@/lib/supabase/types"
import { AIChatMessage } from "./ai-chat-message"
import { AIChatInput } from "./ai-chat-input"
import { AISetupPrompt } from "./ai-setup-prompt"

// =============================================================================
// Types
// =============================================================================

interface ChatViewProps {
  organizationId: string
  conversationId: string | null
  conversation?: ChatConversation | null
  initialMessages: ChatMessage[]
  context: ChatContext
  isLoadingContext?: boolean
}

// =============================================================================
// Error Helpers
// =============================================================================

function getErrorTitle(error: string): string {
  if (error.includes("rate limit") || error.includes("429"))
    return "Taking a breather"
  if (error.includes("API key") || error.includes("401"))
    return "Configuration needed"
  if (error.includes("timeout") || error.includes("network"))
    return "Connection issue"
  return "Something went wrong"
}

function getErrorDescription(error: string): string {
  if (error.includes("rate limit") || error.includes("429"))
    return "Too many requests. Please wait a moment and try again."
  if (error.includes("API key") || error.includes("401"))
    return "Your AI API key may be invalid. Check your AI settings."
  if (error.includes("timeout") || error.includes("network"))
    return "Could not connect to the AI provider. Check your connection."
  return error
}

// =============================================================================
// Quick Actions
// =============================================================================

const quickActions = [
  {
    icon: <Plus className="size-3.5" />,
    label: "Create a task",
    prompt: "I want to create a new task",
  },
  {
    icon: <Warning className="size-3.5" />,
    label: "Show overdue",
    prompt: "What tasks are overdue?",
  },
  {
    icon: <ChartBar className="size-3.5" />,
    label: "Project status",
    prompt: "Give me an overview of my projects",
  },
  {
    icon: <MagnifyingGlass className="size-3.5" />,
    label: "Find something",
    prompt: "Help me find ",
  },
  {
    icon: <Lightbulb className="size-3.5" />,
    label: "Plan my week",
    prompt: "Help me plan my week based on my current tasks",
  },
]

// =============================================================================
// Component
// =============================================================================

export function ChatView({
  organizationId,
  conversationId,
  conversation,
  initialMessages,
  context,
  isLoadingContext,
}: ChatViewProps) {
  const { isConfigured, isLoading: isCheckingAI, refetch } = useAIStatus()
  const { setTheme } = useTheme()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Memoize callbacks to prevent unnecessary re-renders
  const clientSideCallbacks = useMemo<ClientSideCallbacks>(
    () => ({
      setTheme,
    }),
    [setTheme]
  )

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    confirmAction,
    confirmAllActions,
    clearChat,
  } = usePersistedAIChat({
    organizationId,
    conversationId,
    initialMessages,
    context,
    clientSideCallbacks,
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading])

  const handleSendMessage = (content: string, attachments?: Attachment[]) => {
    sendMessage(content, attachments)
  }

  const handleSetupComplete = () => {
    refetch()
  }

  const retryLastMessage = () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content, lastUserMessage.attachments)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-xl bg-violet-500/10">
            <StarFour weight="fill" className="size-5 text-violet-500" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-foreground">
              {conversation?.title || "New Chat"}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isConfigured && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Clear chat"
            >
              <Trash className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Loading AI status or context */}
        {(isCheckingAI || isLoadingContext) && (
          <div className="flex-1 flex items-center justify-center">
            <SpinnerGap className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* AI not configured - show setup prompt */}
        {!isCheckingAI && !isLoadingContext && !isConfigured && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-violet-500/10">
              <StarFour weight="fill" className="size-10 text-violet-500/60" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-foreground">
                Set up AI to get started
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Configure your AI provider and API key to unlock the AI Assistant.
              </p>
            </div>
            <AISetupPrompt onSetupComplete={handleSetupComplete}>
              <Button size="lg" className="rounded-xl">
                Configure AI
              </Button>
            </AISetupPrompt>
          </div>
        )}

        {/* AI configured - show chat interface */}
        {!isCheckingAI && !isLoadingContext && isConfigured && (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Empty state with quick actions */}
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
                  <div className="flex items-center justify-center size-16 rounded-2xl bg-violet-500/10">
                    <StarFour
                      weight="fill"
                      className="size-10 text-violet-500/40"
                    />
                  </div>
                  <div className="space-y-1.5 text-center">
                    <h3 className="text-lg font-medium text-foreground">
                      How can I help you today?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Ask anything or try one of these
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleSendMessage(action.prompt)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((message) => (
                <AIChatMessage
                  key={message.id}
                  message={message}
                  onConfirmAction={
                    message.action ? () => confirmAction(message.id) : undefined
                  }
                  onConfirmAllActions={
                    message.multiAction
                      ? () => confirmAllActions(message.id)
                      : undefined
                  }
                />
              ))}

              {/* Loading indicator - bouncing dots */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/10 shrink-0">
                    <StarFour weight="fill" className="size-4 text-violet-500" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl bg-muted/50 px-4 py-3">
                    <span className="size-2 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="size-2 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="size-2 rounded-full bg-violet-400 animate-bounce" />
                  </div>
                </div>
              )}

              {/* Error display - friendlier */}
              {error && (
                <div className="flex items-start gap-3 max-w-[85%]">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 shrink-0 mt-0.5">
                    <Warning className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {getErrorTitle(error)}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {getErrorDescription(error)}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={retryLastMessage}
                      >
                        Try again
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-border px-6 py-4">
              <AIChatInput
                onSend={handleSendMessage}
                disabled={isLoading}
                placeholder="Ask anything..."
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
