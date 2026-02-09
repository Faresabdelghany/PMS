"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { FilterChip } from "@/components/filter-chip"
import { ChipOverflow } from "@/components/chip-overflow"
import { Link as LinkIcon } from "@phosphor-icons/react/dist/ssr/Link"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import type { FilterCounts } from "@/lib/data/projects"
import type { FilterChip as FilterChipType, ViewOptions } from "@/lib/view-options"

// Lazy-load heavy popovers — 615 LOC total, rarely needed on initial render
const FilterPopover = dynamic(
  () => import("@/components/filter-popover").then(m => ({ default: m.FilterPopover })),
  { ssr: false }
)
const ViewOptionsPopover = dynamic(
  () => import("@/components/view-options-popover").then(m => ({ default: m.ViewOptionsPopover })),
  { ssr: false }
)

interface ProjectHeaderProps {
  filters: FilterChipType[]
  onRemoveFilter: (key: string, value: string) => void
  onFiltersChange: (chips: FilterChipType[]) => void
  counts?: FilterCounts
  viewOptions: ViewOptions
  onViewOptionsChange: (options: ViewOptions) => void
  onAddProject?: () => void
}

export function ProjectHeader({ filters, onRemoveFilter, onFiltersChange, counts, viewOptions, onViewOptionsChange, onAddProject }: ProjectHeaderProps) {
  return (
    <header className="flex flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Copy link">
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
              <Button className="h-8 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 relative z-10 px-3">
                <Sparkle className="h-4 w-4" weight="fill" />
                Ask AI
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
