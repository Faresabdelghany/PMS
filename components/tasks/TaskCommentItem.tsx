"use client"

import { useState, useCallback, useEffect } from "react"
import { sanitizeHtml } from "@/lib/sanitize"
import { formatDistanceToNow } from "date-fns"
import { DotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { Smiley } from "@phosphor-icons/react/dist/ssr/Smiley"
import { Paperclip } from "@phosphor-icons/react/dist/ssr/Paperclip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { TaskReactions } from "./TaskReactions"
import type { TaskCommentWithRelations } from "@/lib/supabase/types"

interface TaskCommentItemProps {
  comment: TaskCommentWithRelations
  currentUserId?: string
  onReactionToggle?: (commentId: string, emoji: string) => Promise<void>
  onEdit?: (commentId: string, content: string) => Promise<void>
  onDelete?: (commentId: string) => Promise<void>
}

export function TaskCommentItem({
  comment,
  currentUserId,
  onReactionToggle,
  onEdit,
  onDelete,
}: TaskCommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sanitizedContent, setSanitizedContent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    sanitizeHtml(comment.content).then((html) => {
      if (!cancelled) setSanitizedContent(html)
    })
    return () => { cancelled = true }
  }, [comment.content])

  const isAuthor = currentUserId === comment.author_id
  const author = comment.author

  const handleSaveEdit = useCallback(async () => {
    if (editContent.trim() && onEdit) {
      await onEdit(comment.id, editContent.trim())
      setIsEditing(false)
    }
  }, [comment.id, editContent, onEdit])

  const handleCancelEdit = useCallback(() => {
    setEditContent(comment.content)
    setIsEditing(false)
  }, [comment.content])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSaveEdit()
    } else if (e.key === "Escape") {
      handleCancelEdit()
    }
  }

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (onReactionToggle) {
        await onReactionToggle(comment.id, emoji)
      }
      setShowEmojiPicker(false)
    },
    [comment.id, onReactionToggle]
  )

  // Render sanitized HTML content
  const renderContent = () => {
    if (!sanitizedContent) return null
    return (
      <div
        className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted"
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    )
  }

  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={author?.avatar_url ?? undefined} alt={author?.full_name || "User"} />
        <AvatarFallback className="text-xs">
          {(author?.full_name || author?.email || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {author?.full_name || author?.email || "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {comment.updated_at !== comment.created_at && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Smiley className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <TaskReactions onSelect={handleReaction} />
              </PopoverContent>
            </Popover>

            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <DotsThree className="h-4 w-4" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <PencilSimple className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete?.(comment.id)}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm">{renderContent()}</div>
        )}

        {/* Attachments */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comment.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
              >
                <Paperclip className="h-3 w-3" />
                {attachment.file_name}
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {comment.reactions && comment.reactions.length > 0 && (
          <div className="mt-2">
            <ReactionsList
              reactions={comment.reactions}
              currentUserId={currentUserId}
              onToggle={handleReaction}
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface ReactionsListProps {
  reactions: { id: string; emoji: string; user_id: string }[]
  currentUserId?: string
  onToggle: (emoji: string) => void
}

function ReactionsList({ reactions, currentUserId, onToggle }: ReactionsListProps) {
  // Group reactions by emoji
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, hasCurrentUser: false }
    }
    acc[r.emoji].count++
    if (r.user_id === currentUserId) {
      acc[r.emoji].hasCurrentUser = true
    }
    return acc
  }, {} as Record<string, { count: number; hasCurrentUser: boolean }>)

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(grouped).map(([emoji, { count, hasCurrentUser }]) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
            hasCurrentUser
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted border-transparent hover:border-muted-foreground/30"
          }`}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
    </div>
  )
}
