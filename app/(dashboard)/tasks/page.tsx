import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { MyTasksSkeleton } from "@/components/skeletons"
import { cachedGetUser, cachedGetOrganizationMembers, cachedGetProjects, cachedGetMyTasks, cachedGetTags } from "@/lib/request-cache"
import { getCachedActiveOrgFromKV } from "@/lib/server-cache"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { ProjectWithRelations } from "@/lib/actions/projects"

export const metadata: Metadata = {
  title: "My Tasks - PMS",
}

export default async function Page() {
  // Use cached auth - shared with layout (no duplicate DB hit)
  const { user, error: authError } = await cachedGetUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Use KV-cached org - instant hit from layout's cache warming (~5ms)
  const org = await getCachedActiveOrgFromKV()

  if (!org) {
    redirect("/onboarding")
  }

  const orgId = org.id

  // Start ALL 4 data promises WITHOUT awaiting — Suspense streams data in
  const tasksPromise = cachedGetMyTasks(orgId)
  const projectsPromise = cachedGetProjects(orgId)
  const membersPromise = cachedGetOrganizationMembers(orgId)
  const tagsPromise = cachedGetTags(orgId)

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
  tasksPromise: ReturnType<typeof cachedGetMyTasks>
  projectsPromise: ReturnType<typeof cachedGetProjects>
  membersPromise: ReturnType<typeof cachedGetOrganizationMembers>
  tagsPromise: ReturnType<typeof cachedGetTags>
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
      projects={(projectsResult.data || []) as ProjectWithRelations[]}
      organizationId={orgId}
      userId={userId}
      organizationMembers={members}
      organizationTags={tags}
    />
  )
}
