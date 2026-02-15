"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef } from "react"

// Lazy-load the CommandPalette — prefetched on idle, opens instantly on Cmd+K
const CommandPaletteDynamic = dynamic(
  () => import("@/components/command-palette").then((mod) => ({ default: mod.CommandPalette })),
  { ssr: false }
)

// Trigger a prefetch of the command palette chunk during idle time
let prefetchStarted = false
function prefetchCommandPalette() {
  if (prefetchStarted) return
  prefetchStarted = true
  // Warm the webpack chunk cache so it's ready when the user presses Cmd+K
  import("@/components/command-palette").catch(() => {
    // Reset on failure so it can retry
    prefetchStarted = false
  })
}

type CommandPaletteLazyProps = Readonly<{
  onCreateProject?: () => void
  onCreateTask?: () => void
  onOpenSettings?: () => void
}>

export function CommandPaletteLazy(props: CommandPaletteLazyProps) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [open, setOpen] = useState(false)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
  }, [])

  useEffect(() => {
    // Prefetch the chunk during idle time so first open is instant
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => prefetchCommandPalette(), { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    } else {
      // Fallback: prefetch after 2s
      const timer = setTimeout(prefetchCommandPalette, 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Use a ref to avoid re-registering the listener when shouldLoad changes
  const shouldLoadRef = useRef(false)
  useEffect(() => {
    shouldLoadRef.current = shouldLoad
  }, [shouldLoad])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!shouldLoadRef.current) {
          // First press: load the component and open immediately
          setShouldLoad(true)
          setOpen(true)
        } else {
          // Subsequent presses: toggle
          setOpen((prev) => !prev)
        }
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Don't render anything until user triggers Cmd+K
  if (!shouldLoad) {
    return null
  }

  return (
    <CommandPaletteDynamic
      {...props}
      open={open}
      onOpenChange={handleOpenChange}
    />
  )
}
