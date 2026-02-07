"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ProjectHeader } from "@/components/project-header"
import { ProjectCardsView } from "@/components/project-cards-view"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"

// Lazy-load heavy view components that are conditionally rendered
const ProjectTimeline = dynamic(
  () => import("@/components/project-timeline").then(m => ({ default: m.ProjectTimeline })),
  { ssr: false }
)
const ProjectBoardView = dynamic(
  () => import("@/components/project-board-view").then(m => ({ default: m.ProjectBoardView })),
  { ssr: false }
)
import { computeFilterCounts, type Project as MockProject } from "@/lib/data/projects"
import { DEFAULT_VIEW_OPTIONS, type FilterChip, type ViewOptions } from "@/lib/view-options"
import { chipsToParams, paramsToChips } from "@/lib/url/filters"
import { getProjects, type ProjectWithRelations } from "@/lib/actions/projects"
import { usePooledRealtime } from "@/hooks/realtime-context"
import type { Database } from "@/lib/supabase/types"
import type { EditingProjectData } from "@/components/project-wizard/steps/StepQuickCreate"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

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
  const [editingProject, setEditingProject] = useState<EditingProjectData | null>(null)
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

  // Real-time updates for projects (server-side filtered by organization)
  usePooledRealtime({
    table: "projects",
    filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
    enabled: !!organizationId,
    onInsert: (project: ProjectRow) => {
      setSupabaseProjects(prev => {
        if (prev.some(p => p.id === project.id)) return prev
        const newProject: ProjectWithRelations = {
          ...project,
          members: [],
          client: null,
        }
        return [newProject, ...prev]
      })
    },
    onUpdate: (project: ProjectRow) => {
      setSupabaseProjects(prev =>
        prev.map(p => p.id === project.id ? { ...p, ...project } : p)
      )
    },
    onDelete: (project: ProjectRow) => {
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
    setEditingProject(null)
    setIsWizardOpen(true)
  }

  const closeWizard = () => {
    setIsWizardOpen(false)
    setEditingProject(null)
  }

  const handleProjectCreated = () => {
    setIsWizardOpen(false)
    setEditingProject(null)
    // Refresh projects after creation/update
    fetchProjects()
  }

  // Convert ProjectWithRelations to EditingProjectData format
  const toEditingProject = (p: ProjectWithRelations): EditingProjectData => {
    // Derive owner_id from members with role "owner"
    const owner = p.members?.find(m => m.role === "owner")
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      start_date: p.start_date,
      end_date: p.end_date,
      client_id: p.client_id,
      client: p.client,
      type_label: p.type_label,
      tags: p.tags || [],
      owner_id: owner?.user_id,
      group_label: p.group_label,
      label_badge: p.label_badge,
      members: p.members?.map(m => ({
        user_id: m.user_id,
        role: m.role,
        profile: {
          id: m.profile.id,
          full_name: m.profile.full_name,
          email: m.profile.email,
          avatar_url: m.profile.avatar_url,
        },
      })),
    }
  }

  const openEditWizard = (projectId: string) => {
    const project = supabaseProjects.find(p => p.id === projectId)
    if (project) {
      setEditingProject(toEditingProject(project))
      setIsWizardOpen(true)
    }
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
      />
      {viewOptions.viewType === "timeline" && (
        <ProjectTimeline initialProjects={timelineProjects} />
      )}
      {viewOptions.viewType === "list" && (
        <ProjectCardsView
          projects={filteredProjects}
          onCreateProject={openWizard}
          onEditProject={(project) => openEditWizard(project.id)}
        />
      )}
      {viewOptions.viewType === "board" && (
        <ProjectBoardView
          projects={filteredProjects}
          onAddProject={openWizard}
          onEditProject={(project) => openEditWizard(project.id)}
        />
      )}
      {isWizardOpen && (
        <ProjectWizardLazy
          onClose={closeWizard}
          onCreate={handleProjectCreated}
          organizationId={organizationId}
          clients={clients}
          editingProject={editingProject}
        />
      )}
    </div>
  )
}
