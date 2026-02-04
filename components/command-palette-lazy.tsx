"use client"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"

// Lazy-load the CommandPalette only when user triggers Cmd+K
// This defers loading cmdk (~20KB) until actually needed
const CommandPaletteDynamic = dynamic(
  () => import("@/components/command-palette").then((mod) => ({ default: mod.CommandPalette })),
  { ssr: false }
)

type CommandPaletteLazyProps = Readonly<{
  onCreateProject?: () => void
  onCreateTask?: () => void
  onOpenSettings?: () => void
}>

export function CommandPaletteLazy(props: CommandPaletteLazyProps) {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        // Prevent default and load the palette
        e.preventDefault()
        setShouldLoad(true)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Don't render anything until user triggers Cmd+K
  if (!shouldLoad) {
    return null
  }

  return <CommandPaletteDynamic {...props} />
}
