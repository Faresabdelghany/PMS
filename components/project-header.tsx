"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { FilterChip } from "@/components/filter-chip"
import { ViewOptionsPopover } from "@/components/view-options-popover"
import { FilterPopover } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { AIChatSheet } from "@/components/ai/ai-chat-sheet"
import { Link as LinkIcon, Plus, Sparkle } from "@phosphor-icons/react/dist/ssr"
import { useOrganization } from "@/hooks/use-organization"
import type { FilterCounts } from "@/lib/data/projects"
import type { FilterChip as FilterChipType, ViewOptions } from "@/lib/view-options"
import type { ChatContext } from "@/lib/actions/ai"

interface ProjectSummary {
  id: string
  name: string
  status: string
  clientName?: string
  dueDate?: string
}

interface ProjectHeaderProps {
  filters: FilterChipType[]
  onRemoveFilter: (key: string, value: string) => void
  onFiltersChange: (chips: FilterChipType[]) => void
  counts?: FilterCounts
  viewOptions: ViewOptions
  onViewOptionsChange: (options: ViewOptions) => void
  onAddProject?: () => void
  projects?: ProjectSummary[]
}

export function ProjectHeader({ filters, onRemoveFilter, onFiltersChange, counts, viewOptions, onViewOptionsChange, onAddProject, projects = [] }: ProjectHeaderProps) {
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const { organization } = useOrganization()

  // Build ChatContext for the AI assistant
  const chatContext: ChatContext = {
    pageType: "projects_list",
    filters: filters.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {}),
    appData: {
      organization: {
        id: organization?.id || "",
        name: organization?.name || "Unknown Organization",
      },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        clientName: p.clientName,
        dueDate: p.dueDate,
      })),
      clients: [],
      teams: [],
      members: [],
      userTasks: [],
      inbox: [],
    },
  }

  return (
    <header className="flex flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddProject}>
            <Plus className="h-4 w-4" weight="bold" />
            Add Project
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <FilterPopover
            initialChips={filters}
            onApply={onFiltersChange}
            onClear={() => onFiltersChange([])}
            counts={counts}
          />
          <ChipOverflow chips={filters} onRemove={onRemoveFilter} maxVisible={6} />
        </div>
        <div className="flex items-center gap-2">
          <ViewOptionsPopover options={viewOptions} onChange={onViewOptionsChange} />
          <div className="relative">
            <div className="relative rounded-xl border border-border bg-card/80 shadow-sm overflow-hidden">
              <Button
                className="h-8 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 relative z-10 px-3"
                onClick={() => setIsAIChatOpen(true)}
              >
                <Sparkle className="h-4 w-4" weight="fill" />
                Ask AI
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AIChatSheet
        open={isAIChatOpen}
        onOpenChange={setIsAIChatOpen}
        context={chatContext}
      />
    </header>
  )
}
