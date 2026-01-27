import { Badge } from "@/components/ui/badge"
import type { ClientStatus } from "@/lib/supabase/types"

function statusLabel(status: ClientStatus): string {
  if (status === "prospect") return "Prospect"
  if (status === "active") return "Active"
  if (status === "on_hold") return "On hold"
  return "Archived"
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const label = statusLabel(status)

  let badgeClasses = "bg-muted text-muted-foreground border-transparent"
  let dotClasses = "bg-zinc-900 dark:bg-zinc-100"

  if (status === "active") {
    badgeClasses = "bg-teal-50 text-teal-700 border-transparent dark:bg-teal-900/30 dark:text-teal-300"
    dotClasses = "bg-teal-600"
  } else if (status === "on_hold") {
    badgeClasses = "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-900/30 dark:text-amber-300"
    dotClasses = "bg-amber-600"
  } else if (status === "archived") {
    badgeClasses = "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-800 dark:text-slate-300"
    dotClasses = "bg-slate-500"
  }

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} />
      {label}
    </Badge>
  )
}
