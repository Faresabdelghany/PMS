import { redirect } from "next/navigation"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { cachedGetUser, cachedGetUserOrganizations, cachedGetOrganizationMembers, cachedGetProjects, cachedGetMyTasks } from "@/lib/request-cache"
import type { TaskWithRelations } from "@/lib/actions/tasks"
import type { ProjectWithRelations } from "@/lib/actions/projects"

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
  const [tasksResult, projectsResult, membersResult] = await Promise.all([
    cachedGetMyTasks(orgId),
    cachedGetProjects(orgId),
    cachedGetOrganizationMembers(orgId),
  ])

  return (
    <MyTasksPage
      initialTasks={(tasksResult.data || []) as TaskWithRelations[]}
      projects={(projectsResult.data || []) as ProjectWithRelations[]}
      organizationId={orgId}
      organizationMembers={membersResult.data || []}
    />
  )
}
