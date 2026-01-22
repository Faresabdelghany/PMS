"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ProjectHeader } from "@/components/project-header"
import { ProjectTimeline } from "@/components/project-timeline"
import { ProjectCardsView } from "@/components/project-cards-view"
import { ProjectBoardView } from "@/components/project-board-view"
import { ProjectWizard } from "@/components/project-wizard/ProjectWizard"
import { DEFAULT_VIEW_OPTIONS, type FilterChip, type ViewOptions } from "@/lib/view-options"
import { chipsToParams, paramsToChips } from "@/lib/url/filters"
import type { ProjectWithRelations } from "@/lib/actions/projects"
import type { Client } from "@/lib/supabase/types"

// Helper to compute filter counts from view projects
type ViewProject = ReturnType<typeof toViewProject>

function computeFilterCounts(projects: ViewProject[]) {
  const status: Record<string, number> = {}
  const priority: Record<string, number> = {}
  const tags: Record<string, number> = {}
  const members: Record<string, number> = {}

  for (const p of projects) {
    status[p.status] = (status[p.status] || 0) + 1
    priority[p.priority] = (priority[p.priority] || 0) + 1
    for (const tag of p.tags) {
      tags[tag] = (tags[tag] || 0) + 1
    }
    for (const member of p.members) {
      members[member] = (members[member] || 0) + 1
    }
  }

  return { status, priority, tags, members }
}

// Helper to convert DB project to view-compatible format
function toViewProject(p: ProjectWithRelations) {
  return {
    id: p.id,
    name: p.name,
    taskCount: 0, // Will be filled from tasks later
    progress: p.progress,
    startDate: p.start_date ? new Date(p.start_date) : new Date(),
    endDate: p.end_date ? new Date(p.end_date) : new Date(),
    status: p.status,
    priority: p.priority,
    tags: p.tags,
    members: p.members?.map((m) => m.profile?.full_name || m.profile?.email || "Unknown") || [],
    client: p.client?.name,
    typeLabel: p.type_label || undefined,
    durationLabel: undefined,
    tasks: [], // Tasks would be loaded separately
  }
}

type ProjectsContentProps = {
  initialProjects: ProjectWithRelations[]
  clients: Client[]
  organizationId: string
}

export function ProjectsContent({ initialProjects, clients, organizationId }: ProjectsContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [projects] = useState(initialProjects)
  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS)

  const [filters, setFilters] = useState<FilterChip[]>([])

  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const isSyncingRef = useRef(false)
  const prevParamsRef = useRef<string>("")

  const openWizard = () => {
    setIsWizardOpen(true)
  }

  const closeWizard = () => {
    setIsWizardOpen(false)
  }

  const handleProjectCreated = () => {
    setIsWizardOpen(false)
    router.refresh()
  }

  const removeFilter = (key: string, value: string) => {
    const next = filters.filter((f) => !(f.key === key && f.value === value))
    setFilters(next)
    replaceUrlFromChips(next)
  }

  const applyFilters = (chips: FilterChip[]) => {
    setFilters(chips)
    replaceUrlFromChips(chips)
  }

  useEffect(() => {
    const currentParams = searchParams.toString()

    // Only sync if this is the first load or if params actually changed (not from our own update)
    if (prevParamsRef.current === currentParams) return

    // If we just made an update, skip this sync to avoid feedback loop
    if (isSyncingRef.current) {
      isSyncingRef.current = false
      return
    }

    prevParamsRef.current = currentParams
    const params = new URLSearchParams(searchParams.toString())
    const chips = paramsToChips(params)
    setFilters(chips)
  }, [searchParams])

  const replaceUrlFromChips = (chips: FilterChip[]) => {
    const params = chipsToParams(chips)
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname

    isSyncingRef.current = true
    prevParamsRef.current = qs
    router.replace(url, { scroll: false })
  }
  // Convert to view format
  const viewProjects = useMemo(() => projects.map(toViewProject), [projects])

  const filteredProjects = useMemo(() => {
    let list = viewProjects.slice()

    // Apply showClosedProjects toggle
    if (!viewOptions.showClosedProjects) {
      list = list.filter((p) => p.status !== "completed" && p.status !== "cancelled")
    }

    // Build filter buckets from chips
    const statusSet = new Set<string>()
    const prioritySet = new Set<string>()
    const tagSet = new Set<string>()
    const memberSet = new Set<string>()

    for (const { key, value } of filters) {
      const k = key.trim().toLowerCase()
      const v = value.trim().toLowerCase()
      if (k.startsWith("status")) statusSet.add(v)
      else if (k.startsWith("priority")) prioritySet.add(v)
      else if (k.startsWith("tag")) tagSet.add(v)
      else if (k === "pic" || k.startsWith("member")) memberSet.add(v)
    }

    if (statusSet.size) list = list.filter((p) => statusSet.has(p.status.toLowerCase()))
    if (prioritySet.size) list = list.filter((p) => prioritySet.has(p.priority.toLowerCase()))
    if (tagSet.size) list = list.filter((p) => p.tags.some((t) => tagSet.has(t.toLowerCase())))
    if (memberSet.size) {
      const members = Array.from(memberSet)
      list = list.filter((p) => p.members.some((m) => members.some((mv) => m.toLowerCase().includes(mv))))
    }

    // Ordering
    const sorted = list.slice()
    if (viewOptions.ordering === "alphabetical") sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (viewOptions.ordering === "date") sorted.sort((a, b) => (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0))
    return sorted
  }, [filters, viewOptions, viewProjects])

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <ProjectHeader
        filters={filters}
        onRemoveFilter={removeFilter}
        onFiltersChange={applyFilters}
        counts={computeFilterCounts(filteredProjects)}
        viewOptions={viewOptions}
        onViewOptionsChange={setViewOptions}
        onAddProject={openWizard}
      />
      {viewOptions.viewType === "timeline" && <ProjectTimeline />}
      {viewOptions.viewType === "list" && <ProjectCardsView projects={filteredProjects} onCreateProject={openWizard} />}
      {viewOptions.viewType === "board" && <ProjectBoardView projects={filteredProjects} onAddProject={openWizard} />}
      {isWizardOpen && (
        <ProjectWizard
          onClose={closeWizard}
          onCreate={handleProjectCreated}
          organizationId={organizationId}
          clients={clients}
        />
      )}
    </div>
  )
}
