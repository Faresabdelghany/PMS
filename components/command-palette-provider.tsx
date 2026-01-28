"use client"

import { useState, createContext, useContext, useCallback, type ReactNode } from "react"
import { CommandPalette } from "@/components/command-palette"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"
import { TaskQuickCreateModal } from "@/components/tasks/TaskQuickCreateModal"
import { useOrganization } from "@/hooks/use-organization"

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
  const { organization } = useOrganization()

  const openCreateProject = useCallback(() => {
    setShowProjectWizard(true)
  }, [])

  const openCreateTask = useCallback(() => {
    setShowTaskModal(true)
  }, [])

  return (
    <CommandPaletteContext.Provider value={{ openCreateProject, openCreateTask }}>
      {children}

      {/* Command Palette - always rendered, listens for Cmd+K */}
      <CommandPalette
        onCreateProject={openCreateProject}
        onCreateTask={openCreateTask}
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
        <TaskQuickCreateModal
          open={showTaskModal}
          onOpenChange={setShowTaskModal}
          projects={[]}
          members={[]}
          onSuccess={() => setShowTaskModal(false)}
        />
      )}
    </CommandPaletteContext.Provider>
  )
}
