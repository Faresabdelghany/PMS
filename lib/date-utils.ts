/**
 * Format a date into a human-readable "due" label
 * Returns labels like "Overdue", "Today", "Tomorrow", "3 days", or a formatted date
 */
export function formatDueLabel(date: Date): string {
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "Overdue"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays <= 7) return `${diffDays} days`
  return date.toLocaleDateString()
}

/**
 * Lightweight replacement for date-fns `formatDistanceToNow` with `{ addSuffix: true }`.
 * Returns strings like "just now", "2 minutes ago", "3 hours ago", "5 days ago", etc.
 * Zero-dependency — avoids pulling ~8kB of date-fns locale/formatting code.
 */
export function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? "" : "s"} ago`
}

/**
 * Get the tone/color for a due date based on urgency
 */
export function getDueTone(date: Date): "danger" | "warning" | "muted" {
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "danger" // Overdue
  if (diffDays <= 1) return "warning" // Today or Tomorrow
  return "muted" // Future
}
