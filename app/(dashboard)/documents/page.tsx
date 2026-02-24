import type { Metadata } from "next"
import { Suspense } from "react"
import { getPageOrganization } from "@/lib/page-auth"
import { getOrgDocuments, getTasksForSelector } from "@/lib/actions/agent-documents"
import { DocumentsContent } from "@/components/documents/DocumentsContent"

export const metadata: Metadata = {
  title: "Documents - PMS",
}

async function DocumentsList({ orgId }: { orgId: string }) {
  const [docsResult, tasksResult] = await Promise.all([
    getOrgDocuments(orgId),
    getTasksForSelector(orgId),
  ])

  return (
    <DocumentsContent
      initialDocuments={docsResult.data ?? []}
      tasks={tasksResult.data ?? []}
      organizationId={orgId}
    />
  )
}

export default async function Page() {
  const { orgId } = await getPageOrganization()

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading documents…</p>
        </div>
      }
    >
      <DocumentsList orgId={orgId} />
    </Suspense>
  )
}
