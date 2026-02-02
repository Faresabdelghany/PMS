"use client"

import { useEffect, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { StarFour, Trash, SpinnerGap, Minus } from "@phosphor-icons/react/dist/ssr"
import { MotionDiv } from "@/components/ui/motion-lazy"
import { useAIStatus } from "@/hooks/use-ai-status"
import { useAIChat, type Attachment, type ClientSideCallbacks } from "@/hooks/use-ai-chat"
import type { ChatContext } from "@/lib/actions/ai-types"
import { AIChatMessage } from "./ai-chat-message"
import { AIChatInput } from "./ai-chat-input"
import { AISetupPrompt } from "./ai-setup-prompt"

// =============================================================================
// Types
// =============================================================================

interface AIChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMinimize: () => void
  context: ChatContext
  isLoadingContext?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function AIChatModal({ open, onOpenChange, onMinimize, context, isLoadingContext }: AIChatModalProps) {
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onMinimize()
    }
  }

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overscroll-contain"
      onClick={handleBackdropClick}
    >
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex w-full max-w-[900px] h-[90vh] max-h-[850px] rounded-3xl bg-background shadow-2xl border border-border flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-8 rounded-xl bg-violet-500/10">
              <StarFour weight="fill" className="size-5 text-violet-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">AI Assistant</h2>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onMinimize}
              className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Minimize chat"
            >
              <Minus className="size-4" weight="bold" />
            </Button>
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
                <h3 className="font-semibold text-lg text-foreground">Set up AI to get started</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Configure your AI provider and API key to unlock the AI Assistant.
                </p>
              </div>
              <AISetupPrompt onSetupComplete={handleSetupComplete}>
                <Button size="lg" className="rounded-xl">Configure AI</Button>
              </AISetupPrompt>
            </div>
          )}

          {/* AI configured - show chat interface */}
          {!isCheckingAI && !isLoadingContext && isConfigured && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" aria-live="polite" aria-atomic="false">
                {/* Empty state */}
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                    <div className="flex items-center justify-center size-14 rounded-2xl bg-violet-500/10">
                      <StarFour weight="fill" className="size-8 text-violet-500/40" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-base text-muted-foreground">
                        Ask me anything about your projects, tasks, or clients.
                      </p>
                      <p className="text-sm text-muted-foreground/70">
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
                  <div className="flex items-center gap-2.5 text-muted-foreground py-2">
                    {isLoading && !isStreaming ? (
                      <>
                        <SpinnerGap className="size-4 animate-spin motion-reduce:animate-none" />
                        <span className="text-sm">Thinking…</span>
                      </>
                    ) : (
                      <button
                        onClick={stopGeneration}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                      >
                        <span className="size-2 rounded-full bg-violet-400 animate-pulse motion-reduce:animate-none" />
                        Stop generating
                      </button>
                    )}
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
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
                  placeholder="Ask anything…"
                />
              </div>
            </>
          )}
        </div>
      </MotionDiv>
    </MotionDiv>
  )
}
