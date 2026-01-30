"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Check, SpinnerGap, Warning, Paperclip, Play } from "@phosphor-icons/react/dist/ssr"
import type { Message, ActionState, MultiActionState } from "@/hooks/use-ai-chat"
import type { ProposedAction } from "@/lib/actions/ai"

// =============================================================================
// Types
// =============================================================================

interface AIChatMessageProps {
  message: Message
  onConfirmAction?: () => void
  onConfirmAllActions?: () => void
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

  // Success state - show checkmark and created entity info if available
  if (action.status === "success") {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
        <div className="flex items-center gap-2">
          <Check className="size-4 text-green-600 dark:text-green-400" weight="bold" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Action completed successfully
          </span>
        </div>
        {action.createdEntity && (
          <div className="mt-2 rounded bg-green-100 p-2 dark:bg-green-900/30">
            <p className="text-xs text-green-700 dark:text-green-300">
              Created {action.createdEntity.type}: <strong>{action.createdEntity.name}</strong>
            </p>
            <p className="mt-1 font-mono text-xs text-green-600 dark:text-green-400 select-all">
              ID: {action.createdEntity.id}
            </p>
            <p className="mt-1 text-xs text-green-600/80 dark:text-green-400/80">
              (Use this ID for subsequent actions on this {action.createdEntity.type})
            </p>
          </div>
        )}
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
// Multi-Action Confirmation Component
// =============================================================================

function MultiActionConfirmation({
  multiAction,
  onConfirmAll,
}: {
  multiAction: MultiActionState
  onConfirmAll?: () => void
}) {
  const { actions, currentIndex, isExecuting, createdIds } = multiAction

  // Check if all actions are completed (success or error)
  const allCompleted = actions.every(
    (a) => a.status === "success" || a.status === "error"
  )
  const allPending = actions.every((a) => a.status === "pending")
  const hasErrors = actions.some((a) => a.status === "error")

  return (
    <div className="mt-3 space-y-2">
      {/* Header with Execute All button */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {actions.length} Actions
          </span>
          {isExecuting && (
            <span className="text-xs text-muted-foreground">
              ({currentIndex + 1} of {actions.length})
            </span>
          )}
        </div>
        {allPending && (
          <Button size="sm" onClick={onConfirmAll} className="h-7 gap-1.5 text-xs">
            <Play className="size-3" weight="fill" />
            Execute All
          </Button>
        )}
        {allCompleted && !hasErrors && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="size-3" weight="bold" />
            All completed
          </span>
        )}
        {allCompleted && hasErrors && (
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirmAll}
            className="h-7 gap-1.5 text-xs"
          >
            Retry Failed
          </Button>
        )}
      </div>

      {/* Action List */}
      <div className="space-y-1.5">
        {actions.map((action, index) => {
          const label = ACTION_LABELS[action.type] || action.type
          const isCurrent = isExecuting && index === currentIndex

          return (
            <div
              key={index}
              className={cn(
                "rounded-lg border p-2.5 transition-colors",
                action.status === "pending" && "border-border bg-muted/20",
                action.status === "executing" && "border-primary/50 bg-primary/5",
                action.status === "success" &&
                  "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
                action.status === "error" &&
                  "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
              )}
            >
              <div className="flex items-center gap-2">
                {/* Status Icon */}
                {action.status === "pending" && (
                  <div className="size-4 rounded-full border-2 border-muted-foreground/30" />
                )}
                {action.status === "executing" && (
                  <SpinnerGap className="size-4 animate-spin text-primary" />
                )}
                {action.status === "success" && (
                  <Check className="size-4 text-green-600 dark:text-green-400" weight="bold" />
                )}
                {action.status === "error" && (
                  <Warning className="size-4 text-red-600 dark:text-red-400" weight="bold" />
                )}

                {/* Action Label */}
                <span
                  className={cn(
                    "text-sm font-medium",
                    action.status === "pending" && "text-muted-foreground",
                    action.status === "executing" && "text-foreground",
                    action.status === "success" && "text-green-700 dark:text-green-300",
                    action.status === "error" && "text-red-700 dark:text-red-300"
                  )}
                >
                  {index + 1}. {label}
                </span>

                {/* Show placeholder replacement indicator */}
                {action.status === "pending" && hasPlaceholders(action.data) && (
                  <span className="text-xs text-muted-foreground">
                    (uses previous IDs)
                  </span>
                )}
              </div>

              {/* Show data preview for pending/executing */}
              {(action.status === "pending" || isCurrent) && (
                <pre className="mt-1.5 max-h-20 overflow-auto rounded bg-muted p-1.5 text-xs text-muted-foreground">
                  {JSON.stringify(action.data, null, 2)}
                </pre>
              )}

              {/* Show error message */}
              {action.status === "error" && action.error && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {action.error}
                </p>
              )}

              {/* Show created entity info */}
              {action.status === "success" && action.createdEntity && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  Created: {action.createdEntity.name} ({action.createdEntity.id})
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Show created IDs summary if any exist */}
      {Object.keys(createdIds).length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Created Resources:
          </p>
          <ul className="mt-1 space-y-0.5">
            {createdIds.projectId && (
              <li className="text-xs text-blue-600 dark:text-blue-400">
                Project: {createdIds.projectId}
              </li>
            )}
            {createdIds.workstreamId && (
              <li className="text-xs text-blue-600 dark:text-blue-400">
                Workstream: {createdIds.workstreamId}
              </li>
            )}
            {createdIds.taskId && (
              <li className="text-xs text-blue-600 dark:text-blue-400">
                Task: {createdIds.taskId}
              </li>
            )}
            {createdIds.clientId && (
              <li className="text-xs text-blue-600 dark:text-blue-400">
                Client: {createdIds.clientId}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// Helper to check if action data contains placeholders
function hasPlaceholders(data: Record<string, unknown>): boolean {
  const jsonStr = JSON.stringify(data)
  return (
    jsonStr.includes("$NEW_PROJECT_ID") ||
    jsonStr.includes("$NEW_WORKSTREAM_ID") ||
    jsonStr.includes("$NEW_TASK_ID") ||
    jsonStr.includes("$NEW_CLIENT_ID")
  )
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

export function AIChatMessage({
  message,
  onConfirmAction,
  onConfirmAllActions,
}: AIChatMessageProps) {
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

        {/* Single Action Confirmation (assistant messages only) */}
        {!isUser && message.action && !message.multiAction && (
          <ActionConfirmation action={message.action} onConfirm={onConfirmAction} />
        )}

        {/* Multi-Action Confirmation (assistant messages only) */}
        {!isUser && message.multiAction && (
          <MultiActionConfirmation
            multiAction={message.multiAction}
            onConfirmAll={onConfirmAllActions}
          />
        )}
      </div>
    </div>
  )
}
