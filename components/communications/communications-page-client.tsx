"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { PaperPlaneTilt, Plus, ChatsCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
} from "@/lib/actions/agent-messages"
import type {
  AgentConversation,
  AgentMessageWithSender,
  MessageType,
} from "@/lib/actions/agent-messages"
import { getAgents } from "@/lib/actions/agents"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────

interface AgentOption {
  id: string
  name: string
  avatar_url: string | null
}

interface CommunicationsPageClientProps {
  orgId: string
  userId: string
}

// ── Message Type Badge Colors ──────────────────────────────────────────

const MESSAGE_TYPE_VARIANTS: Record<MessageType, string> = {
  text: "",
  status: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  handoff: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
  task_update: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
  system: "bg-muted text-muted-foreground border-border",
}

const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  text: "Text",
  status: "Status",
  handoff: "Handoff",
  task_update: "Task Update",
  system: "System",
}

// ── Main Component ─────────────────────────────────────────────────────

export function CommunicationsPageClient({
  orgId,
  userId,
}: CommunicationsPageClientProps) {
  // ── State ──────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<AgentConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentMessageWithSender[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [newConvoOpen, setNewConvoOpen] = useState(false)
  const [newConvoTitle, setNewConvoTitle] = useState("")
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [creating, startCreating] = useTransition()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load conversations ─────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const result = await getConversations(orgId)
    if (result.data) {
      setConversations(result.data)
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // ── Load agents for new conversation dialog ────────────────────────
  useEffect(() => {
    async function fetchAgents() {
      const result = await getAgents(orgId)
      if (result.data) {
        setAgents(
          result.data.map((a) => ({
            id: a.id,
            name: a.name,
            avatar_url: a.avatar_url,
          }))
        )
      }
    }
    fetchAgents()
  }, [orgId])

  // ── Load messages for selected conversation ────────────────────────
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    let cancelled = false

    async function fetchMessages() {
      setMessagesLoading(true)
      const result = await getMessages(orgId, selectedConversationId!)
      if (!cancelled && result.data) {
        setMessages(result.data)
      }
      if (!cancelled) {
        setMessagesLoading(false)
      }
    }

    fetchMessages()

    return () => {
      cancelled = true
    }
  }, [orgId, selectedConversationId])

  // ── Auto-scroll on new messages ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Focus input when conversation changes ──────────────────────────
  useEffect(() => {
    if (selectedConversationId) {
      inputRef.current?.focus()
    }
  }, [selectedConversationId])

  // ── Send message handler ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim()
    if (!trimmed || !selectedConversationId || sending) return

    setSending(true)
    setNewMessage("")

    const result = await sendMessage(
      orgId,
      selectedConversationId,
      trimmed,
      "text",
      null,
      userId
    )

    if (result.data) {
      // Append the new message locally (no from_agent since it's from user)
      setMessages((prev) => [
        ...prev,
        { ...result.data!, from_agent: null },
      ])

      // Update conversation's last_message_at locally
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === selectedConversationId
              ? { ...c, last_message_at: new Date().toISOString() }
              : c
          )
          .sort(
            (a, b) =>
              new Date(b.last_message_at ?? 0).getTime() -
              new Date(a.last_message_at ?? 0).getTime()
          )
      )
    }

    setSending(false)
  }, [newMessage, selectedConversationId, sending, orgId, userId])

  // ── Create conversation handler ────────────────────────────────────
  const handleCreateConversation = useCallback(() => {
    if (selectedAgentIds.length === 0) return

    startCreating(async () => {
      const result = await createConversation(
        orgId,
        selectedAgentIds,
        newConvoTitle.trim() || null
      )
      if (result.data) {
        setConversations((prev) => [result.data!, ...prev])
        setSelectedConversationId(result.data.id)
        setNewConvoOpen(false)
        setNewConvoTitle("")
        setSelectedAgentIds([])
      }
    })
  }, [orgId, selectedAgentIds, newConvoTitle])

  // ── Toggle agent selection ─────────────────────────────────────────
  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    )
  }, [])

  // ── Derive selected conversation ───────────────────────────────────
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  )

  // ── Build conversation display name ────────────────────────────────
  const getConversationName = useCallback(
    (convo: AgentConversation) => {
      if (convo.title) return convo.title
      // Build name from participant agent ids
      const participantNames = convo.participant_agent_ids
        .map((id) => agents.find((a) => a.id === id)?.name)
        .filter(Boolean)
      return participantNames.length > 0
        ? participantNames.join(", ")
        : "Unnamed Conversation"
    },
    [agents]
  )

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Left Panel - Conversation List */}
      <div className="w-[300px] shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setNewConvoOpen(true)}
          >
            <Plus weight="bold" className="h-4 w-4" />
            New Conversation
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-accent/40 animate-pulse"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <ChatsCircle
                weight="light"
                className="h-10 w-10 text-muted-foreground/50 mb-3"
              />
              <p className="text-sm text-muted-foreground">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start one by clicking the button above
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConversationId(convo.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                    "hover:bg-accent/50",
                    selectedConversationId === convo.id
                      ? "bg-accent"
                      : "bg-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {getConversationName(convo)}
                    </p>
                    {convo.last_message_at && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(convo.last_message_at), {
                          addSuffix: false,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {convo.participant_agent_ids.length} participant
                    {convo.participant_agent_ids.length !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Message Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConversationId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <ChatsCircle
              weight="light"
              className="h-12 w-12 text-muted-foreground/40 mb-4"
            />
            <p className="text-sm font-medium text-muted-foreground">
              Select a conversation
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Choose a conversation from the list or start a new one
            </p>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-foreground truncate">
                  {selectedConversation
                    ? getConversationName(selectedConversation)
                    : "Conversation"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation?.participant_agent_ids.length ?? 0}{" "}
                  participant
                  {(selectedConversation?.participant_agent_ids.length ?? 0) !==
                  1
                    ? "s"
                    : ""}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex gap-3 animate-pulse"
                      >
                        <div className="h-8 w-8 rounded-full bg-accent/60 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-24 bg-accent/40 rounded" />
                          <div className="h-10 w-3/4 bg-accent/30 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      No messages yet
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Send the first message below
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isFromUser = !!msg.from_user_id
                    const agentName = msg.from_agent?.name ?? "Unknown"
                    const agentAvatar = msg.from_agent?.avatar_url ?? null

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3",
                          isFromUser ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        {/* Avatar */}
                        {!isFromUser && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={agentAvatar ?? undefined} />
                            <AvatarFallback className="text-xs bg-accent">
                              {agentName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={cn(
                            "flex flex-col max-w-[70%]",
                            isFromUser ? "items-end" : "items-start"
                          )}
                        >
                          {/* Sender name + timestamp */}
                          <div
                            className={cn(
                              "flex items-center gap-2 mb-1",
                              isFromUser ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            <span className="text-xs font-medium text-foreground">
                              {isFromUser ? "You" : agentName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(msg.created_at),
                                { addSuffix: true }
                              )}
                            </span>
                          </div>

                          {/* Message bubble */}
                          <div
                            className={cn(
                              "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                              isFromUser
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-foreground"
                            )}
                          >
                            {msg.content}
                          </div>

                          {/* Message type badge */}
                          {msg.message_type !== "text" && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-1.5 text-[10px] px-1.5 py-0",
                                MESSAGE_TYPE_VARIANTS[msg.message_type]
                              )}
                            >
                              {MESSAGE_TYPE_LABELS[msg.message_type]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="border-t border-border p-3 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Send a message..."
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || sending}
                  className="shrink-0"
                >
                  <PaperPlaneTilt weight="fill" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Select agents to start a conversation with.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="convo-title" className="text-sm font-medium">
                Title (optional)
              </Label>
              <Input
                id="convo-title"
                value={newConvoTitle}
                onChange={(e) => setNewConvoTitle(e.target.value)}
                placeholder="e.g. Sprint Planning"
              />
            </div>

            {/* Agent selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Participants
                {selectedAgentIds.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({selectedAgentIds.length} selected)
                  </span>
                )}
              </Label>
              <ScrollArea className="h-[200px] rounded-md border border-border">
                <div className="p-2 space-y-1">
                  {agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2 text-center">
                      No agents found
                    </p>
                  ) : (
                    agents.map((agent) => (
                      <label
                        key={agent.id}
                        className={cn(
                          "flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors",
                          "hover:bg-accent/50",
                          selectedAgentIds.includes(agent.id) && "bg-accent"
                        )}
                      >
                        <Checkbox
                          checked={selectedAgentIds.includes(agent.id)}
                          onCheckedChange={() => toggleAgent(agent.id)}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={agent.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-accent">
                            {agent.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground">
                          {agent.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewConvoOpen(false)
                setNewConvoTitle("")
                setSelectedAgentIds([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={selectedAgentIds.length === 0 || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
