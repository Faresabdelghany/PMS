"use client"

import { useState, useEffect, useCallback } from "react"
import { List } from "@phosphor-icons/react/dist/ssr"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { getAIContext } from "@/lib/actions/ai-context"
import { ChatHistorySidebar } from "./chat-history-sidebar"
import { ChatView } from "./chat-view"
import type { ChatConversation, ChatMessage } from "@/lib/supabase/types"
import type { ChatContext } from "@/lib/actions/ai"

interface ChatPageContentProps {
  organizationId: string
  conversationId: string | null
  conversation?: ChatConversation | null
  initialMessages: ChatMessage[]
}

export function ChatPageContent({
  organizationId,
  conversationId,
  conversation,
  initialMessages,
}: ChatPageContentProps) {
  const isMobile = useIsMobile()
  const [showHistory, setShowHistory] = useState(false)
  const [context, setContext] = useState<ChatContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(true)

  // Fetch AI context on mount
  useEffect(() => {
    async function loadContext() {
      setIsLoadingContext(true)
      const result = await getAIContext()
      if (result.data) {
        setContext(result.data)
      }
      setIsLoadingContext(false)
    }
    loadContext()
  }, [])

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev)
  }, [])

  const closeHistory = useCallback(() => {
    setShowHistory(false)
  }, [])

  // Default empty context while loading
  const chatContext: ChatContext = context ?? {
    pageType: "other",
    appData: {
      organization: { id: organizationId, name: "" },
      projects: [],
      clients: [],
      teams: [],
      members: [],
      userTasks: [],
      inbox: [],
    },
  }

  // History sidebar content (reused for desktop and mobile)
  const historySidebarContent = (
    <ChatHistorySidebar
      organizationId={organizationId}
      activeConversationId={conversationId}
      onConversationSelect={isMobile ? closeHistory : undefined}
    />
  )

  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />

        {/* Mobile: History toggle button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground md:hidden"
            onClick={toggleHistory}
            aria-label="Toggle chat history"
          >
            <List className="h-5 w-5" />
          </Button>
        )}

        <Breadcrumbs items={[{ label: "AI Chat" }]} />
      </div>

      {/* Split Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop: History Sidebar */}
        {!isMobile && (
          <div className="hidden md:block">
            {historySidebarContent}
          </div>
        )}

        {/* Mobile: History as Sheet */}
        {isMobile && (
          <Sheet open={showHistory} onOpenChange={setShowHistory}>
            <SheetContent side="left" className="w-72 p-0">
              {historySidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Right: Active Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatView
            organizationId={organizationId}
            conversationId={conversationId}
            conversation={conversation}
            initialMessages={initialMessages}
            context={chatContext}
            isLoadingContext={isLoadingContext}
          />
        </div>
      </div>
    </div>
  )
}
