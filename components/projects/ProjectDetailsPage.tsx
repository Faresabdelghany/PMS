"use client"

import { useCallback, useEffect, useMemo, useState, useRef, Suspense, startTransition, useTransition } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  LazyOutcomesList,
  LazyKeyFeaturesColumns,
  LazyTimelineGantt,
  LazyRightMetaPanel,
} from "@/components/lazy-hydrate"
import { LinkSimple } from "@phosphor-icons/react/dist/ssr/LinkSimple"
import { SquareHalf } from "@phosphor-icons/react/dist/ssr/SquareHalf"
import { toast } from "sonner"
import { useProjectRealtime } from "@/hooks/use-realtime"

import type { ProjectFullDetails, ProjectWithRelations } from "@/lib/actions/projects"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type {
  WorkstreamWithTasks,
  OrganizationMember,
} from "@/lib/transforms/project-details"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { ScopeColumns } from "@/components/projects/ScopeColumns"
import { WorkstreamTabLazy } from "@/components/projects/WorkstreamTabLazy"
import { ProjectTasksTabLazy } from "@/components/projects/ProjectTasksTabLazy"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"
import { useUser } from "@/hooks/use-user"
import { TaskQuickCreateModalLazy as TaskQuickCreateModal, type TaskData, type CreateTaskContext } from "@/components/tasks/TaskQuickCreateModalLazy"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WorkstreamTask, ProjectDetails } from "@/lib/data/project-details"
import type { OrganizationTagLean } from "@/lib/supabase/types"

// Lazy load tab content that's not immediately visible
// Preload functions to be called on tab hover for instant feel
const NotesTab = dynamic(() => import("@/components/projects/NotesTab").then(m => m.NotesTab), { ssr: false })
const preloadNotesTab = () => import("@/components/projects/NotesTab")

const AssetsFilesTab = dynamic(() => import("@/components/projects/AssetsFilesTab").then(m => m.AssetsFilesTab), { ssr: false })
const preloadAssetsFilesTab = () => import("@/components/projects/AssetsFilesTab")

const DeliverableTab = dynamic(() => import("@/components/projects/DeliverableTab").then(m => m.DeliverableTab), { ssr: false })
const preloadDeliverableTab = () => import("@/components/projects/DeliverableTab")

const ProjectReportsTab = dynamic(() => import("@/components/reports/ProjectReportsTab").then(m => m.ProjectReportsTab), { ssr: false })
const preloadReportsTab = () => import("@/components/reports/ProjectReportsTab")

const AddFileModal = dynamic(() => import("@/components/projects/AddFileModal").then(m => m.AddFileModal), { ssr: false })

// Tab loading skeleton
function TabSkeleton() {
  return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  )
}

import type { ProjectReportListItem } from "@/lib/actions/reports"

/**
 * Lean subset of ProjectFullDetails — only the fields the client component uses.
 * Strips scope, outcomes, features, metrics, notes, files, and wizard-only
 * fields to reduce RSC serialization payload.
 */
export type ProjectDetailLean = Pick<
  ProjectFullDetails,
  | "id" | "name" | "description" | "status" | "priority"
  | "start_date" | "end_date" | "client_id" | "client"
  | "type_label" | "tags" | "group_label" | "label_badge"
  | "members" | "organization_id" | "currency" | "deliverables"
>

type ProjectDetailsPageProps = {
  projectId: string
  project: ProjectDetails
  supabaseProject: ProjectDetailLean
  tasks?: TaskWithRelations[]
  workstreams?: WorkstreamWithTasks[]
  clients?: { id: string; name: string }[]
  organizationMembers?: OrganizationMember[]
  organizationTags?: OrganizationTagLean[]
  reports?: ProjectReportListItem[]
}

export function ProjectDetailsPage({
  projectId,
  project,
  supabaseProject,
  tasks = [],
  workstreams = [],
  clients = [],
  organizationMembers = [],
  organizationTags = [],
  reports = [],
}: ProjectDetailsPageProps) {
  const router = useRouter()
  const { user, profile } = useUser()
  const [showMeta, setShowMeta] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isFileModalOpen, setIsFileModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [, startTabTransition] = useTransition()

  // Real-time subscription for project updates (e.g., from AI chat)
  // Debounce rapid updates (e.g., AI making multiple changes) and use
  // startTransition to mark refresh as non-urgent, improving INP
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useProjectRealtime(projectId, {
    onUpdate: useCallback(() => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        startTransition(() => {
          router.refresh()
        })
      }, 300)
    }, [router]),
  })

  // Clean up debounce timer on unmount to prevent stale router.refresh() calls
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  // Workstream tab state
  const [isWorkstreamTaskModalOpen, setIsWorkstreamTaskModalOpen] = useState(false)
  const [workstreamTaskContext, setWorkstreamTaskContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingWorkstreamTask, setEditingWorkstreamTask] = useState<TaskData | undefined>(undefined)

  // project is now pre-computed on the server (page.tsx) to avoid blocking client render

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
      { label: "Projects", href: "/projects" },
      { label: project.name },
    ],
    [project.name]
  )

  const openWizard = useCallback(() => {
    setIsWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false)
  }, [])

  // Workstream tab callbacks
  const handleAddTaskFromWorkstream = useCallback((workstreamId: string, workstreamName: string) => {
    setWorkstreamTaskContext({ projectId, workstreamId, workstreamName })
    setEditingWorkstreamTask(undefined)
    setIsWorkstreamTaskModalOpen(true)
  }, [projectId])

  const handleEditTaskFromWorkstream = useCallback((task: WorkstreamTask, workstreamId: string, workstreamName: string) => {
    // Convert WorkstreamTask to TaskData format
    const taskData: TaskData = {
      id: task.id,
      name: task.name,
      status: task.status as "todo" | "in-progress" | "done",
      priority: task.priority,
      description: task.description || undefined,
      tag: task.tag || undefined,
      startDate: task.startDate || undefined,
      endDate: task.endDate || undefined,
      assignee: task.assignee ? {
        id: task.assignee.id || "",
        name: task.assignee.name,
        avatarUrl: task.assignee.avatarUrl || null,
      } : undefined,
      projectId,
      projectName: supabaseProject.name,
      workstreamId,
      workstreamName,
    }
    setEditingWorkstreamTask(taskData)
    setWorkstreamTaskContext(undefined)
    setIsWorkstreamTaskModalOpen(true)
  }, [projectId, supabaseProject.name])

  const handleWorkstreamTaskModalClose = useCallback(() => {
    setIsWorkstreamTaskModalOpen(false)
    setWorkstreamTaskContext(undefined)
    setEditingWorkstreamTask(undefined)
  }, [])

  // Projects data for workstream task modal
  const projectsForWorkstreamModal = useMemo(() => [{
    id: projectId,
    name: supabaseProject.name,
    workstreams: workstreams.map(ws => ({ id: ws.id, name: ws.name })),
  }], [projectId, supabaseProject.name, workstreams])

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
            onClick={() => startTransition(() => setShowMeta((v) => !v))}
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
                  : "")
              }
            >
              <div className="space-y-6 pt-4">
                <ProjectHeader project={project} status={supabaseProject.status} onEditProject={openWizard} />

                <Tabs value={activeTab} onValueChange={(value) => startTabTransition(() => setActiveTab(value))}>
                  <TabsList className="w-full gap-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="workstream">Workstream</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="notes" onMouseEnter={() => preloadNotesTab()}>Notes</TabsTrigger>
                    <TabsTrigger value="assets" onMouseEnter={() => preloadAssetsFilesTab()}>Assets &amp; Files</TabsTrigger>
                    <TabsTrigger value="deliverables" onMouseEnter={() => preloadDeliverableTab()}>Deliverables</TabsTrigger>
                    <TabsTrigger value="reports" onMouseEnter={() => preloadReportsTab()}>Reports</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="space-y-10">
                      {project.description && (
                        <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
                      )}
                      <ScopeColumns scope={project.scope} />
                      {/* Below-fold sections - lazy hydrated for performance */}
                      <LazyOutcomesList outcomes={project.outcomes} />
                      <LazyKeyFeaturesColumns features={project.keyFeatures} />
                      <LazyTimelineGantt tasks={project.timelineTasks} />
                    </div>
                  </TabsContent>

                  <TabsContent value="workstream">
                    <WorkstreamTabLazy
                      projectId={projectId}
                      projectEndDate={supabaseProject.end_date}
                      workstreams={project.workstreams}
                      allProjectTasks={tasks.map(t => ({ id: t.id, name: t.name, workstream_id: t.workstream_id }))}
                      organizationMembers={organizationMembers}
                      onAddTask={handleAddTaskFromWorkstream}
                      onEditTask={handleEditTaskFromWorkstream}
                    />
                  </TabsContent>

                  <TabsContent value="tasks">
                    <Suspense fallback={<TabSkeleton />}>
                      <ProjectTasksTabLazy
                        projectId={projectId}
                        projectName={supabaseProject.name}
                        organizationId={supabaseProject.organization_id}
                        initialTasks={tasks}
                        workstreams={workstreams.map(ws => ({ id: ws.id, name: ws.name }))}
                        organizationMembers={organizationMembers}
                        organizationTags={organizationTags}
                      />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="notes">
                    <Suspense fallback={<TabSkeleton />}>
                      <NotesTab
                        projectId={projectId}
                        projectName={project.name}
                        notes={project.notes || []}
                        onRefresh={() => startTransition(() => router.refresh())}
                      />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="assets">
                    <Suspense fallback={<TabSkeleton />}>
                      <AssetsFilesTab projectId={project.id} />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="deliverables">
                    <Suspense fallback={<TabSkeleton />}>
                      <DeliverableTab
                        projectId={projectId}
                        deliverables={supabaseProject.deliverables}
                        currency={supabaseProject.currency || "USD"}
                        onRefresh={() => startTransition(() => router.refresh())}
                      />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="reports">
                    <Suspense fallback={<TabSkeleton />}>
                      <ProjectReportsTab
                        projectId={projectId}
                        projectName={supabaseProject.name}
                        organizationId={supabaseProject.organization_id}
                        reports={reports}
                        organizationMembers={organizationMembers.map(m => ({
                          id: m.user_id,
                          name: m.profile?.full_name || m.profile?.email || "Unknown",
                          email: m.profile?.email || "",
                          avatarUrl: m.profile?.avatar_url || null,
                        }))}
                        onRefresh={() => startTransition(() => router.refresh())}
                      />
                    </Suspense>
                  </TabsContent>
                </Tabs>
              </div>

              {showMeta && (
                <div className="lg:border-l lg:border-border lg:pl-6 animate-in fade-in duration-150">
                  {/* Side panel - lazy hydrated, conditionally rendered to avoid hydration when collapsed */}
                  <LazyRightMetaPanel
                    time={project.time}
                    backlog={project.backlog}
                    quickLinks={project.quickLinks}
                    client={supabaseProject.client}
                    onUploadClick={() => setIsFileModalOpen(true)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />

        {isWizardOpen && (
          <ProjectWizardLazy
            onClose={closeWizard}
            onCreate={() => {
              closeWizard()
              startTransition(() => router.refresh())
            }}
            organizationId={supabaseProject.organization_id}
            clients={clients}
            editingProject={{
              id: supabaseProject.id,
              name: supabaseProject.name,
              description: supabaseProject.description,
              status: supabaseProject.status,
              priority: supabaseProject.priority,
              start_date: supabaseProject.start_date,
              end_date: supabaseProject.end_date,
              client_id: supabaseProject.client_id,
              client: supabaseProject.client,
              type_label: supabaseProject.type_label,
              tags: supabaseProject.tags,
              group_label: supabaseProject.group_label,
              label_badge: supabaseProject.label_badge,
              members: supabaseProject.members,
            }}
          />
        )}

        {/* Task Modal for Workstream Tab */}
        <TaskQuickCreateModal
          open={isWorkstreamTaskModalOpen}
          onClose={handleWorkstreamTaskModalClose}
          context={editingWorkstreamTask ? undefined : workstreamTaskContext}
          editingTask={editingWorkstreamTask}
          projects={projectsForWorkstreamModal}
          organizationMembers={organizationMembers}
          tags={organizationTags}
        />

        {/* File Upload Modal for Quick Links */}
        {user && (
          <AddFileModal
            open={isFileModalOpen}
            onOpenChange={setIsFileModalOpen}
            projectId={projectId}
            currentUser={{
              id: user.id,
              name: profile?.full_name || user.email,
              avatarUrl: profile?.avatar_url || undefined,
            }}
            onCreate={() => {
              startTransition(() => router.refresh())
            }}
          />
        )}
      </div>
    </div>
  )
}

