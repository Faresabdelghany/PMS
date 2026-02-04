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
  const { setColorTheme } = useColorTheme()
  const hasSynced = useRef(false)

  useEffect(() => {
    // Only sync once on initial mount
    if (hasSynced.current) return
    hasSynced.current = true

    // Only sync from server if localStorage is empty (new browser/device)
    // This prevents flash when user has a local theme preference
    const storedTheme = localStorage.getItem("color-theme")

    if (!storedTheme && serverTheme !== "default") {
      // New browser/device - apply server theme
      setColorTheme(serverTheme)
    }
  }, [serverTheme, setColorTheme])

  // This component renders nothing - it just syncs the theme
  return null
}
