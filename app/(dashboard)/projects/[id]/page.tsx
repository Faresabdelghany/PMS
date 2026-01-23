import { notFound } from "next/navigation"
import { ProjectDetailsPage } from "@/components/projects/ProjectDetailsPage"
import { getProjectWithDetails } from "@/lib/actions/projects"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  // Fetch project with full details from Supabase
  const result = await getProjectWithDetails(id)

  if (result.error || !result.data) {
    notFound()
  }

  return <ProjectDetailsPage projectId={id} supabaseProject={result.data} />
}
