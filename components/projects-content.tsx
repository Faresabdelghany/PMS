"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ProjectHeader } from "@/components/project-header"
import { ProjectTimeline } from "@/components/project-timeline"
import { ProjectCardsView } from "@/components/project-cards-view"
import { ProjectBoardView } from "@/components/project-board-view"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"
import { computeFilterCounts, type Project as MockProject } from "@/lib/data/projects"
import { DEFAULT_VIEW_OPTIONS, type FilterChip, type ViewOptions } from "@/lib/view-options"
import { chipsToParams, paramsToChips } from "@/lib/url/filters"
import { getProjects, type ProjectWithRelations } from "@/lib/actions/projects"
import { usePooledProjectsRealtime } from "@/hooks/realtime-context"

// Convert Supabase project to mock project format for compatibility with existing views
// Note: Use a stable fallback date to avoid hydration mismatch (server vs client time diff)
const FALLBACK_DATE = new Date("2000-01-01")

function toMockProject(p: ProjectWithRelations): MockProject {
  return {
    id: p.id,
    name: p.name,
    taskCount: 0,
    progress: p.progress || 0,
    startDate: p.start_date ? new Date(p.start_date) : FALLBACK_DATE,
    endDate: p.end_date ? new Date(p.end_date) : FALLBACK_DATE,
    status: p.status,
    priority: p.priority,
    tags: p.tags || [],
    members: p.members?.map(m => m.profile?.full_name || m.profile?.email || "Unknown") || [],
    client: p.client?.name,
    typeLabel: p.type_label || undefined,
    durationLabel: undefined,
    tasks: [],
  }
}

interface ProjectsContentProps {
  initialProjects?: ProjectWithRelations[]
  clients?: { id: string; name: string }[]
  organizationId?: string
}

export function ProjectsContent({
  initialProjects = [],
  clients = [],
  organizationId
}: ProjectsContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS)
  const [filters, setFilters] = useState<FilterChip[]>([])
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [supabaseProjects, setSupabaseProjects] = useState<ProjectWithRelations[]>(initialProjects)

  const isSyncingRef = useRef(false)
  const prevParamsRef = useRef<string>("")

  // Fetch projects from Supabase
  const fetchProjects = useCallback(async () => {
    if (!organizationId) return

    const result = await getProjects(organizationId)
    if (result.data) {
      setSupabaseProjects(result.data)
    }
  }, [organizationId])

  // Real-time updates
  usePooledProjectsRealtime(organizationId, {
    onInsert: (project) => {
      setSupabaseProjects(prev => [project as ProjectWithRelations, ...prev])
    },
    onUpdate: (project) => {
      setSupabaseProjects(prev =>
        prev.map(p => p.id === project.id ? { ...p, ...project } : p)
      )
    },
    onDelete: (project) => {
      setSupabaseProjects(prev => prev.filter(p => p.id !== project.id))
    },
  })

  // Map Supabase projects to mock format for view compatibility
  const projects = useMemo(() => {
    return supabaseProjects.map(toMockProject)
  }, [supabaseProjects])

  // Map projects to timeline format
  const timelineProjects = useMemo(() =>
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      progress: p.progress,
      priority: p.priority,
      taskCount: p.taskCount,
      tasks: p.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status: t.status,
        assignee: t.assignee,
      })),
    })),
    [projects]
  )

  const openWizard = () => {
    setIsWizardOpen(true)
  }

  const closeWizard = () => {
    setIsWizardOpen(false)
  }

  const handleProjectCreated = () => {
    setIsWizardOpen(false)
    // Refresh projects after creation
    fetchProjects()
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
  const filteredProjects = useMemo(() => {
    let list = projects.slice()

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
  }, [filters, viewOptions, projects])

  // Memoize filter counts to prevent recomputation on every render
  const filterCounts = useMemo(() => computeFilterCounts(filteredProjects), [filteredProjects])

  // Memoize project summaries for AI context
  const projectSummaries = useMemo(() =>
    supabaseProjects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client?.name,
      dueDate: p.end_date || undefined,
    })),
    [supabaseProjects]
  )

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <ProjectHeader
        filters={filters}
        onRemoveFilter={removeFilter}
        onFiltersChange={applyFilters}
        counts={filterCounts}
        viewOptions={viewOptions}
        onViewOptionsChange={setViewOptions}
        onAddProject={openWizard}
        projects={projectSummaries}
      />
      {viewOptions.viewType === "timeline" && (
        <ProjectTimeline initialProjects={timelineProjects} />
      )}
      {viewOptions.viewType === "list" && <ProjectCardsView projects={filteredProjects} onCreateProject={openWizard} />}
      {viewOptions.viewType === "board" && <ProjectBoardView projects={filteredProjects} onAddProject={openWizard} />}
      {isWizardOpen && (
        <ProjectWizardLazy
          onClose={closeWizard}
          onCreate={handleProjectCreated}
          organizationId={organizationId}
          clients={clients}
        />
      )}
    </div>
  )
}
