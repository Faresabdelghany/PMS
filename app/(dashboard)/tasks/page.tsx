import { redirect } from "next/navigation"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { getUserOrganizations, getOrganizationMembers } from "@/lib/actions/organizations"
import { getMyTasks } from "@/lib/actions/tasks"
import { getProjects } from "@/lib/actions/projects"

export default async function Page() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch data in parallel
  const [tasksResult, projectsResult, membersResult] = await Promise.all([
    getMyTasks(organization.id),
    getProjects(organization.id),
    getOrganizationMembers(organization.id),
  ])

  const tasks = tasksResult.data ?? []
  const projects = projectsResult.data ?? []
  const members = membersResult.data ?? []

  return (
    <MyTasksPage
      initialTasks={tasks}
      projects={projects}
      organizationId={organization.id}
      organizationMembers={members}
    />
  )
}
