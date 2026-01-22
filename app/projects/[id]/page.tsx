import { notFound, redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getProject } from "@/lib/actions/projects"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getClients } from "@/lib/actions/clients"
import { getTasks } from "@/lib/actions/tasks"
import { getWorkstreams } from "@/lib/actions/workstreams"
import { getProjectFiles } from "@/lib/actions/files"
import { getProjectNotes } from "@/lib/actions/notes"
import { getUserWithProfile } from "@/lib/actions/auth"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Get user's organizations and profile
  const [orgsResult, userResult] = await Promise.all([
    getUserOrganizations(),
    getUserWithProfile(),
  ])

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }
  const organization = orgsResult.data[0]

  // Fetch project
  const projectResult = await getProject(id)
  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  // Fetch related data (including files and notes)
  const [clientsResult, tasksResult, workstreamsResult, filesResult, notesResult] = await Promise.all([
    getClients(organization.id),
    getTasks(id),
    getWorkstreams(id),
    getProjectFiles(id),
    getProjectNotes(id),
  ])

  // Build current user for file uploads
  const currentUser = userResult?.profile
    ? {
        id: userResult.profile.id,
        name: userResult.profile.full_name || userResult.profile.email.split("@")[0],
        avatarUrl: userResult.profile.avatar_url || undefined,
      }
    : undefined

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ProjectDetailsPage
          project={projectResult.data}
          clients={clientsResult.data ?? []}
          tasks={tasksResult.data ?? []}
          workstreams={workstreamsResult.data ?? []}
          files={filesResult.data ?? []}
          notes={notesResult.data ?? []}
          organizationId={organization.id}
          currentUser={currentUser}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
