"use client"

import { useEffect, useState, useCallback } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Bot, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { getMessages, createMessage, type TaskMessage } from "@/lib/actions/task-messages"
import { cn } from "@/lib/utils"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface TaskMessagesPanelProps {
  taskId: string
  orgId: string
  userId: string
}

export function TaskMessagesPanel({ taskId, orgId, userId }: TaskMessagesPanelProps) {
  const [messages, setMessages] = useState<TaskMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)

  const fetchMessages = useCallback(async () => {
    const result = await getMessages(taskId)
    if (result.data) setMessages(result.data)
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const handleSend = async () => {
    if (!content.trim()) return
    setSending(true)
    try {
      const result = await createMessage(orgId, taskId, content.trim(), null, userId)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setMessages((prev) => [...prev, result.data!])
        setContent("")
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-accent/40 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="h-4 w-4" />
        Agent Messages
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/60 rounded-lg bg-muted/30">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No messages yet.</p>
          <p className="text-xs text-muted-foreground/70">Agents will discuss this task here.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px] font-medium bg-muted">
                  {msg.agent ? msg.agent.name.charAt(0).toUpperCase() : (
                    <Bot className="h-3 w-3 text-muted-foreground" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {msg.agent?.name ?? "User"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment... Use @AgentName to notify"
          rows={2}
          className="text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend()
          }}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !content.trim()}
          className="self-end"
        >
          {sending ? "..." : "Send"}
        </Button>
      </div>
    </div>
  )
}
