import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { getProject } from "@/lib/actions/projects"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Fetch project from Supabase
  const result = await getProject(id)

  if (result.error || !result.data) {
    notFound()
  }

  return <ProjectDetailsPage projectId={id} supabaseProject={result.data} />
}
