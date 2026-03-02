import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { SessionsPageClient } from "@/components/sessions/sessions-page-client"

export const metadata: Metadata = {
  title: "Sessions - PMS",
}

export default async function SessionsPage() {
  const { orgId } = await getPageOrganization()

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <Suspense fallback={<PageSkeleton />}>
        <SessionsPageClient orgId={orgId} />
      </Suspense>
    </div>
  )
}
