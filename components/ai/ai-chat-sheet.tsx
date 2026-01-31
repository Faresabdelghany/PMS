"use client"

import { useEffect, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { StarFour, Trash, SpinnerGap } from "@phosphor-icons/react"
import { useAIStatus } from "@/hooks/use-ai-status"
import { useAIChat, type Attachment, type ClientSideCallbacks } from "@/hooks/use-ai-chat"
import type { ChatContext } from "@/lib/actions/ai"
import { AIChatMessage } from "./ai-chat-message"
import { AIChatInput } from "./ai-chat-input"
import { AISetupPrompt } from "./ai-setup-prompt"

// =============================================================================
// Types
// =============================================================================

interface AIChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ChatContext
  isLoadingContext?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function AIChatSheet({ open, onOpenChange, context, isLoadingContext }: AIChatSheetProps) {
  const { isConfigured, isLoading: isCheckingAI, refetch } = useAIStatus()
  const { setTheme } = useTheme()

  // Memoize callbacks to prevent unnecessary re-renders
  const clientSideCallbacks = useMemo<ClientSideCallbacks>(() => ({
    setTheme,
  }), [setTheme])

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    confirmAction,
    confirmAllActions,
    stopGeneration,
    clearChat,
  } = useAIChat(context, clientSideCallbacks)

  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[450px] sm:w-[500px] sm:max-w-[500px] flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <StarFour weight="fill" className="size-5 text-violet-500" />
            <SheetTitle className="text-base">AI Assistant</SheetTitle>
          </div>
          {isConfigured && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear chat"
            >
              <Trash className="size-4" />
            </Button>
          )}
        </SheetHeader>

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
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <StarFour weight="fill" className="size-12 text-violet-500/40" />
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Set up AI to get started</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Configure your AI provider and API key to unlock the AI Assistant.
                </p>
              </div>
              <AISetupPrompt onSetupComplete={handleSetupComplete}>
                <Button>Configure AI</Button>
              </AISetupPrompt>
            </div>
          )}

          {/* AI configured - show chat interface */}
          {!isCheckingAI && !isLoadingContext && isConfigured && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Empty state */}
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                    <StarFour weight="fill" className="size-10 text-violet-500/30" />
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Ask me anything about your projects, tasks, or clients.
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        I can help you find information, create tasks, and more.
                      </p>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {messages.map((message) => (
                  <AIChatMessage
                    key={message.id}
                    message={message}
                    onConfirmAction={
                      message.action
                        ? () => confirmAction(message.id)
                        : undefined
                    }
                    onConfirmAllActions={
                      message.multiAction
                        ? () => confirmAllActions(message.id)
                        : undefined
                    }
                    onSendSuggestion={(prompt) => handleSendMessage(prompt)}
                  />
                ))}

                {/* Loading/Streaming indicator */}
                {(isLoading || isStreaming) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {isLoading && !isStreaming ? (
                      <>
                        <SpinnerGap className="size-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </>
                    ) : (
                      <button
                        onClick={stopGeneration}
                        className="flex items-center gap-2 text-sm hover:text-foreground transition-colors"
                      >
                        <span className="size-2 rounded-full bg-violet-400 animate-pulse" />
                        Stop generating
                      </button>
                    )}
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </div>
                )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="flex-shrink-0 border-t border-border p-4">
                <AIChatInput
                  onSend={handleSendMessage}
                  disabled={isLoading}
                  placeholder="Ask anything..."
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
