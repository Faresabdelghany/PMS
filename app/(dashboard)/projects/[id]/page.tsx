import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { getProject } from "@/lib/actions/projects"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Fetch project from Supabase
  const result = await getProject(id)
  const project = result.data

  return <ProjectDetailsPage projectId={id} supabaseProject={project} />
}
