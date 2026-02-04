"use client"

import { useState, createContext, useContext, useCallback, useMemo, useEffect, type ReactNode } from "react"
import { CommandPaletteLazy } from "@/components/command-palette-lazy"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"
import { TaskQuickCreateModalLazy } from "@/components/tasks/TaskQuickCreateModalLazy"
import { useOrganization } from "@/hooks/use-organization"
import { getTags } from "@/lib/actions/tags"
import { useSettingsDialog } from "@/components/providers/settings-dialog-provider"
import type { OrganizationTag } from "@/lib/supabase/types"

type CommandPaletteContextValue = {
  openCreateProject: () => void
  openCreateTask: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPaletteActions() {
  const context = useContext(CommandPaletteContext)
  if (!context) {
    throw new Error("useCommandPaletteActions must be used within CommandPaletteProvider")
  }
  return context
}

type CommandPaletteProviderProps = {
  children: ReactNode
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [organizationTags, setOrganizationTags] = useState<OrganizationTag[]>([])
  const { organization } = useOrganization()
  const { openSettings } = useSettingsDialog()

  // Fetch organization tags when organization changes
  useEffect(() => {
    if (!organization?.id) {
      setOrganizationTags([])
      return
    }

    getTags(organization.id).then((result) => {
      if (result.data) {
        setOrganizationTags(result.data)
      }
    })
  }, [organization?.id])

  const openCreateProject = useCallback(() => {
    setShowProjectWizard(true)
  }, [])

  const openCreateTask = useCallback(() => {
    setShowTaskModal(true)
  }, [])

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({ openCreateProject, openCreateTask }),
    [openCreateProject, openCreateTask]
  )

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}

      {/* Command Palette - lazy loaded on first Cmd+K press */}
      <CommandPaletteLazy
        onCreateProject={openCreateProject}
        onCreateTask={openCreateTask}
        onOpenSettings={openSettings}
      />

      {/* Project Creation Wizard */}
      {showProjectWizard && organization && (
        <ProjectWizardLazy
          organizationId={organization.id}
          onClose={() => setShowProjectWizard(false)}
        />
      )}

      {/* Task Creation Modal */}
      {showTaskModal && (
        <TaskQuickCreateModalLazy
          open={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          projects={[]}
          organizationMembers={[]}
          tags={organizationTags}
        />
      )}
    </CommandPaletteContext.Provider>
  )
}
