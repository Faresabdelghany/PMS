"use client"

import { useCallback, useMemo, useState, Suspense, lazy, startTransition, useTransition } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { LinkSimple, SquareHalf } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { AnimatePresence, MotionDiv } from "@/components/ui/motion-lazy"
import { useProjectRealtime } from "@/hooks/use-realtime"

import type { ProjectFullDetails } from "@/lib/actions/projects"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import {
  transformProjectToUI,
  type WorkstreamWithTasks,
  type OrganizationMember,
} from "@/lib/transforms/project-details"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { ScopeColumns } from "@/components/projects/ScopeColumns"
import { OutcomesList } from "@/components/projects/OutcomesList"
import { KeyFeaturesColumns } from "@/components/projects/KeyFeaturesColumns"
import { TimelineGantt } from "@/components/projects/TimelineGantt"
import { RightMetaPanel } from "@/components/projects/RightMetaPanel"
import { WorkstreamTabLazy } from "@/components/projects/WorkstreamTabLazy"
import { ProjectTasksTabLazy } from "@/components/projects/ProjectTasksTabLazy"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"
import { useUser } from "@/hooks/use-user"
import { TaskQuickCreateModal, type TaskData, type CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WorkstreamTask, ProjectDetails } from "@/lib/data/project-details"
import type { OrganizationTag } from "@/lib/supabase/types"

// Lazy load tab content that's not immediately visible
const NotesTab = dynamic(() => import("@/components/projects/NotesTab").then(m => m.NotesTab), { ssr: false })
const AssetsFilesTab = dynamic(() => import("@/components/projects/AssetsFilesTab").then(m => m.AssetsFilesTab), { ssr: false })
const DeliverableTab = dynamic(() => import("@/components/projects/DeliverableTab").then(m => m.DeliverableTab), { ssr: false })
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

type ProjectDetailsPageProps = {
  projectId: string
  supabaseProject: ProjectFullDetails
  tasks?: TaskWithRelations[]
  workstreams?: WorkstreamWithTasks[]
  clients?: { id: string; name: string }[]
  organizationMembers?: OrganizationMember[]
  organizationTags?: OrganizationTag[]
}

export function ProjectDetailsPage({
  projectId,
  supabaseProject,
  tasks = [],
  workstreams = [],
  clients = [],
  organizationMembers = [],
  organizationTags = [],
}: ProjectDetailsPageProps) {
  const router = useRouter()
  const { user, profile } = useUser()
  const [showMeta, setShowMeta] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isFileModalOpen, setIsFileModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isTabPending, startTabTransition] = useTransition()

  // Real-time subscription for project updates (e.g., from AI chat)
  // Use startTransition to mark refresh as non-urgent, improving INP
  useProjectRealtime(projectId, {
    onUpdate: useCallback(() => {
      startTransition(() => {
        router.refresh()
      })
    }, [router]),
  })

  // Workstream tab state
  const [isWorkstreamTaskModalOpen, setIsWorkstreamTaskModalOpen] = useState(false)
  const [workstreamTaskContext, setWorkstreamTaskContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingWorkstreamTask, setEditingWorkstreamTask] = useState<TaskData | undefined>(undefined)

  // Transform Supabase data to UI format using extracted utility
  const project = useMemo<ProjectDetails>(
    () => transformProjectToUI(supabaseProject, tasks, workstreams, organizationMembers),
    [supabaseProject, tasks, workstreams, organizationMembers]
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
  }, [])

  // Workstream tab callbacks
  const handleAddTaskFromWorkstream = useCallback((workstreamId: string, workstreamName: string) => {
    setWorkstreamTaskContext({ projectId, workstreamId, workstreamName })
    setEditingWorkstreamTask(undefined)
    setIsWorkstreamTaskModalOpen(true)
  }, [projectId])

  const handleEditTaskFromWorkstream = useCallback((task: WorkstreamTask) => {
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
                  : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0px)]")
              }
            >
              <div className="space-y-6 pt-4">
                <ProjectHeader project={project} status={supabaseProject.status} onEditProject={openWizard} />

                <Tabs value={activeTab} onValueChange={(value) => startTabTransition(() => setActiveTab(value))}>
                  <TabsList className="w-full gap-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="workstream">Workstream</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="assets">Assets &amp; Files</TabsTrigger>
                    <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="space-y-10">
                      {project.description && (
                        <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
                      )}
                      <ScopeColumns scope={project.scope} />
                      <OutcomesList outcomes={project.outcomes} />
                      <KeyFeaturesColumns features={project.keyFeatures} />
                      <TimelineGantt tasks={project.timelineTasks} />
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
                    <ProjectTasksTabLazy
                      projectId={projectId}
                      projectName={supabaseProject.name}
                      organizationId={supabaseProject.organization_id}
                      initialTasks={tasks}
                      workstreams={workstreams.map(ws => ({ id: ws.id, name: ws.name }))}
                      organizationMembers={organizationMembers}
                      organizationTags={organizationTags}
                    />
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
                </Tabs>
              </div>

              <AnimatePresence initial={false}>
                {showMeta && (
                  <MotionDiv
                    key="meta-panel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="lg:border-l lg:border-border lg:pl-6"
                  >
                    <RightMetaPanel
                      time={project.time}
                      backlog={project.backlog}
                      quickLinks={project.quickLinks}
                      client={supabaseProject.client}
                      onUploadClick={() => setIsFileModalOpen(true)}
                    />
                  </MotionDiv>
                )}
              </AnimatePresence>
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

