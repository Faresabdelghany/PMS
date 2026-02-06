"use client"

import { useState, useEffect } from "react"

/**
 * Hook to track document visibility state
 * Used to pause realtime subscriptions and other operations when tab is hidden
 */
export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  )

  useEffect(() => {
    if (typeof document === "undefined") return

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible")
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  return isVisible
}
