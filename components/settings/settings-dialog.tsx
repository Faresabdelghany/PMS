"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { SettingsSidebar, type SettingsItemId } from "./settings-sidebar"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

// Pane imports
import { AccountPane } from "./panes/account-pane"
import { NotificationsPane } from "./panes/notifications-pane"
import { PreferencesPane } from "./panes/preferences-pane"
import { TeammatesPane } from "./panes/teammates-pane"
import { IdentityPane } from "./panes/identity-pane"
import { TypesPane } from "./panes/types-pane"
import { TagsPane } from "./panes/tags-pane"
import { BillingPane } from "./panes/billing-pane"
import { ImportPane } from "./panes/import-pane"
import { AgentsPane } from "./panes/agents-pane"
import { SkillsPane } from "./panes/skills-pane"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: SettingsItemId
}

export function SettingsDialog({ open, onOpenChange, initialSection = "account" }: SettingsDialogProps) {
  const [activeItemId, setActiveItemId] = useState<SettingsItemId>(initialSection)

  // Reset to initial section when dialog opens
  useEffect(() => {
    if (open && initialSection) {
      setActiveItemId(initialSection)
    }
  }, [open, initialSection])

  const renderPane = () => {
    switch (activeItemId) {
      case "account":
        return <AccountPane />
      case "notifications":
        return <NotificationsPane />
      case "preferences":
        return <PreferencesPane />
      case "teammates":
        return <TeammatesPane />
      case "identity":
        return <IdentityPane />
      case "types":
        return <TypesPane />
      case "tags":
        return <TagsPane />
      case "billing":
        return <BillingPane />
      case "import":
        return <ImportPane />
      case "agents":
        return <AgentsPane />
      case "skills":
        return <SkillsPane />
      default:
        return <AccountPane />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-5xl w-full p-0 overflow-hidden sm:max-h-[85vh] sm:h-[85vh] gap-0"
      >
        <VisuallyHidden>
          <DialogTitle>Settings</DialogTitle>
        </VisuallyHidden>
        <div className="flex h-full flex-col sm:flex-row sm:min-h-0">
          <SettingsSidebar
            activeItemId={activeItemId}
            onItemSelect={setActiveItemId}
          />
          <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6 sm:min-h-0">
            {renderPane()}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
