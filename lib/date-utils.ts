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
