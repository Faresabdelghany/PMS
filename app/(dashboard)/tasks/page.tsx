import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getProjects } from "@/lib/actions/projects"
import { getMyTasks } from "@/lib/actions/tasks"
import { PageHeader } from "@/components/ui/page-header"
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
      <div className="flex-1 min-h-0">
        <Suspense fallback={<MyTasksSkeleton />}>
          <MyTasksData orgId={orgId} userId={user.id} />
        </Suspense>
      </div>
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
