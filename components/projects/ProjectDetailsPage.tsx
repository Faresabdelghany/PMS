"use client"

import { useCallback, useMemo, useState } from "react"
import { LinkSimple, SquareHalf } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { AnimatePresence, MotionDiv } from "@/components/ui/motion-lazy"

import type { ProjectFullDetails } from "@/lib/actions/projects"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { Workstream } from "@/lib/supabase/types"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { ScopeColumns } from "@/components/projects/ScopeColumns"
import { OutcomesList } from "@/components/projects/OutcomesList"
import { KeyFeaturesColumns } from "@/components/projects/KeyFeaturesColumns"
import { TimelineGantt } from "@/components/projects/TimelineGantt"
import { RightMetaPanel } from "@/components/projects/RightMetaPanel"
import { WorkstreamTabLazy } from "@/components/projects/WorkstreamTabLazy"
import { ProjectTasksTabLazy } from "@/components/projects/ProjectTasksTabLazy"
import { NotesTab } from "@/components/projects/NotesTab"
import { AssetsFilesTab } from "@/components/projects/AssetsFilesTab"
import { ProjectWizardLazy } from "@/components/project-wizard/ProjectWizardLazy"
import { TaskQuickCreateModal, type TaskData, type CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { WorkstreamTask } from "@/lib/data/project-details"
import { formatDueLabel, getDueTone, formatStartLabel } from "@/lib/date-utils"

// Workstream with tasks type from the action
type WorkstreamWithTasks = Workstream & {
  tasks: {
    id: string
    name: string
    status: string
    priority: string
    assignee_id: string | null
    start_date: string | null
    end_date: string | null
    tag: string | null
    sort_order: number
  }[]
}

// Internal project details type for UI
type ProjectDetailsUI = {
  id: string
  name: string
  description: string
  meta: {
    priorityLabel: string
  }
  backlog: {
    statusLabel: "Active" | "Backlog" | "Planned" | "Completed" | "Cancelled"
    groupLabel: string
    priorityLabel: string
    labelBadge: string
    picUsers: { id: string; name: string; avatarUrl?: string }[]
    supportUsers?: { id: string; name: string; avatarUrl?: string }[]
  }
  time: {
    estimateLabel: string
    dueDate: Date | null
    daysRemainingLabel: string
    progressPercent: number
  }
  scope: {
    inScope: string[]
    outOfScope: string[]
  }
  outcomes: string[]
  keyFeatures: {
    p0: string[]
    p1: string[]
    p2: string[]
  }
  workstreams: {
    id: string
    name: string
    tasks: {
      id: string
      name: string
      status: string
      priority: string
      assignee?: { name: string; avatarUrl?: string } | null
    }[]
  }[]
  timelineTasks: {
    id: string
    name: string
    status: string
    startDate?: Date
    endDate?: Date
  }[]
  files: never[]
  notes: never[]
  quickLinks: { id: string; label: string; url: string; iconType: string }[]
}

type OrganizationMember = {
  id: string
  user_id: string
  role: string
  profile: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

type ProjectDetailsPageProps = {
  projectId: string
  supabaseProject: ProjectFullDetails
  tasks?: TaskWithRelations[]
  workstreams?: WorkstreamWithTasks[]
  clients?: { id: string; name: string }[]
  organizationMembers?: OrganizationMember[]
}

export function ProjectDetailsPage({
  projectId,
  supabaseProject,
  tasks = [],
  workstreams = [],
  clients = [],
  organizationMembers = [],
}: ProjectDetailsPageProps) {
  const [showMeta, setShowMeta] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  // Workstream tab state
  const [isWorkstreamTaskModalOpen, setIsWorkstreamTaskModalOpen] = useState(false)
  const [workstreamTaskContext, setWorkstreamTaskContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingWorkstreamTask, setEditingWorkstreamTask] = useState<TaskData | undefined>(undefined)

  // Map Supabase data to UI format
  const project = useMemo<ProjectDetailsUI>(() => {
    // Map scope to UI format
    const inScope = supabaseProject.scope
      .filter((s) => s.is_in_scope)
      .map((s) => s.item)
    const outOfScope = supabaseProject.scope
      .filter((s) => !s.is_in_scope)
      .map((s) => s.item)

    // Map outcomes to UI format
    const outcomes = supabaseProject.outcomes.map((o) => o.item)

    // Map features to UI format (grouped by priority)
    const p0Features = supabaseProject.features
      .filter((f) => f.priority === 0)
      .map((f) => f.item)
    const p1Features = supabaseProject.features
      .filter((f) => f.priority === 1)
      .map((f) => f.item)
    const p2Features = supabaseProject.features
      .filter((f) => f.priority === 2)
      .map((f) => f.item)

    // Map workstreams to UI format
    const uiWorkstreams = workstreams.map((ws) => ({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      startDate: ws.start_date,
      endDate: ws.end_date,
      tag: ws.tag,
      tasks: ws.tasks.map((t) => {
        // Find assignee from organization members if assignee_id is present
        const assigneeMember = t.assignee_id
          ? organizationMembers.find((m) => m.user_id === t.assignee_id)
          : null

        // Parse dates
        const startDate = t.start_date ? new Date(t.start_date) : undefined
        const endDate = t.end_date ? new Date(t.end_date) : undefined

        return {
          id: t.id,
          name: t.name,
          status: t.status,
          priority: t.priority,
          startDate,
          dueLabel: endDate ? formatDueLabel(endDate) : undefined,
          dueTone: endDate ? getDueTone(endDate) : undefined,
          tag: t.tag || undefined,
          assignee: assigneeMember ? {
            id: assigneeMember.user_id,
            name: assigneeMember.profile.full_name || assigneeMember.profile.email,
            avatarUrl: assigneeMember.profile.avatar_url || undefined,
          } : undefined,
        }
      }),
    }))

    // Map tasks to timeline format
    const timelineTasks = tasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      startDate: t.start_date ? new Date(t.start_date) : undefined,
      endDate: t.end_date ? new Date(t.end_date) : undefined,
    }))

    const statusLabel = supabaseProject.status === "active" ? "Active"
      : supabaseProject.status === "planned" ? "Planned"
      : supabaseProject.status === "completed" ? "Completed"
      : supabaseProject.status === "cancelled" ? "Cancelled"
      : "Backlog"

    const priorityLabel = supabaseProject.priority.charAt(0).toUpperCase() + supabaseProject.priority.slice(1)

    // Calculate time data
    const dueDate = supabaseProject.end_date ? new Date(supabaseProject.end_date) : null
    const now = new Date()
    let daysRemaining = 0
    let daysRemainingLabel = "No due date"

    if (dueDate) {
      daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysRemaining < 0) {
        daysRemainingLabel = `${Math.abs(daysRemaining)} days overdue`
      } else if (daysRemaining === 0) {
        daysRemainingLabel = "Due today"
      } else if (daysRemaining === 1) {
        daysRemainingLabel = "1 day remaining"
      } else {
        daysRemainingLabel = `${daysRemaining} days remaining`
      }
    }

    // Calculate estimate label from start and end dates
    let estimateLabel = "Not set"
    if (supabaseProject.start_date && supabaseProject.end_date) {
      const startDate = new Date(supabaseProject.start_date)
      const endDate = new Date(supabaseProject.end_date)
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      if (durationDays >= 7) {
        const weeks = Math.round(durationDays / 7)
        estimateLabel = `${weeks} week${weeks > 1 ? "s" : ""}`
      } else {
        estimateLabel = `${durationDays} day${durationDays > 1 ? "s" : ""}`
      }
    }

    return {
      id: supabaseProject.id,
      name: supabaseProject.name,
      description: supabaseProject.description || "",
      meta: {
        priorityLabel,
      },
      backlog: {
        statusLabel: statusLabel as "Active" | "Backlog" | "Planned" | "Completed" | "Cancelled",
        groupLabel: supabaseProject.group_label || "General",
        priorityLabel,
        labelBadge: supabaseProject.label_badge || "Project",
        picUsers: (supabaseProject.members || [])
          .filter((m) => m.role === "owner" || m.role === "pic")
          .map((m) => ({
            id: m.profile.id,
            name: m.profile.full_name || m.profile.email,
            avatarUrl: m.profile.avatar_url || undefined,
          })),
        supportUsers: (supabaseProject.members || [])
          .filter((m) => m.role === "member")
          .map((m) => ({
            id: m.profile.id,
            name: m.profile.full_name || m.profile.email,
            avatarUrl: m.profile.avatar_url || undefined,
          })),
      },
      time: {
        estimateLabel,
        dueDate,
        daysRemainingLabel,
        progressPercent: supabaseProject.progress || 0,
      },
      scope: {
        inScope,
        outOfScope,
      },
      outcomes,
      keyFeatures: {
        p0: p0Features,
        p1: p1Features,
        p2: p2Features,
      },
      workstreams: uiWorkstreams,
      timelineTasks,
      files: [],
      notes: [],
      quickLinks: [],
    }
  }, [supabaseProject, tasks, workstreams])

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
                      organizationMembers={organizationMembers}
                      onAddTask={handleAddTaskFromWorkstream}
                      onEditTask={handleEditTaskFromWorkstream}
                    />
                  </TabsContent>

                  <TabsContent value="tasks">
                    <ProjectTasksTabLazy
                      projectId={projectId}
                      projectName={supabaseProject.name}
                      initialTasks={tasks}
                      workstreams={workstreams.map(ws => ({ id: ws.id, name: ws.name }))}
                      organizationMembers={organizationMembers}
                    />
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
                  <MotionDiv
                    key="meta-panel"
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 80, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="lg:border-l lg:border-border lg:pl-6"
                  >
                    <RightMetaPanel
                      time={project.time}
                      backlog={project.backlog}
                      quickLinks={project.quickLinks}
                      client={supabaseProject.client}
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
            onCreate={closeWizard}
            organizationId={supabaseProject.organization_id}
            clients={clients}
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
        />
      </div>
    </div>
  )
}

