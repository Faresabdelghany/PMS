import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { ModelsPageClient } from "@/components/models/models-page-client"

export const metadata: Metadata = {
  title: "Models - PMS",
}

export default async function ModelsPage() {
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Models" />
      <div className="p-6 flex flex-col gap-6">
        <Suspense fallback={<PageSkeleton />}>
          <ModelsPageClient orgId={orgId} />
        </Suspense>
      </div>
    </div>
  )
}
