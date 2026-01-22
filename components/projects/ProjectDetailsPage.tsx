"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { LinkSimple, SquareHalf } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"

import type { ProjectDetails } from "@/lib/data/project-details"
import { getProjectDetailsById } from "@/lib/data/project-details"
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
import type { ProjectWithRelations } from "@/lib/actions/projects"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { Client, Workstream } from "@/lib/supabase/types"

type ProjectDetailsPageProps = {
  project: ProjectWithRelations
  clients: Client[]
  tasks: TaskWithRelations[]
  workstreams: Workstream[]
  organizationId: string
}

// Convert real project to mock data format for backward compatibility
function toProjectDetails(
  project: ProjectWithRelations,
  tasks: TaskWithRelations[],
  workstreams: Workstream[]
): ProjectDetails {
  // Get mock data as fallback for fields not in DB yet
  const mockProject = getProjectDetailsById(project.id)

  // Build source data from real project
  const source = {
    ...(mockProject.source || {}),
    id: project.id,
    name: project.name,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    client: project.client?.name,
    typeLabel: project.type_label || undefined,
    startDate: project.start_date ? new Date(project.start_date) : new Date(),
    endDate: project.end_date ? new Date(project.end_date) : new Date(),
    tags: project.tags || [],
    members: project.members?.map(m => m.profile?.full_name || m.profile?.email || "Unknown") || [],
    taskCount: tasks.length,
    tasks: [],
    durationLabel: undefined,
  }

  // Convert real workstreams/tasks when available
  const workstreamGroups = workstreams.length
    ? workstreams.map(w => ({
        id: w.id,
        name: w.name,
        tasks: tasks
          .filter(t => t.workstream_id === w.id)
          .map(t => ({
            id: t.id,
            name: t.name,
            status: (t.status === "todo" ? "todo" : t.status === "done" ? "done" : "in-progress") as "todo" | "in-progress" | "done",
            assignee: t.assignee ? {
              id: t.assignee.id,
              name: t.assignee.full_name || t.assignee.email,
              avatarUrl: t.assignee.avatar_url || undefined,
            } : undefined,
          })),
      }))
    : mockProject.workstreams

  return {
    ...mockProject,
    id: project.id,
    name: project.name,
    description: project.description || mockProject.description,
    workstreams: workstreamGroups,
    source: source as ProjectDetails["source"],
  }
}

export function ProjectDetailsPage({
  project,
  clients,
  tasks,
  workstreams,
  organizationId,
}: ProjectDetailsPageProps) {
  const router = useRouter()
  const [showMeta, setShowMeta] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  // Convert to mock data format for backward compatibility
  const projectDetails = useMemo(
    () => toProjectDetails(project, tasks, workstreams),
    [project, tasks, workstreams]
  )

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
      { label: project.name },
    ],
    [project.name]
  )

  const openWizard = useCallback(() => {
    setIsWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false)
    router.refresh()
  }, [router])

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
                <ProjectHeader project={projectDetails} onEditProject={openWizard} />

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
                      <p className="text-sm leading-6 text-muted-foreground">{projectDetails.description}</p>
                      <ScopeColumns scope={projectDetails.scope} />
                      <OutcomesList outcomes={projectDetails.outcomes} />
                      <KeyFeaturesColumns features={projectDetails.keyFeatures} />
                      <TimelineGantt tasks={projectDetails.timelineTasks} />
                    </div>
                  </TabsContent>

                  <TabsContent value="workstream">
                    <WorkstreamTab workstreams={projectDetails.workstreams} />
                  </TabsContent>

                  <TabsContent value="tasks">
                    <ProjectTasksTab project={projectDetails} />
                  </TabsContent>

                  <TabsContent value="notes">
                    <NotesTab notes={projectDetails.notes || []} />
                  </TabsContent>

                  <TabsContent value="assets">
                    <AssetsFilesTab files={projectDetails.files} />
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
                    <RightMetaPanel project={projectDetails} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />

        {isWizardOpen && (
          <ProjectWizard
            onClose={closeWizard}
            onCreate={closeWizard}
            organizationId={organizationId}
            clients={clients}
          />
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
