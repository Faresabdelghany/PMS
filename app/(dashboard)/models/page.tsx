import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { getPageOrganization } from "@/lib/page-auth"
import { getAgentModels } from "@/lib/actions/models"
import { ModelsContent } from "@/components/models/models-content"

export const metadata: Metadata = {
  title: "Models - PMS",
}

export default async function Page() {
  const { orgId } = await getPageOrganization()
  const modelsPromise = getAgentModels(orgId)

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Models" />
      <Suspense fallback={<PageSkeleton />}>
        <ModelsStreamed modelsPromise={modelsPromise} />
      </Suspense>
    </div>
  )
}

async function ModelsStreamed({
  modelsPromise,
}: {
  modelsPromise: Promise<Awaited<ReturnType<typeof getAgentModels>>>
}) {
  const result = await modelsPromise
  if (result.error) {
    return <div className="p-4 text-destructive">{result.error}</div>
  }
  return <ModelsContent agents={result.data ?? []} />
}
