"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { SettingsDialog } from "@/components/settings/settings-dialog"
import type { SettingsItemId } from "@/components/settings/settings-sidebar"

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
  const [activeSection, setActiveSection] = useState<SettingsItemId>("account")

  const openSettings = useCallback((section?: SettingsItemId) => {
    if (section) {
      setActiveSection(section)
    }
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
      <SettingsDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        initialSection={activeSection}
      />
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
