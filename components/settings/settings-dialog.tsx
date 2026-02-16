"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { SettingsSidebar, type SettingsItemId } from "./settings-sidebar"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load all panes into separate webpack chunks for optimal code-splitting.
// Each pane gets its own chunk (~5-10kB each) instead of one bundled chunk (~71kB).
// webpackPrefetch on AccountPane loads the default pane in browser idle time.
const AccountPane = lazy(() => import(/* webpackChunkName: "settings-account", webpackPrefetch: true */ "./panes/account-pane").then(m => ({ default: m.AccountPane })))
const NotificationsPane = lazy(() => import(/* webpackChunkName: "settings-notifications" */ "./panes/notifications-pane").then(m => ({ default: m.NotificationsPane })))
const PreferencesPane = lazy(() => import(/* webpackChunkName: "settings-preferences" */ "./panes/preferences-pane").then(m => ({ default: m.PreferencesPane })))
const TeammatesPane = lazy(() => import(/* webpackChunkName: "settings-teammates" */ "./panes/teammates-pane").then(m => ({ default: m.TeammatesPane })))
const IdentityPane = lazy(() => import(/* webpackChunkName: "settings-identity" */ "./panes/identity-pane").then(m => ({ default: m.IdentityPane })))
const TypesPane = lazy(() => import(/* webpackChunkName: "settings-types" */ "./panes/types-pane").then(m => ({ default: m.TypesPane })))
const TagsPane = lazy(() => import(/* webpackChunkName: "settings-tags" */ "./panes/tags-pane").then(m => ({ default: m.TagsPane })))
const BillingPane = lazy(() => import(/* webpackChunkName: "settings-billing" */ "./panes/billing-pane").then(m => ({ default: m.BillingPane })))
const ImportPane = lazy(() => import(/* webpackChunkName: "settings-import" */ "./panes/import-pane").then(m => ({ default: m.ImportPane })))
const AgentsPane = lazy(() => import(/* webpackChunkName: "settings-agents" */ "./panes/agents-pane").then(m => ({ default: m.AgentsPane })))
const SkillsPane = lazy(() => import(/* webpackChunkName: "settings-skills" */ "./panes/skills-pane").then(m => ({ default: m.SkillsPane })))
const LabelsSettings = lazy(() => import(/* webpackChunkName: "settings-labels" */ "./labels-settings").then(m => ({ default: m.LabelsSettings })))

// Loading skeleton for settings panes
function SettingsPaneSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

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
      case "labels":
        return <LabelsSettings />
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
            <Suspense key={activeItemId} fallback={<SettingsPaneSkeleton />}>
              {renderPane()}
            </Suspense>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
