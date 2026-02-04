"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  MagnifyingGlass,
  ChatCircle,
  Trash,
  Gear,
} from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getConversations, deleteConversation } from "@/lib/actions/conversations"
import { useSettingsDialog } from "@/components/providers/settings-dialog-provider"
import type { ChatConversation } from "@/lib/supabase/types"

interface ChatHistorySidebarProps {
  organizationId: string
  activeConversationId: string | null
  onConversationSelect?: () => void
}

interface ConversationGroup {
  label: string
  conversations: ChatConversation[]
}

function groupByDate(conversations: ChatConversation[]): ConversationGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const groups: ConversationGroup[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "This Week", conversations: [] },
    { label: "This Month", conversations: [] },
    { label: "Older", conversations: [] },
  ]

  for (const conversation of conversations) {
    const updatedAt = new Date(conversation.updated_at)

    if (updatedAt >= today) {
      groups[0].conversations.push(conversation)
    } else if (updatedAt >= yesterday) {
      groups[1].conversations.push(conversation)
    } else if (updatedAt >= thisWeek) {
      groups[2].conversations.push(conversation)
    } else if (updatedAt >= thisMonth) {
      groups[3].conversations.push(conversation)
    } else {
      groups[4].conversations.push(conversation)
    }
  }

  // Return only non-empty groups
  return groups.filter((group) => group.conversations.length > 0)
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}

export function ChatHistorySidebar({
  organizationId,
  activeConversationId,
  onConversationSelect,
}: ChatHistorySidebarProps) {
  const router = useRouter()
  const { openSettings } = useSettingsDialog()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch conversations on mount
  useEffect(() => {
    async function loadConversations() {
      setIsLoading(true)
      const result = await getConversations(organizationId)
      if (result.data) {
        setConversations(result.data)
      }
      setIsLoading(false)
    }
    loadConversations()
  }, [organizationId])

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter((c) =>
      c.title?.toLowerCase().includes(query)
    )
  }, [conversations, searchQuery])

  // Group filtered conversations by date
  const groupedConversations = useMemo(
    () => groupByDate(filteredConversations),
    [filteredConversations]
  )

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault()
    e.stopPropagation()

    setDeletingId(conversationId)
    const result = await deleteConversation(conversationId)

    if (!result.error) {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))

      // If we deleted the active conversation, navigate to /chat
      if (conversationId === activeConversationId) {
        router.push("/chat")
      }
    }
    setDeletingId(null)
  }

  const handleConversationClick = () => {
    onConversationSelect?.()
  }

  return (
    <aside className="w-72 border-r border-border/60 bg-muted/20 flex flex-col h-full min-h-0">
      {/* New Chat Button */}
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full rounded-lg justify-start gap-2"
          asChild
        >
          <Link href="/chat" onClick={handleConversationClick}>
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        </Button>
      </div>

      {/* Search Input */}
      <div className="px-3 pb-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            name="search"
            autoComplete="off"
            placeholder="Search chats…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm rounded-lg bg-muted/50"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : groupedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
            {searchQuery ? "No chats found" : "No conversations yet"}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {groupedConversations.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.conversations.map((conversation) => {
                    const isActive = conversation.id === activeConversationId
                    const isDeleting = conversation.id === deletingId

                    return (
                      <Link
                        key={conversation.id}
                        href={`/chat/${conversation.id}`}
                        prefetch={false}
                        onClick={handleConversationClick}
                        className={cn(
                          "flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors group relative",
                          isActive
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-muted",
                          isDeleting && "opacity-50 pointer-events-none"
                        )}
                      >
                        <ChatCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">
                            {conversation.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getRelativeTime(conversation.updated_at)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, conversation.id)}
                          className={cn(
                            "p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity",
                            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          )}
                          aria-label="Delete conversation"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Settings Button */}
      <div className="border-t border-border/60 p-2">
        <button
          type="button"
          onClick={() => openSettings("agents")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Gear className="h-4 w-4" />
          AI Settings
        </button>
      </div>
    </aside>
  )
}
