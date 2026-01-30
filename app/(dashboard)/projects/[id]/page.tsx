import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { getProjectWithDetails } from "@/lib/actions/projects"
import { getTasks } from "@/lib/actions/tasks"
import { getWorkstreamsWithTasks } from "@/lib/actions/workstreams"
import { getClients } from "@/lib/actions/clients"
import { getOrganizationMembers } from "@/lib/actions/organizations"
import { getTags } from "@/lib/actions/tags"
import { getProjectNotes } from "@/lib/actions/notes"
import { getProjectFiles } from "@/lib/actions/files"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Start all project-id-dependent queries in parallel immediately
  // This eliminates the waterfall where tasks/workstreams waited for project
  const [projectResult, tasksResult, workstreamsResult, notesResult, filesResult] = await Promise.all([
    getProjectWithDetails(id),
    getTasks(id),
    getWorkstreamsWithTasks(id),
    getProjectNotes(id),
    getProjectFiles(id),
  ])

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const organizationId = projectResult.data.organization_id

  // Now fetch org-dependent data (clients, members, tags) in parallel
  const [clientsResult, membersResult, tagsResult] = await Promise.all([
    getClients(organizationId),
    getOrganizationMembers(organizationId),
    getTags(organizationId),
  ])

  // Map clients to the format expected by ProjectWizard
  const clients = (clientsResult.data || []).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  return (
    <ProjectDetailsPage
      projectId={id}
      supabaseProject={projectResult.data}
      tasks={tasksResult.data || []}
      workstreams={workstreamsResult.data || []}
      clients={clients}
      organizationMembers={membersResult.data || []}
      organizationTags={tagsResult.data || []}
      notes={notesResult.data || []}
      files={filesResult.data || []}
    />
  )
}
