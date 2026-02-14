import type { Metadata } from "next"
import { Suspense } from "react"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { MyTasksSkeleton } from "@/components/skeletons"
import { getPageOrganization } from "@/lib/page-auth"
import {
  getCachedOrganizationMembers,
  getCachedProjects,
  getCachedMyTasks,
  getCachedTags,
} from "@/lib/server-cache"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { ProjectWithRelations } from "@/lib/actions/projects"

export const metadata: Metadata = {
  title: "My Tasks - PMS",
}

export default async function Page() {
  const { user, orgId } = await getPageOrganization()

  // Start ALL 4 data promises WITHOUT awaiting — Suspense streams data in
  const tasksPromise = getCachedMyTasks(orgId)
  const projectsPromise = getCachedProjects(orgId)
  const membersPromise = getCachedOrganizationMembers(orgId)
  const tagsPromise = getCachedTags(orgId)

  return (
    <Suspense fallback={<MyTasksSkeleton />}>
      <TasksStreamed
        tasksPromise={tasksPromise}
        projectsPromise={projectsPromise}
        membersPromise={membersPromise}
        tagsPromise={tagsPromise}
        orgId={orgId}
        userId={user.id}
      />
    </Suspense>
  )
}

async function TasksStreamed({
  tasksPromise,
  projectsPromise,
  membersPromise,
  tagsPromise,
  orgId,
  userId,
}: {
  tasksPromise: ReturnType<typeof getCachedMyTasks>
  projectsPromise: ReturnType<typeof getCachedProjects>
  membersPromise: ReturnType<typeof getCachedOrganizationMembers>
  tagsPromise: ReturnType<typeof getCachedTags>
  orgId: string
  userId: string
}) {
  const [tasksResult, projectsResult, membersResult, tagsResult] = await Promise.all([
    tasksPromise,
    projectsPromise,
    membersPromise,
    tagsPromise,
  ])

  // Map to minimal shapes to reduce RSC serialization payload
  const members = (membersResult.data || []).map(m => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    profile: {
      id: m.profile?.id ?? "",
      full_name: m.profile?.full_name ?? null,
      email: m.profile?.email ?? "",
      avatar_url: m.profile?.avatar_url ?? null,
    },
  }))

  const tags = (tagsResult.data || []).map(t => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }))

  return (
    <MyTasksPage
      initialTasks={(tasksResult.data || []) as TaskWithRelations[]}
      initialHasMore={tasksResult.hasMore ?? false}
      initialCursor={tasksResult.nextCursor ?? null}
      projects={(projectsResult.data || []) as ProjectWithRelations[]}
      organizationId={orgId}
      userId={userId}
      organizationMembers={members}
      organizationTags={tags}
    />
  )
}
