import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getOrgTasks, getOrgTaskStats } from "@/lib/actions/tasks-sprint3"
import { getAgentEvents } from "@/lib/actions/agent-events"
import { getAgents } from "@/lib/actions/agents"
import { getProjects } from "@/lib/actions/projects"
import { getMyTasks } from "@/lib/actions/tasks"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TasksBoard } from "@/components/tasks/TasksBoard"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = {
  title: "Tasks — PMS",
}

export const revalidate = 30

export default async function TasksPage() {
  const { orgId, user } = await getPageOrganization()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader
        title="Tasks"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks/new">
              <Plus size={14} weight="bold" className="mr-1.5" />
              New Task
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="my-tasks" className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border px-4">
          <TabsList className="h-auto p-0 bg-transparent gap-0 rounded-none">
            <TabsTrigger
              value="my-tasks"
              className="relative -mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground bg-transparent shadow-none"
            >
              My Tasks
            </TabsTrigger>
            <TabsTrigger
              value="mission-control"
              className="relative -mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground bg-transparent shadow-none"
            >
              Mission Control
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-tasks" className="flex-1 mt-0 min-h-0">
          <Suspense fallback={<MyTasksSkeleton />}>
            <MyTasksData orgId={orgId} userId={user.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="mission-control" className="flex-1 mt-0 min-h-0">
          <Suspense fallback={<MissionControlSkeleton />}>
            <MissionControlData orgId={orgId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

async function MyTasksData({ orgId, userId }: { orgId: string; userId: string }) {
  const [tasksResult, projectsResult] = await Promise.all([
    getMyTasks(orgId),
    getProjects(orgId),
  ])

  const tasks = tasksResult.data ?? []
  const hasMore = tasksResult.hasMore ?? false
  const nextCursor = tasksResult.nextCursor ?? null
  const projects = (projectsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    progress: p.progress,
    status: p.status,
    workstreams: (p as any).workstreams ?? [],
  }))

  return (
    <MyTasksPage
      initialTasks={tasks}
      initialHasMore={hasMore}
      initialCursor={nextCursor}
      projects={projects}
      organizationId={orgId}
      userId={userId}
    />
  )
}

async function MissionControlData({ orgId }: { orgId: string }) {
  const [tasksResult, statsResult, eventsResult, agentsResult] = await Promise.all([
    getOrgTasks(orgId),
    getOrgTaskStats(orgId),
    getAgentEvents(orgId, 20),
    getAgents(orgId),
  ])

  const tasks = tasksResult.data ?? []
  const stats = statsResult.data ?? {
    thisWeek: 0,
    inProgress: 0,
    total: 0,
    completionRate: 0,
    byStatus: {},
  }
  const events = eventsResult.data ?? []
  const agents = (agentsResult.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    squad: a.squad,
    avatar_url: a.avatar_url,
    status: a.status,
  }))

  return (
    <TasksBoard
      tasks={tasks as Parameters<typeof TasksBoard>[0]["tasks"]}
      stats={stats}
      agents={agents}
      events={events}
      orgId={orgId}
    />
  )
}

function MyTasksSkeleton() {
  return (
    <div className="flex flex-col flex-1 animate-pulse p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-32 bg-accent rounded-lg" />
        <div className="h-8 w-24 bg-accent/60 rounded-lg" />
        <div className="h-8 w-20 bg-accent/60 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-accent/40 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function MissionControlSkeleton() {
  return (
    <div className="flex flex-col flex-1 animate-pulse">
      <div className="h-14 border-b border-border px-4 flex items-center gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-baseline gap-2">
            <div className="h-7 w-10 bg-accent rounded" />
            <div className="h-3 w-16 bg-accent/60 rounded" />
          </div>
        ))}
      </div>
      <div className="h-12 border-b border-border px-4 flex items-center gap-3">
        <div className="h-8 w-24 bg-accent rounded-lg" />
        <div className="h-8 w-16 bg-accent/60 rounded-lg" />
        <div className="h-8 w-20 bg-accent/60 rounded-lg" />
      </div>
      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-muted h-64" />
          ))}
        </div>
      </div>
    </div>
  )
}
