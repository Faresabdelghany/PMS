"use client"

import { useState, useCallback } from "react"
import { Sparkle } from "@phosphor-icons/react/dist/ssr"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { AIChatSheet } from "./ai-chat-sheet"
import { getAIContext } from "@/lib/actions/ai-context"
import type { ChatContext } from "@/lib/actions/ai"

/**
 * Ask AI button for the sidebar that opens the AI chat sheet.
 * Fetches full application context when opened.
 */
export function AIChatTrigger() {
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<ChatContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpen = useCallback(async () => {
    setIsLoading(true)
    setIsOpen(true)

    // Fetch context when opening
    const result = await getAIContext()
    if (result.data) {
      setContext(result.data)
    }
    setIsLoading(false)
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Clear context when closing to free memory
      setContext(null)
    }
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

      <AIChatSheet
        open={isOpen}
        onOpenChange={handleOpenChange}
        context={chatContext}
        isLoadingContext={isLoading}
      />
    </>
  )
}
