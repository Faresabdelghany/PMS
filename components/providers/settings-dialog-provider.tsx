"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import dynamic from "next/dynamic"
import type { SettingsItemId } from "@/components/settings/settings-sidebar"

// Lazy load SettingsDialog - it's a heavy component that's only needed when opened
const SettingsDialog = dynamic(
  () => import("@/components/settings/settings-dialog").then((mod) => mod.SettingsDialog),
  { ssr: false }
)

interface SettingsDialogContextValue {
  isOpen: boolean
  activeSection: SettingsItemId
  openSettings: (section?: SettingsItemId) => void
  closeSettings: () => void
}

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null)

interface SettingsDialogProviderProps {
  children: ReactNode
}

export function SettingsDialogProvider({ children }: SettingsDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false) // Track if dialog has ever been opened
  const [activeSection, setActiveSection] = useState<SettingsItemId>("account")

  const openSettings = useCallback((section?: SettingsItemId) => {
    if (section) {
      setActiveSection(section)
    }
    setHasOpened(true) // Mark as opened to trigger lazy load
    setIsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <SettingsDialogContext.Provider
      value={{
        isOpen,
        activeSection,
        openSettings,
        closeSettings,
      }}
    >
      {children}
      {/* Only load SettingsDialog after it's been opened once */}
      {hasOpened && (
        <SettingsDialog
          open={isOpen}
          onOpenChange={setIsOpen}
          initialSection={activeSection}
        />
      )}
    </SettingsDialogContext.Provider>
  )
}

export function useSettingsDialog() {
  const context = useContext(SettingsDialogContext)
  if (!context) {
    throw new Error("useSettingsDialog must be used within a SettingsDialogProvider")
  }
  return context
}
