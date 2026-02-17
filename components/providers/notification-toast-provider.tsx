"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { usePooledInboxRealtime } from "@/hooks/realtime-context"
import { getPreferences } from "@/lib/actions/user-settings"
import type { InboxItem } from "@/lib/supabase/types"

interface NotificationToastProviderProps {
  userId: string
}

/**
 * Provider that shows toast notifications when new inbox items arrive.
 * Respects user's in-app notification preference.
 */
export function NotificationToastProvider({ userId }: NotificationToastProviderProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(true)

  // Load user preference for in-app notifications
  useEffect(() => {
    getPreferences().then(({ data }) => {
      if (data) {
        setEnabled(data.notifications_in_app)
      }
    })
  }, [])

  // Listen for new inbox items and show toast
  usePooledInboxRealtime(userId, {
    onInsert: (item: InboxItem) => {
      if (!enabled) return

      // Build navigation URL based on item type
      let actionUrl: string | undefined
      if (item.task_id) {
        actionUrl = item.project_id
          ? `/projects/${item.project_id}?task=${item.task_id}`
          : undefined
      } else if (item.project_id) {
        actionUrl = `/projects/${item.project_id}`
      } else if (item.client_id) {
        actionUrl = `/clients?id=${item.client_id}`
      }

      toast(item.title, {
        description: item.message ?? undefined,
        action: actionUrl
          ? {
              label: "View",
              onClick: () => router.push(actionUrl),
            }
          : undefined,
      })
    },
  })

  // This provider doesn't render anything
  return null
}
