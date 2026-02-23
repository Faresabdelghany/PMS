import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getOrgTasks, getOrgTaskStats } from "@/lib/actions/tasks-sprint3"
import { getAgentEvents } from "@/lib/actions/agent-events"
import { getAgents } from "@/lib/actions/agents"
import { PageHeader } from "@/components/ui/page-header"
import { TasksBoard } from "@/components/tasks/TasksBoard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = {
  title: "Tasks — Mission Control",
  description: "Manage all tasks and dispatch them to AI agents in real-time.",
}

// Revalidate every 30s (Realtime will handle live updates client-side)
export const revalidate = 30

export default async function TasksMissionControlPage() {
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader
        title="Mission Control"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks/new">
              <Plus size={14} weight="bold" className="mr-1.5" />
              New Task
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<MissionControlSkeleton />}>
        <MissionControlData orgId={orgId} />
      </Suspense>
    </div>
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

function MissionControlSkeleton() {
  return (
    <div className="flex flex-col flex-1 animate-pulse">
      {/* Stats bar skeleton */}
      <div className="h-14 border-b border-border px-4 flex items-center gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-baseline gap-2">
            <div className="h-7 w-10 bg-accent rounded" />
            <div className="h-3 w-16 bg-accent/60 rounded" />
          </div>
        ))}
      </div>
      {/* Filter bar skeleton */}
      <div className="h-12 border-b border-border px-4 flex items-center gap-3">
        <div className="h-8 w-24 bg-accent rounded-lg" />
        <div className="h-8 w-16 bg-accent/60 rounded-lg" />
        <div className="h-8 w-20 bg-accent/60 rounded-lg" />
      </div>
      {/* Board skeleton */}
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
