"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Check,
  SpinnerGap,
  Warning,
  Paperclip,
  Play,
  StarFour,
  Folder,
  Flag,
  Circle,
  User,
  Plus,
  CheckSquare,
  Pencil,
  Trash,
  Users,
  Note,
  Briefcase,
  Lightning,
  Clock,
} from "@phosphor-icons/react/dist/ssr"
import type { Message, ActionState, MultiActionState } from "@/hooks/use-ai-chat"
import type { ProposedAction, SuggestedAction } from "@/lib/actions/ai-types"
import { MarkdownContent } from "./markdown-content"
import { AI_CONTEXT_LIMITS } from "@/lib/constants"

// =============================================================================
// Types
// =============================================================================

interface AIChatMessageProps {
  message: Message
  onConfirmAction?: () => void
  onConfirmAllActions?: () => void
  onSendSuggestion?: (prompt: string) => void
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
  change_theme: "Change Theme",
}

const ACTION_INTROS: Record<string, string> = {
  create_task: "Ready to create this task:",
  create_project: "Ready to set up this project:",
  create_workstream: "Ready to create this workstream:",
  create_client: "Ready to add this client:",
  create_note: "Ready to create this note:",
  update_task: "Ready to update this task:",
  update_project: "Ready to update this project:",
  update_workstream: "Ready to update this workstream:",
  update_client: "Ready to update this client:",
  update_note: "Ready to update this note:",
  delete_task: "Ready to delete this task:",
  assign_task: "Ready to assign this task:",
  add_project_member: "Ready to add this member:",
  add_team_member: "Ready to add this team member:",
  change_theme: "Ready to change the theme:",
}

const ACTION_BUTTONS: Record<string, string> = {
  create_task: "Create task",
  create_project: "Create project",
  create_workstream: "Create workstream",
  create_client: "Add client",
  create_note: "Create note",
  update_task: "Update",
  update_project: "Update",
  update_workstream: "Update",
  update_client: "Update",
  update_note: "Update",
  delete_task: "Yes, delete",
  assign_task: "Assign",
  add_project_member: "Add member",
  add_team_member: "Add member",
  change_theme: "Apply",
}

// =============================================================================
// Action Type Icon Component
// =============================================================================

function ActionTypeIcon({ type }: { type: ProposedAction["type"] }) {
  const iconClass = "size-4 text-muted-foreground"

  switch (type) {
    case "create_task":
    case "update_task":
    case "assign_task":
      return <CheckSquare className={iconClass} />
    case "delete_task":
      return <Trash className={iconClass} />
    case "create_project":
    case "update_project":
      return <Folder className={iconClass} />
    case "create_workstream":
    case "update_workstream":
      return <Briefcase className={iconClass} />
    case "create_client":
    case "update_client":
      return <User className={iconClass} />
    case "create_note":
    case "update_note":
      return <Note className={iconClass} />
    case "add_project_member":
    case "add_team_member":
      return <Users className={iconClass} />
    default:
      return <Plus className={iconClass} />
  }
}

// =============================================================================
// Action Preview Card Component
// =============================================================================

function ActionPreviewCard({ action }: { action: ActionState }) {
  const data = action.data || {}
  const title = (data.title || data.name) as string | undefined
  const projectName = data.projectName as string | undefined
  const priority = data.priority as string | undefined
  const status = data.status as string | undefined
  const assigneeName = data.assigneeName as string | undefined
  const description = data.description as string | undefined
  const theme = data.theme as string | undefined

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      {title && (
        <div className="flex items-center gap-2">
          <ActionTypeIcon type={action.type} />
          <span className="font-medium text-sm">{title}</span>
        </div>
      )}
      {theme && !title && (
        <div className="flex items-center gap-2">
          <ActionTypeIcon type={action.type} />
          <span className="font-medium text-sm capitalize">{theme} theme</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {projectName && (
          <span className="inline-flex items-center gap-1">
            <Folder className="size-3" /> {projectName}
          </span>
        )}
        {priority && (
          <span className="inline-flex items-center gap-1 capitalize">
            <Flag className="size-3" /> {priority}
          </span>
        )}
        {status && (
          <span className="inline-flex items-center gap-1 capitalize">
            <Circle className="size-3" /> {status.replace("-", " ")}
          </span>
        )}
        {assigneeName && (
          <span className="inline-flex items-center gap-1">
            <User className="size-3" /> {assigneeName}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      )}
    </div>
  )
}

// =============================================================================
// Navigation Helper
// =============================================================================

function navigateToEntity(entity: { type: string; id: string; name: string }) {
  const urls: Record<string, string> = {
    task: `/tasks`,
    project: `/projects/${entity.id}`,
    client: `/clients`,
    workstream: `/projects`,
    note: `/projects`,
  }
  const url = urls[entity.type]
  if (url) window.location.href = url
}

// =============================================================================
// Action Confirmation Component
// =============================================================================

function ActionConfirmation({
  action,
  onConfirm,
  onSkip,
}: {
  action: ActionState
  onConfirm?: () => void
  onSkip?: () => void
}) {
  const intro = ACTION_INTROS[action.type] || "Ready to execute:"
  const buttonLabel = ACTION_BUTTONS[action.type] || "Confirm"

  // Pending state - prominent confirmation dialog style
  if (action.status === "pending") {
    return (
      <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 dark:border-primary/40 dark:bg-primary/10">
        {/* Header with pending indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center size-6 rounded-full bg-primary/20">
            <Clock className="size-3.5 text-primary" weight="bold" />
          </div>
          <span className="text-xs font-medium text-primary uppercase tracking-wide">
            Awaiting Confirmation
          </span>
        </div>

        <p className="text-sm font-medium text-foreground mb-3">{intro}</p>
        <ActionPreviewCard action={action} />

        {/* Prominent action buttons */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-primary/20">
          {onSkip && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm text-muted-foreground hover:text-foreground"
              onClick={onSkip}
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 text-sm gap-1.5 bg-primary hover:bg-primary/90"
            onClick={onConfirm}
          >
            <Lightning className="size-3.5" weight="fill" />
            {buttonLabel}
          </Button>
        </div>
      </div>
    )
  }

  // Executing state - show spinner
  if (action.status === "executing") {
    return (
      <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 dark:border-primary/40 dark:bg-primary/10">
        <div className="flex items-center gap-3">
          <SpinnerGap className="size-5 animate-spin text-primary motion-reduce:animate-none" />
          <span className="text-sm font-medium text-foreground">Executing…</span>
        </div>
      </div>
    )
  }

  // Success state - show checkmark and "Open" button
  if (action.status === "success") {
    return (
      <div className="mt-4 rounded-xl border-2 border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-6 rounded-full bg-green-500">
              <Check className="size-3.5 text-white" weight="bold" />
            </div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {action.createdEntity
                ? `Created "${action.createdEntity.name}"`
                : "Completed successfully!"}
            </span>
          </div>
          {action.createdEntity && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-sm text-green-700 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50"
              onClick={() => navigateToEntity(action.createdEntity!)}
            >
              Open →
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Error state - amber/softer design
  if (action.status === "error") {
    return (
      <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-6 rounded-full bg-amber-500">
            <Warning className="size-3.5 text-white" weight="fill" />
          </div>
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {action.error || "Something went wrong"}
          </span>
        </div>
        {onConfirm && (
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className="mt-3 h-8 text-sm border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
          >
            Try again
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
  const { actions, currentIndex, isExecuting } = multiAction

  // Check if all actions are completed (success or error)
  const allCompleted = actions.every(
    (a) => a.status === "success" || a.status === "error"
  )
  const allPending = actions.every((a) => a.status === "pending")
  const hasErrors = actions.some((a) => a.status === "error")
  const successCount = actions.filter((a) => a.status === "success").length

  // Get created entity names for summary
  const createdEntities = actions
    .filter((a) => a.status === "success" && a.createdEntity)
    .map((a) => a.createdEntity!)

  // Determine container styling based on state
  const containerClass = cn(
    "mt-4 rounded-xl border-2 p-4 transition-colors",
    allPending && "border-primary/30 bg-primary/5 dark:border-primary/40 dark:bg-primary/10",
    isExecuting && "border-primary/50 bg-primary/10 dark:border-primary/60 dark:bg-primary/15",
    allCompleted && !hasErrors && "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/50",
    allCompleted && hasErrors && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50"
  )

  return (
    <div className={containerClass}>
      {/* Header with status indicator */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {/* Status icon */}
          {allPending && (
            <div className="flex items-center justify-center size-7 rounded-full bg-primary/20">
              <Clock className="size-4 text-primary" weight="bold" />
            </div>
          )}
          {isExecuting && (
            <div className="flex items-center justify-center size-7 rounded-full bg-primary/20">
              <SpinnerGap className="size-4 animate-spin text-primary" />
            </div>
          )}
          {allCompleted && !hasErrors && (
            <div className="flex items-center justify-center size-7 rounded-full bg-green-500">
              <Check className="size-4 text-white" weight="bold" />
            </div>
          )}
          {allCompleted && hasErrors && (
            <div className="flex items-center justify-center size-7 rounded-full bg-amber-500">
              <Warning className="size-4 text-white" weight="fill" />
            </div>
          )}

          {/* Status text */}
          <div>
            <span className="text-sm font-semibold text-foreground">
              {actions.length} Actions
            </span>
            {allPending && (
              <span className="ml-2 text-xs font-medium text-primary uppercase tracking-wide">
                Awaiting Confirmation
              </span>
            )}
            {isExecuting && (
              <span className="ml-2 text-xs text-muted-foreground">
                Executing {currentIndex + 1} of {actions.length}...
              </span>
            )}
            {allCompleted && !hasErrors && (
              <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400">
                All completed!
              </span>
            )}
            {allCompleted && hasErrors && (
              <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                {successCount} completed, {actions.length - successCount} failed
              </span>
            )}
          </div>
        </div>

        {/* Execute button */}
        {allPending && (
          <Button
            size="sm"
            className="h-9 text-sm gap-1.5 bg-primary hover:bg-primary/90 shadow-sm"
            onClick={onConfirmAll}
          >
            <Lightning className="size-4" weight="fill" />
            Execute All
          </Button>
        )}
        {allCompleted && hasErrors && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-sm gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
            onClick={onConfirmAll}
          >
            Retry Failed
          </Button>
        )}
      </div>

      {/* Action List */}
      <div className="space-y-2">
        {actions.map((action, index) => {
          const label = ACTION_LABELS[action.type] || action.type
          const isCurrent = isExecuting && index === currentIndex
          const title = (action.data?.title || action.data?.name) as string | undefined

          return (
            <div
              key={index}
              className={cn(
                "rounded-lg border p-3 transition-all",
                action.status === "pending" && "border-border/50 bg-background/50",
                action.status === "executing" && "border-primary/50 bg-primary/5 shadow-sm",
                action.status === "success" && "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20",
                action.status === "error" && "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
              )}
            >
              <div className="flex items-center gap-2.5">
                {/* Status Icon */}
                {action.status === "pending" && (
                  <div className="size-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground font-medium">{index + 1}</span>
                  </div>
                )}
                {action.status === "executing" && (
                  <SpinnerGap className="size-5 animate-spin text-primary" />
                )}
                {action.status === "success" && (
                  <div className="size-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="size-3 text-white" weight="bold" />
                  </div>
                )}
                {action.status === "error" && (
                  <div className="size-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <Warning className="size-3 text-white" weight="fill" />
                  </div>
                )}

                {/* Action Label */}
                <span
                  className={cn(
                    "text-sm font-medium flex-1",
                    action.status === "pending" && "text-foreground",
                    action.status === "executing" && "text-primary",
                    action.status === "success" && "text-green-700 dark:text-green-300",
                    action.status === "error" && "text-amber-700 dark:text-amber-300"
                  )}
                >
                  {label}
                  {title && <span className="font-normal text-muted-foreground ml-1">· {title}</span>}
                </span>

                {/* Show placeholder replacement indicator */}
                {action.status === "pending" && hasPlaceholders(action.data) && (
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                    linked
                  </span>
                )}
              </div>

              {/* Show preview card for pending/executing - collapsed by default for cleaner look */}
              {isCurrent && (
                <div className="mt-2.5 pt-2.5 border-t border-border/50">
                  <ActionPreviewCard action={action} />
                </div>
              )}

              {/* Show error message */}
              {action.status === "error" && action.error && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 px-2 py-1 rounded">
                  {action.error}
                </p>
              )}

              {/* Show created entity info */}
              {action.status === "success" && action.createdEntity && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ {action.createdEntity.name}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-green-600 hover:text-green-700 dark:text-green-400 px-2"
                    onClick={() => navigateToEntity(action.createdEntity!)}
                  >
                    Open →
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Show created entities summary */}
      {allCompleted && createdEntities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <Check className="size-4 text-green-600 dark:text-green-400" weight="bold" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {createdEntities.length} item{createdEntities.length > 1 ? "s" : ""} created
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {createdEntities.map((entity, idx) => (
              <button
                key={idx}
                onClick={() => navigateToEntity(entity)}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {entity.name}
                <span className="opacity-60">→</span>
              </button>
            ))}
          </div>
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
          className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs"
        >
          <Paperclip className="size-3" />
          {attachment.name}
        </span>
      ))}
    </div>
  )
}

// =============================================================================
// Suggested Actions Component
// =============================================================================

interface SuggestedActionsProps {
  suggestions: SuggestedAction[]
  onSelect?: (prompt: string) => void
}

function SuggestedActions({ suggestions, onSelect }: SuggestedActionsProps) {
  if (!onSelect) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {suggestions.slice(0, AI_CONTEXT_LIMITS.suggestedActions).map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion.prompt)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
            "text-xs font-medium",
            "bg-primary/10 text-primary",
            "hover:bg-primary/20 transition-colors",
            "border border-primary/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Plus className="size-3" />
          {suggestion.label}
        </button>
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
  onSendSuggestion,
}: AIChatMessageProps) {
  const isUser = message.role === "user"

  // User messages - right aligned with primary background
  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-2.5">
          <AttachmentChips attachments={message.attachments} />
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        </div>
      </div>
    )
  }

  // Assistant messages - left aligned with avatar
  return (
    <div className="flex w-full justify-start">
      <div className="flex items-start gap-3 max-w-[85%]">
        <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
          <StarFour weight="fill" className="size-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3">
            {/* Message Content with Markdown */}
            <MarkdownContent content={message.content} className="text-sm" />

            {/* Single Action Confirmation */}
            {message.action && !message.multiAction && (
              <ActionConfirmation
                action={message.action}
                onConfirm={onConfirmAction}
              />
            )}

            {/* Multi-Action Confirmation */}
            {message.multiAction && (
              <MultiActionConfirmation
                multiAction={message.multiAction}
                onConfirmAll={onConfirmAllActions}
              />
            )}

            {/* Suggested Follow-up Actions */}
            {message.suggestedActions && message.suggestedActions.length > 0 && (
              <SuggestedActions
                suggestions={message.suggestedActions}
                onSelect={onSendSuggestion}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
