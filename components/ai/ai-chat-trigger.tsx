"use client"

import { useState, useCallback } from "react"
import { Sparkle } from "@phosphor-icons/react/dist/ssr"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { AnimatePresence } from "@/components/ui/motion-lazy"
import { AIChatModal } from "./ai-chat-modal"
import { AIChatBubble } from "./ai-chat-bubble"
import { getAIContext } from "@/lib/actions/ai-context"
import type { ChatContext } from "@/lib/actions/ai-types"

type ChatState = "closed" | "open" | "minimized"

/**
 * Ask AI button for the sidebar that opens the AI chat modal.
 * Supports minimizing to a floating bubble.
 * Fetches full application context when opened.
 */
export function AIChatTrigger() {
  const [chatState, setChatState] = useState<ChatState>("closed")
  const [context, setContext] = useState<ChatContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [messageCount, setMessageCount] = useState(0)

  const handleOpen = useCallback(async () => {
    setIsLoading(true)
    setChatState("open")

    // Fetch context when opening
    const result = await getAIContext()
    if (result.data) {
      setContext(result.data)
    }
    setIsLoading(false)
  }, [])

  const handleMinimize = useCallback(() => {
    setChatState("minimized")
  }, [])

  const handleExpand = useCallback(() => {
    setChatState("open")
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Minimize instead of close when clicking backdrop
      setChatState("minimized")
    }
  }, [])

  const handleClose = useCallback(() => {
    setChatState("closed")
    setContext(null)
    setMessageCount(0)
  }, [])

  // Default empty context while loading
  const chatContext: ChatContext = context || {
    pageType: "other",
    appData: {
      organization: { id: "", name: "" },
      projects: [],
      clients: [],
      teams: [],
      members: [],
      userTasks: [],
      inbox: [],
    },
  }

  return (
    <>
      <SidebarMenuButton
        onClick={handleOpen}
        className="h-9 rounded-lg px-3 text-muted-foreground"
      >
        <Sparkle className="h-[18px] w-[18px]" />
        <span>Ask AI</span>
      </SidebarMenuButton>

      <AnimatePresence mode="wait">
        {/* Full modal view */}
        {chatState === "open" && (
          <AIChatModal
            key="ai-modal"
            open={true}
            onOpenChange={handleOpenChange}
            onMinimize={handleMinimize}
            context={chatContext}
            isLoadingContext={isLoading}
          />
        )}

        {/* Minimized bubble view */}
        {chatState === "minimized" && (
          <AIChatBubble
            key="ai-bubble"
            onClick={handleExpand}
            messageCount={messageCount}
          />
        )}
      </AnimatePresence>
    </>
  )
}
