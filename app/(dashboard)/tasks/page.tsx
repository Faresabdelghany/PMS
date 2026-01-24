import { redirect } from "next/navigation"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getMyTasks, type TaskWithRelations } from "@/lib/actions/tasks"
import { getProjects } from "@/lib/actions/projects"

export default async function Page() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch user's tasks across all projects in the organization
  const tasksResult = await getMyTasks(organization.id)
  const tasks = tasksResult.data ?? []

  // Fetch projects for context (project names, etc.)
  const projectsResult = await getProjects(organization.id)
  const projects = projectsResult.data ?? []

  return (
    <MyTasksPage
      initialTasks={tasks}
      projects={projects}
      organizationId={organization.id}
    />
  )
}
