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
} from "@phosphor-icons/react/dist/ssr"
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
  change_theme: "Change Theme",
}

const ACTION_INTROS: Record<string, string> = {
  create_task: "I'll create this task for you:",
  create_project: "Here's the project I'll set up:",
  create_workstream: "I'll create this workstream:",
  create_client: "I'll add this client:",
  create_note: "I'll create this note:",
  update_task: "I'll make these changes:",
  update_project: "I'll update the project:",
  update_workstream: "I'll update this workstream:",
  update_client: "I'll update this client:",
  update_note: "I'll update this note:",
  delete_task: "I'll delete this task:",
  assign_task: "I'll assign this task:",
  add_project_member: "I'll add this member:",
  add_team_member: "I'll add this team member:",
  change_theme: "I'll change the theme:",
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
  const intro = ACTION_INTROS[action.type] || "I'll do this for you:"
  const buttonLabel = ACTION_BUTTONS[action.type] || "Confirm"

  // Pending state - show preview and confirm button
  if (action.status === "pending") {
    return (
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">{intro}</p>
        <ActionPreviewCard action={action} />
        <div className="flex items-center gap-2">
          {onSkip && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={onSkip}
            >
              Skip
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs" onClick={onConfirm}>
            {buttonLabel} →
          </Button>
        </div>
      </div>
    )
  }

  // Executing state - show spinner
  if (action.status === "executing") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <SpinnerGap className="size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Working on it...</span>
      </div>
    )
  }

  // Success state - show checkmark and "Open" button
  if (action.status === "success") {
    return (
      <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-green-600 dark:text-green-400" weight="bold" />
            <span className="text-sm text-green-700 dark:text-green-300">
              {action.createdEntity
                ? `Created "${action.createdEntity.name}"`
                : "Done!"}
            </span>
          </div>
          {action.createdEntity && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-700 hover:text-green-800 dark:text-green-400"
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
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-center gap-2">
          <Warning className="size-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {action.error || "Something went wrong"}
          </span>
        </div>
        {onConfirm && (
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className="mt-2 h-7 text-xs"
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
  const { actions, currentIndex, isExecuting, createdIds } = multiAction

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

  return (
    <div className="mt-3 space-y-2">
      {/* Header with Execute All button */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3">
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
          const title = (action.data?.title || action.data?.name) as string | undefined

          return (
            <div
              key={index}
              className={cn(
                "rounded-xl border p-2.5 transition-colors",
                action.status === "pending" && "border-border bg-muted/20",
                action.status === "executing" && "border-primary/50 bg-primary/5",
                action.status === "success" &&
                  "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30",
                action.status === "error" &&
                  "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
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
                  <Warning className="size-4 text-amber-600 dark:text-amber-400" />
                )}

                {/* Action Label */}
                <span
                  className={cn(
                    "text-sm font-medium",
                    action.status === "pending" && "text-muted-foreground",
                    action.status === "executing" && "text-foreground",
                    action.status === "success" && "text-green-700 dark:text-green-300",
                    action.status === "error" && "text-amber-700 dark:text-amber-300"
                  )}
                >
                  {index + 1}. {label}
                  {title && <span className="font-normal text-muted-foreground"> - {title}</span>}
                </span>

                {/* Show placeholder replacement indicator */}
                {action.status === "pending" && hasPlaceholders(action.data) && (
                  <span className="text-xs text-muted-foreground">
                    (uses previous)
                  </span>
                )}
              </div>

              {/* Show preview card for pending/executing */}
              {(action.status === "pending" || isCurrent) && (
                <div className="mt-2">
                  <ActionPreviewCard action={action} />
                </div>
              )}

              {/* Show error message */}
              {action.status === "error" && action.error && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {action.error}
                </p>
              )}

              {/* Show created entity info */}
              {action.status === "success" && action.createdEntity && (
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Created: {action.createdEntity.name}
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
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/30">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-green-600 dark:text-green-400" weight="bold" />
            <span className="text-sm text-green-700 dark:text-green-300">
              Created {createdEntities.length} item{createdEntities.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {createdEntities.map((entity, idx) => (
              <button
                key={idx}
                onClick={() => navigateToEntity(entity)}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900"
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
// Main Component
// =============================================================================

export function AIChatMessage({
  message,
  onConfirmAction,
  onConfirmAllActions,
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
            {/* Message Content */}
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>

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
          </div>
        </div>
      </div>
    </div>
  )
}
