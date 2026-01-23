"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LinkSimple, SquareHalf } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"

import type { ProjectDetails } from "@/lib/data/project-details"
import { getProjectDetailsById } from "@/lib/data/project-details"
import type { ProjectFullDetails } from "@/lib/actions/projects"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { ScopeColumns } from "@/components/projects/ScopeColumns"
import { OutcomesList } from "@/components/projects/OutcomesList"
import { KeyFeaturesColumns } from "@/components/projects/KeyFeaturesColumns"
import { TimelineGantt } from "@/components/projects/TimelineGantt"
import { RightMetaPanel } from "@/components/projects/RightMetaPanel"
import { WorkstreamTab } from "@/components/projects/WorkstreamTab"
import { ProjectTasksTab } from "@/components/projects/ProjectTasksTab"
import { NotesTab } from "@/components/projects/NotesTab"
import { AssetsFilesTab } from "@/components/projects/AssetsFilesTab"
import { ProjectWizard } from "@/components/project-wizard/ProjectWizard"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

type ProjectDetailsPageProps = {
  projectId: string
  supabaseProject?: ProjectFullDetails | null
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; project: ProjectDetails }

export function ProjectDetailsPage({ projectId, supabaseProject }: ProjectDetailsPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [showMeta, setShowMeta] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Get mock project details structure as fallback
    let project = getProjectDetailsById(projectId)

    // Override with Supabase data if available
    if (supabaseProject) {
      // Map Supabase scope to UI format
      const inScope = supabaseProject.scope
        .filter((s) => s.is_in_scope)
        .map((s) => s.item)
      const outOfScope = supabaseProject.scope
        .filter((s) => !s.is_in_scope)
        .map((s) => s.item)

      // Map Supabase outcomes to UI format
      const outcomes = supabaseProject.outcomes.map((o) => o.item)

      // Map Supabase features to UI format (grouped by priority)
      const p0Features = supabaseProject.features
        .filter((f) => f.priority === 0)
        .map((f) => f.item)
      const p1Features = supabaseProject.features
        .filter((f) => f.priority === 1)
        .map((f) => f.item)
      const p2Features = supabaseProject.features
        .filter((f) => f.priority === 2)
        .map((f) => f.item)

      // Build the project object with Supabase data
      project = {
        ...project,
        id: supabaseProject.id,
        name: supabaseProject.name,
        description: supabaseProject.description || project.description,
        meta: {
          ...project.meta,
          priorityLabel: supabaseProject.priority.charAt(0).toUpperCase() + supabaseProject.priority.slice(1),
        },
        backlog: {
          ...project.backlog,
          statusLabel: supabaseProject.status === "active" ? "Active"
            : supabaseProject.status === "planned" ? "Planned"
            : supabaseProject.status === "completed" ? "Completed"
            : supabaseProject.status === "cancelled" ? "Cancelled"
            : "Backlog",
          priorityLabel: supabaseProject.priority.charAt(0).toUpperCase() + supabaseProject.priority.slice(1),
        },
        time: {
          ...project.time,
          progressPercent: supabaseProject.progress || 0,
        },
        // Use Supabase data for scope, outcomes, features if available
        scope: {
          inScope: inScope.length > 0 ? inScope : project.scope.inScope,
          outOfScope: outOfScope.length > 0 ? outOfScope : project.scope.outOfScope,
        },
        outcomes: outcomes.length > 0 ? outcomes : project.outcomes,
        keyFeatures: {
          p0: p0Features.length > 0 ? p0Features : project.keyFeatures.p0,
          p1: p1Features.length > 0 ? p1Features : project.keyFeatures.p1,
          p2: p2Features.length > 0 ? p2Features : project.keyFeatures.p2,
        },
      }
      // When we have Supabase data, set state immediately (no artificial delay)
      setState({ status: "ready", project })
      return
    }

    // Only use delay for mock data fallback
    setState({ status: "loading" })
    const delay = 600 + Math.floor(Math.random() * 301)
    const t = setTimeout(() => {
      if (cancelled) return
      setState({ status: "ready", project })
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [projectId, supabaseProject])

  const copyLink = useCallback(async () => {
    if (!navigator.clipboard) {
      toast.error("Clipboard not available")
      return
    }

    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }, [])

  const breadcrumbs = useMemo(
    () => [
      { label: "Projects", href: "/" },
      { label: state.status === "ready" ? state.project.name : "Project Details" },
    ],
    [state.status, state.status === "ready" ? state.project.name : null]
  )

  const openWizard = useCallback(() => {
    setIsWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false)
  }, [])

  if (state.status === "loading") {
    return <ProjectDetailsSkeleton />
  }

  const project = state.project

  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <div className="hidden sm:block">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Copy link" onClick={copyLink}>
            <LinkSimple className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={!showMeta}
            aria-label={showMeta ? "Collapse meta panel" : "Expand meta panel"}
            className={showMeta ? "bg-muted" : ""}
            onClick={() => setShowMeta((v) => !v)}
          >
            <SquareHalf className="h-4 w-4" weight="duotone" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-background px-2 my-0 rounded-b-lg min-w-0 border-t">
        <div className="px-4">
          <div className="mx-auto w-full max-w-7xl">

            <div
              className={
                "mt-0 grid grid-cols-1 gap-15 " +
                (showMeta
                  ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]"
                  : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0px)]")
              }
            >
              <div className="space-y-6 pt-4">
                <ProjectHeader project={project} onEditProject={openWizard} />

                <Tabs defaultValue="overview">
                  <TabsList className="w-full gap-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="workstream">Workstream</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="assets">Assets &amp; Files</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="space-y-10">
                      <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
                      <ScopeColumns scope={project.scope} />
                      <OutcomesList outcomes={project.outcomes} />
                      <KeyFeaturesColumns features={project.keyFeatures} />
                      <TimelineGantt tasks={project.timelineTasks} />
                    </div>
                  </TabsContent>

                  <TabsContent value="workstream">
                    <WorkstreamTab workstreams={project.workstreams} />
                  </TabsContent>

                  <TabsContent value="tasks">
                    <ProjectTasksTab project={project} />
                  </TabsContent>

                  <TabsContent value="notes">
                    <NotesTab notes={project.notes || []} />
                  </TabsContent>

                  <TabsContent value="assets">
                    <AssetsFilesTab files={project.files} />
                  </TabsContent>
                </Tabs>
              </div>

              <AnimatePresence initial={false}>
                {showMeta && (
                  <motion.div
                    key="meta-panel"
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 80, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="lg:border-l lg:border-border lg:pl-6"
                  >
                    <RightMetaPanel project={project} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />

        {isWizardOpen && (
          <ProjectWizard onClose={closeWizard} onCreate={closeWizard} />
        )}
      </div>
    </div>
  )
}

function ProjectDetailsSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="mt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-8 w-[360px]" />
          <Skeleton className="mt-3 h-5 w-[520px]" />
          <Skeleton className="mt-5 h-px w-full" />
          <Skeleton className="mt-5 h-16 w-full" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
