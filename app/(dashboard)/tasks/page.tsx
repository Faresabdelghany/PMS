import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { cachedGetUser, cachedGetUserOrganizations, cachedGetOrganizationMembers, cachedGetProjects, cachedGetMyTasks, cachedGetTags } from "@/lib/request-cache"
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

  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const orgId = orgsResult.data[0].id

  // Fetch all data in parallel (these are specific to this page)
  const [tasksResult, projectsResult, membersResult, tagsResult] = await Promise.all([
    cachedGetMyTasks(orgId),
    cachedGetProjects(orgId),
    cachedGetOrganizationMembers(orgId),
    cachedGetTags(orgId),
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
      userId={user.id}
      organizationMembers={members}
      organizationTags={tags}
    />
  )
}
