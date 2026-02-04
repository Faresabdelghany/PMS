"use client"

import { useEffect } from "react"

/**
 * Registers Service Worker for static asset caching
 * Improves performance by caching JS, CSS, images, fonts
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      globalThis.window !== undefined &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope)
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error)
        })
    }
  }, [])

  return null
}
