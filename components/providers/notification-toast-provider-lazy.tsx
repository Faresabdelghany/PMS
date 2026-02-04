"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

// Lazy load the notification toast provider after initial paint
const NotificationToastProviderImpl = dynamic(
  () => import("./notification-toast-provider").then((mod) => mod.NotificationToastProvider),
  { ssr: false }
)

interface NotificationToastProviderLazyProps {
  readonly userId: string
}

/**
 * Lazy wrapper for NotificationToastProvider.
 * Defers loading until after initial paint to reduce hydration cost.
 */
export function NotificationToastProviderLazy({ userId }: NotificationToastProviderLazyProps) {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    // Defer loading until after initial paint using requestIdleCallback
    // Falls back to setTimeout for browsers without requestIdleCallback
    if ("requestIdleCallback" in globalThis) {
      const id = globalThis.requestIdleCallback(() => setShouldLoad(true), { timeout: 2000 })
      return () => globalThis.cancelIdleCallback(id)
    } else {
      const id = setTimeout(() => setShouldLoad(true), 100)
      return () => clearTimeout(id)
    }
  }, [])

  if (!shouldLoad) return null

  return <NotificationToastProviderImpl userId={userId} />
}
