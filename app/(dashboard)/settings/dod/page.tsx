import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getDoDPolicies, getDoDCheckHistory } from "@/lib/actions/dod-policies"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { DoDSettingsClient } from "./dod-settings-client"

export const metadata: Metadata = {
  title: "Definition of Done - PMS",
}

export default async function DoDSettingsPage() {
  const { orgId } = await getPageOrganization()

  const [policiesResult, historyResult, projectsModule] = await Promise.all([
    getDoDPolicies(orgId),
    getDoDCheckHistory(orgId),
    import("@/lib/actions/projects").then((m) => m.getProjects(orgId)),
  ])

  const policies = policiesResult.data ?? []
  const history = historyResult.data ?? []
  const projects = (projectsModule.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }))

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Definition of Done" />
      <div className="p-6 flex flex-col gap-6">
        <Suspense fallback={<PageSkeleton />}>
          <DoDSettingsClient
            orgId={orgId}
            policies={policies}
            projects={projects}
            history={history}
          />
        </Suspense>
      </div>
    </div>
  )
}
