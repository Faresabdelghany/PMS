"use client"

import { useEffect, useRef } from "react"
import { useColorTheme, type ColorTheme } from "@/components/color-theme-provider"

interface ColorThemeSyncerProps {
  serverTheme: ColorTheme
}

/**
 * Syncs the color theme from the server (database) to the client context.
 * This ensures the user's saved theme preference is applied on page load,
 * even on new browsers/devices where localStorage is empty.
 */
export function ColorThemeSyncer({ serverTheme }: ColorThemeSyncerProps) {
  const { colorTheme, setColorTheme } = useColorTheme()
  const hasSynced = useRef(false)

  useEffect(() => {
    // Only sync once on initial mount
    if (hasSynced.current) return
    hasSynced.current = true

    // If localStorage has no theme or differs from server, sync from server
    const storedTheme = localStorage.getItem("color-theme")

    // Server theme takes precedence if:
    // 1. No localStorage theme exists (new browser/device)
    // 2. Server theme is different (user changed on another device)
    if (!storedTheme || storedTheme !== serverTheme) {
      setColorTheme(serverTheme)
    }
  }, [serverTheme, setColorTheme])

  // This component renders nothing - it just syncs the theme
  return null
}
