"use client"

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PaperPlaneRight, Paperclip, X, Plus, Microphone } from "@phosphor-icons/react/dist/ssr"
import type { Attachment } from "@/hooks/use-ai-chat"

// =============================================================================
// Types
// =============================================================================

interface AIChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void
  disabled?: boolean
  placeholder?: string
}

// =============================================================================
// File Type Detection
// =============================================================================

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".csv",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".rb",
  ".php",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".sql",
  ".graphql",
  ".env",
  ".gitignore",
  ".dockerfile",
])

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) return ""
  return filename.slice(lastDot).toLowerCase()
}

function isTextFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return TEXT_EXTENSIONS.has(ext)
}

function isPDF(filename: string): boolean {
  return getFileExtension(filename) === ".pdf"
}

function isWordDoc(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ext === ".doc" || ext === ".docx"
}

function isImage(filename: string): boolean {
  const ext = getFileExtension(filename)
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"].includes(ext)
}

// =============================================================================
// File Text Extraction
// =============================================================================

async function extractFileText(file: File): Promise<string> {
  const filename = file.name

  // Text files - read directly
  if (isTextFile(filename)) {
    try {
      return await file.text()
    } catch {
      return `[File: ${filename} - could not read contents]`
    }
  }

  // PDF - placeholder (library not installed)
  if (isPDF(filename)) {
    return `[PDF: ${filename} - PDF text extraction not available. Please copy and paste the relevant text.]`
  }

  // Word docs - placeholder
  if (isWordDoc(filename)) {
    return `[Document: ${filename} - Word document parsing not available. Please copy and paste the relevant text.]`
  }

  // Images - placeholder
  if (isImage(filename)) {
    return `[Image: ${filename}]`
  }

  // Other unsupported files
  return `[File: ${filename} - unsupported format]`
}

// =============================================================================
// Component
// =============================================================================

export function AIChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask anything…",
}: AIChatInputProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to get correct scrollHeight
    textarea.style.height = "44px"
    const scrollHeight = textarea.scrollHeight
    const newHeight = Math.min(Math.max(scrollHeight, 44), 200)
    textarea.style.height = `${newHeight}px`
  }, [])

  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustTextareaHeight()
  }

  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage && attachments.length === 0) return
    if (disabled || isProcessing) return

    onSend(trimmedMessage, attachments.length > 0 ? attachments : undefined)
    setMessage("")
    setAttachments([])

    // Reset textarea height and keep focus
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px"
      // Keep focus on textarea after sending
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
  }, [message, attachments, disabled, isProcessing, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)

    try {
      const newAttachments: Attachment[] = []

      for (const file of Array.from(files)) {
        const extractedText = await extractFileText(file)
        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || "application/octet-stream",
          extractedText,
        })
      }

      setAttachments((prev) => [...prev, ...newAttachments])
    } finally {
      setIsProcessing(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const canSend = (message.trim() || attachments.length > 0) && !disabled && !isProcessing

  return (
    <div className="space-y-2">
      {/* Attachment Preview Chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              <Paperclip className="size-3" />
              <span className="max-w-32 truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Attach files"
        accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css,.xml,.yaml,.yml,.py,.rb,.php,.java,.c,.cpp,.go,.rs,.sql,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.svg"
      />

      {/* Unified Input Container - Single seamless area */}
      <div className="rounded-3xl border border-border/50 bg-muted/50 dark:bg-muted/20">
        {/* Textarea - uses native textarea for full control */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            name="message"
            autoComplete="off"
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isProcessing}
            className="w-full min-h-[24px] max-h-[200px] resize-none bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            autoFocus
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between px-3 pb-2">
          {/* Left side - Attach Button */}
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={disabled || isProcessing}
            className="flex items-center justify-center size-7 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Attach file"
          >
            <Plus className="size-4" weight="bold" />
          </button>

          {/* Right side - Mic and Send Buttons */}
          <div className="flex items-center gap-1">
            {/* Microphone Button */}
            <button
              type="button"
              disabled={disabled || isProcessing}
              className="flex items-center justify-center size-7 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Voice input"
            >
              <Microphone className="size-4" />
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center justify-center size-7 rounded-full transition-colors disabled:text-muted-foreground/50 disabled:cursor-not-allowed text-primary hover:text-primary/80"
              aria-label="Send message"
            >
              <PaperPlaneRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
