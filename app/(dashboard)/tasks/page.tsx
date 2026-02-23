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
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mission Control"
        description="Task board + live agent activity"
        actions={
          <Button asChild size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700">
            <Link href="/tasks/new">
              <Plus size={14} weight="bold" />
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
    <div className="flex-1 min-h-0">
      <TasksBoard
        tasks={tasks as Parameters<typeof TasksBoard>[0]["tasks"]}
        stats={stats}
        agents={agents}
        events={events}
        orgId={orgId}
      />
    </div>
  )
}

function MissionControlSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Stats bar skeleton */}
      <div className="h-14 border-b border-border/40 px-4 flex items-center gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-baseline gap-2">
            <div className="h-7 w-10 bg-accent rounded" />
            <div className="h-3 w-16 bg-accent/60 rounded" />
          </div>
        ))}
      </div>
      {/* Filter bar skeleton */}
      <div className="h-12 border-b border-border/40 px-4 flex items-center gap-3">
        <div className="h-8 w-24 bg-accent rounded-lg" />
        <div className="h-8 w-16 bg-accent/60 rounded-lg" />
        <div className="h-8 w-20 bg-accent/60 rounded-lg" />
      </div>
      {/* Board skeleton */}
      <div className="flex-1 flex gap-3 p-4 overflow-x-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-72 min-w-72 rounded-xl bg-accent/20 border border-border/40 h-64" />
        ))}
        <div className="w-[300px] border-l border-border/40" />
      </div>
    </div>
  )
}
