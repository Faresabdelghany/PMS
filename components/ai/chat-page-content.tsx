"use client"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { List } from "@phosphor-icons/react/dist/ssr/List"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { getAIContext } from "@/lib/actions/ai-context"
import type { ChatConversation, ChatMessage } from "@/lib/supabase/types"
import type { ChatContext } from "@/lib/actions/ai-types"

// Lazy-load ChatView - heaviest component (~react-markdown, remark-gfm, SWR, AI hooks)
// Loading placeholder includes the real H3 text so LCP paints during SSR, before hydration
const ChatView = dynamic(
  () => import("./chat-view").then((mod) => ({ default: mod.ChatView })),
  {
    loading: () => (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header placeholder */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        {/* Empty state — real H3 text for LCP, not a skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-6 py-12">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-violet-500/10">
              <div className="size-10 rounded-lg bg-violet-500/20" />
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
              {["Create a task", "Show overdue", "Project status"].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Input placeholder */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <Skeleton className="h-[72px] w-full rounded-3xl" />
        </div>
      </div>
    ),
  }
)

// Lazy-load ChatHistorySidebar - fetches conversations client-side, not needed for LCP
const ChatHistorySidebar = dynamic(
  () => import("./chat-history-sidebar").then((mod) => ({ default: mod.ChatHistorySidebar })),
  {
    ssr: false,
    loading: () => (
      <aside className="w-72 border-r border-border/60 bg-muted/20 flex flex-col h-full min-h-0">
        <div className="p-3">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="px-3 pb-2">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        {/* min-h matches real sidebar to prevent CLS */}
        <div className="flex-1 px-2 py-2 space-y-2 min-h-[200px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        {/* Footer placeholder — matches AI Settings button */}
        <div className="border-t border-border/60 p-2">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </aside>
    ),
  }
)

interface ChatPageContentProps {
  organizationId: string
  conversationId: string | null
  conversation?: ChatConversation | null
  initialMessages: ChatMessage[]
  initialContext?: ChatContext
  /** Server-side pre-check: skip client-side AI status fetch */
  initialAIConfigured?: boolean
}

export function ChatPageContent({
  organizationId,
  conversationId,
  conversation,
  initialMessages,
  initialContext,
  initialAIConfigured,
}: ChatPageContentProps) {
  const isMobile = useIsMobile()
  const [showHistory, setShowHistory] = useState(false)
  const [aiContext, setAIContext] = useState<ChatContext | undefined>(initialContext)

  // Fetch AI context client-side to avoid blocking server-side LCP
  useEffect(() => {
    if (!initialContext) {
      getAIContext().then((result) => {
        if (result.data) setAIContext(result.data)
      }).catch(() => {
        // Context fetch failed — chat still works with minimal context
      })
    }
  }, [initialContext])

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev)
  }, [])

  const closeHistory = useCallback(() => {
    setShowHistory(false)
  }, [])

  const chatContext: ChatContext = aiContext ?? {
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
            initialAIConfigured={initialAIConfigured}
          />
        </div>
      </div>
    </div>
  )
}
