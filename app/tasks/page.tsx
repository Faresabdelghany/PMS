import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { MyTasksPage } from "@/components/tasks/MyTasksPage"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getMyTasks } from "@/lib/actions/tasks"
import { getProjects } from "@/lib/actions/projects"
import { getWorkstreams } from "@/lib/actions/workstreams"

export default async function TasksPage() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()
  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }
  const organization = orgsResult.data[0]

  // Fetch my tasks and projects in parallel
  const [tasksResult, projectsResult] = await Promise.all([
    getMyTasks(organization.id),
    getProjects(organization.id),
  ])

  // Fetch workstreams for all projects that have tasks
  const projectIdsWithTasks = new Set(
    (tasksResult.data || []).map((t) => t.project_id)
  )
  const workstreamsByProject: Record<string, { id: string; name: string }[]> = {}

  await Promise.all(
    Array.from(projectIdsWithTasks).map(async (projectId) => {
      const wsResult = await getWorkstreams(projectId)
      if (wsResult.data) {
        workstreamsByProject[projectId] = wsResult.data.map((ws) => ({
          id: ws.id,
          name: ws.name,
        }))
      }
    })
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <MyTasksPage
          tasks={tasksResult.data ?? []}
          projects={projectsResult.data ?? []}
          workstreamsByProject={workstreamsByProject}
          organizationId={organization.id}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
