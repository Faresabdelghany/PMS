import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { CommunicationsPageClient } from "@/components/communications/communications-page-client"

export const metadata: Metadata = { title: "Agent Chat - PMS" }

export default async function CommunicationsPage() {
  const { orgId, user } = await getPageOrganization()
  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader title="Agent Chat" />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Suspense fallback={<PageSkeleton />}>
          <CommunicationsPageClient orgId={orgId} userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}
