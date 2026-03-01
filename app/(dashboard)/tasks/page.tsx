import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getProjects } from "@/lib/actions/projects"
import { getAllTasks, getMyTasks } from "@/lib/actions/tasks"
import { getAgents } from "@/lib/actions/agents"
import { getCachedOrganizationMembers, getCachedTags } from "@/lib/server-cache"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"

export const metadata: Metadata = {
  title: "Tasks — PMS",
}

export const revalidate = 30

type TasksView = "my" | "all"

function parseTasksView(value: string | string[] | undefined): TasksView {
  if (Array.isArray(value)) return value[0] === "all" ? "all" : "my"
  return value === "all" ? "all" : "my"
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgId, user } = await getPageOrganization()
  const resolvedParams = searchParams ? await searchParams : undefined
  const view = parseTasksView(resolvedParams?.view)

  return (
    <Suspense fallback={<MyTasksSkeleton />}>
      <MyTasksData orgId={orgId} userId={user.id} view={view} />
    </Suspense>
  )
}

async function MyTasksData({ orgId, userId, view }: { orgId: string; userId: string; view: TasksView }) {
  const [tasksResult, projectsResult, membersResult, agentsResult, tagsResult] = await Promise.all([
    view === "all" ? getAllTasks(orgId) : getMyTasks(orgId),
    getProjects(orgId),
    getCachedOrganizationMembers(orgId),
    getAgents(orgId),
    getCachedTags(orgId),
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
  const members = membersResult.data ?? []
  const agents = (agentsResult.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    squad: a.squad,
    status: a.status,
    avatar_url: a.avatar_url,
  }))
  const tags = tagsResult.data ?? []

  return (
    <MyTasksPage
      key={view}
      initialTasks={tasks}
      initialHasMore={hasMore}
      initialCursor={nextCursor}
      initialView={view}
      projects={projects}
      organizationId={orgId}
      userId={userId}
      organizationMembers={members}
      agents={agents}
      organizationTags={tags}
    />
  )
}

function MyTasksSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0 animate-pulse p-4 space-y-4">
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
