"use client"

import { useState, useCallback, useRef } from "react"
import { PaperPlaneTilt, Paperclip, Smiley } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TaskReactions } from "./TaskReactions"
import { cn } from "@/lib/utils"
import type { TaskPanelMember } from "./TaskDetailPanel"
import dynamic from "next/dynamic"

const ProjectDescriptionEditor = dynamic(
  () => import("@/components/project-wizard/ProjectDescriptionEditor").then((m) => m.ProjectDescriptionEditor),
  { ssr: false, loading: () => <div className="h-20 bg-muted/30 rounded animate-pulse" /> }
)

interface TaskCommentEditorProps {
  onSubmit: (content: string, attachments?: string[]) => Promise<void>
  isSubmitting?: boolean
  organizationMembers?: TaskPanelMember[]
  taskId: string
  placeholder?: string
}

export function TaskCommentEditor({
  onSubmit,
  isSubmitting = false,
  organizationMembers = [],
  taskId,
  placeholder = "Write a comment...",
}: TaskCommentEditorProps) {
  const [content, setContent] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEmpty = !content.trim() && attachments.length === 0

  const handleSubmit = useCallback(async () => {
    if (isEmpty || isSubmitting) return

    // TODO: Upload attachments and get paths
    const attachmentPaths: string[] = []

    await onSubmit(content.trim(), attachmentPaths.length > 0 ? attachmentPaths : undefined)
    setContent("")
    setAttachments([])
  }, [content, isEmpty, isSubmitting, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)])
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="space-y-2">
      {/* Editor */}
      <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <div onKeyDown={handleKeyDown}>
          <ProjectDescriptionEditor
            value={content}
            onChange={setContent}
            placeholder={placeholder}
            showTemplates={false}
            className="min-h-[80px] max-h-[200px] overflow-y-auto border-0"
          />
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="px-3 py-2 border-t flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/30">
          <div className="flex items-center gap-1">
            {/* Emoji picker */}
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                >
                  <Smiley className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <TaskReactions onSelect={handleEmojiSelect} />
              </PopoverContent>
            </Popover>

            {/* File attachment */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to send
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isEmpty || isSubmitting}
              className="h-7"
            >
              <PaperPlaneTilt className="h-4 w-4 mr-1" />
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {/* Mention suggestions - shown when @ is typed */}
      {/* This would be integrated with the Tiptap Mention extension */}
    </div>
  )
}
