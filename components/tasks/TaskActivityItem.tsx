"use client"

import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatActivityMessage } from "@/lib/utils/activity-formatter"
import type { TaskActivityWithRelations } from "@/lib/supabase/types"

interface TaskActivityItemProps {
  activity: TaskActivityWithRelations
}

export function TaskActivityItem({ activity }: TaskActivityItemProps) {
  const actor = activity.actor
  const message = formatActivityMessage(activity)

  return (
    <div className="flex gap-3 py-2">
      <Avatar className="h-6 w-6 flex-shrink-0">
        <AvatarImage src={actor?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">
          {(actor?.full_name || actor?.email || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{message}</span>
          <span className="text-xs text-muted-foreground/70">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  )
}
