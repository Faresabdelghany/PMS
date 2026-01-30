"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Check, SpinnerGap, Warning, Paperclip } from "@phosphor-icons/react/dist/ssr"
import type { Message, ActionState } from "@/hooks/use-ai-chat"
import type { ProposedAction } from "@/lib/actions/ai"

// =============================================================================
// Types
// =============================================================================

interface AIChatMessageProps {
  message: Message
  onConfirmAction?: () => void
}

// =============================================================================
// Action Label Mapping
// =============================================================================

const ACTION_LABELS: Record<ProposedAction["type"], string> = {
  create_task: "Create Task",
  update_task: "Update Task",
  delete_task: "Delete Task",
  assign_task: "Assign Task",
  create_project: "Create Project",
  update_project: "Update Project",
  create_workstream: "Create Workstream",
  update_workstream: "Update Workstream",
  create_client: "Create Client",
  update_client: "Update Client",
  create_note: "Create Note",
  update_note: "Update Note",
  add_project_member: "Add Project Member",
  add_team_member: "Add Team Member",
}

// =============================================================================
// Action Confirmation Component
// =============================================================================

function ActionConfirmation({
  action,
  onConfirm,
}: {
  action: ActionState
  onConfirm?: () => void
}) {
  const label = ACTION_LABELS[action.type] || action.type

  // Pending state - show preview and confirm button
  if (action.status === "pending") {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Button size="sm" onClick={onConfirm} className="h-7 text-xs">
            Confirm
          </Button>
        </div>
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
          {JSON.stringify(action.data, null, 2)}
        </pre>
      </div>
    )
  }

  // Executing state - show spinner
  if (action.status === "executing") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <SpinnerGap className="size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Executing...</span>
      </div>
    )
  }

  // Success state - show checkmark
  if (action.status === "success") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
        <Check className="size-4 text-green-600 dark:text-green-400" weight="bold" />
        <span className="text-sm text-green-700 dark:text-green-300">
          Action completed successfully
        </span>
      </div>
    )
  }

  // Error state - show warning and retry button
  if (action.status === "error") {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
        <div className="flex items-center gap-2">
          <Warning className="size-4 text-red-600 dark:text-red-400" weight="bold" />
          <span className="text-sm text-red-700 dark:text-red-300">
            {action.error || "Action failed"}
          </span>
        </div>
        {onConfirm && (
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className="mt-2 h-7 text-xs"
          >
            Retry
          </Button>
        )}
      </div>
    )
  }

  return null
}

// =============================================================================
// Attachment Chips Component
// =============================================================================

function AttachmentChips({ attachments }: { attachments: Message["attachments"] }) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((attachment) => (
        <span
          key={attachment.id}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          <Paperclip className="size-3" />
          {attachment.name}
        </span>
      ))}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function AIChatMessage({ message, onConfirmAction }: AIChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-muted/50"
        )}
      >
        {/* Attachments */}
        {isUser && <AttachmentChips attachments={message.attachments} />}

        {/* Message Content */}
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>

        {/* Action Confirmation (assistant messages only) */}
        {!isUser && message.action && (
          <ActionConfirmation action={message.action} onConfirm={onConfirmAction} />
        )}
      </div>
    </div>
  )
}
