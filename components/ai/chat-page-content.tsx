"use client"

import { useState, useCallback } from "react"
import { List } from "@phosphor-icons/react/dist/ssr/List"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { ChatHistorySidebar } from "./chat-history-sidebar"
import { ChatView } from "./chat-view"
import type { ChatConversation, ChatMessage } from "@/lib/supabase/types"
import type { ChatContext } from "@/lib/actions/ai-types"

interface ChatPageContentProps {
  organizationId: string
  conversationId: string | null
  conversation?: ChatConversation | null
  initialMessages: ChatMessage[]
  initialContext?: ChatContext
}

export function ChatPageContent({
  organizationId,
  conversationId,
  conversation,
  initialMessages,
  initialContext,
}: ChatPageContentProps) {
  const isMobile = useIsMobile()
  const [showHistory, setShowHistory] = useState(false)

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev)
  }, [])

  const closeHistory = useCallback(() => {
    setShowHistory(false)
  }, [])

  const chatContext: ChatContext = initialContext ?? {
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
    <div className="flex flex-1 flex-col min-w-0 min-h-0 m-2 border border-border rounded-lg overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-4 border-b border-border">
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
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop: History Sidebar */}
        {!isMobile && (
          <div className="hidden md:flex flex-shrink-0">
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
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* key prop forces remount when conversation changes, ensuring fresh state */}
          <ChatView
            key={conversationId ?? "new-chat"}
            organizationId={organizationId}
            conversationId={conversationId}
            conversation={conversation}
            initialMessages={initialMessages}
            context={chatContext}
          />
        </div>
      </div>
    </div>
  )
}
