import type { TaskActivityWithRelations } from "@/lib/supabase/types"

// Helper function to format activity messages for display
export function formatActivityMessage(
  activity: TaskActivityWithRelations
): string {
  const actorName = activity.actor?.full_name || activity.actor?.email || "Someone"
  const metadata = activity.metadata as Record<string, unknown> | null

  switch (activity.action) {
    case "created":
      return `${actorName} created this task`

    case "status_changed":
      return `${actorName} changed status from ${formatValue(activity.old_value)} to ${formatValue(activity.new_value)}`

    case "assignee_changed":
      const newAssigneeName = metadata?.new_assignee_name || activity.new_value
      return `${actorName} assigned this to ${newAssigneeName}`

    case "assignee_removed":
      const oldAssigneeName = metadata?.old_assignee_name || activity.old_value
      return `${actorName} unassigned ${oldAssigneeName}`

    case "priority_changed":
      return `${actorName} changed priority from ${formatValue(activity.old_value)} to ${formatValue(activity.new_value)}`

    case "due_date_changed":
      if (!activity.old_value && activity.new_value) {
        return `${actorName} set due date to ${formatDate(activity.new_value)}`
      } else if (activity.old_value && !activity.new_value) {
        return `${actorName} removed the due date`
      }
      return `${actorName} changed due date to ${formatDate(activity.new_value)}`

    case "start_date_changed":
      if (!activity.old_value && activity.new_value) {
        return `${actorName} set start date to ${formatDate(activity.new_value)}`
      } else if (activity.old_value && !activity.new_value) {
        return `${actorName} removed the start date`
      }
      return `${actorName} changed start date to ${formatDate(activity.new_value)}`

    case "workstream_changed":
      const workstreamName = metadata?.workstream_name || activity.new_value
      if (!activity.old_value && activity.new_value) {
        return `${actorName} moved this to ${workstreamName}`
      } else if (activity.old_value && !activity.new_value) {
        return `${actorName} removed from workstream`
      }
      return `${actorName} moved this to ${workstreamName}`

    case "description_changed":
      return `${actorName} updated the description`

    case "tag_changed":
      if (!activity.old_value && activity.new_value) {
        return `${actorName} added tag ${formatValue(activity.new_value)}`
      } else if (activity.old_value && !activity.new_value) {
        return `${actorName} removed the tag`
      }
      return `${actorName} changed tag to ${formatValue(activity.new_value)}`

    case "name_changed":
      return `${actorName} renamed this task`

    default:
      return `${actorName} updated this task`
  }
}

// Helper to format values for display
function formatValue(value: string | null): string {
  if (!value) return "none"
  // Convert snake_case to Title Case
  return value
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Helper to format dates
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "none"
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    })
  } catch {
    return dateStr
  }
}
