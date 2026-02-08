import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cachedGetUserOrganizations } from "@/lib/request-cache"
import { CachedProjectsList } from "@/components/dashboard"
import { ProjectsListSkeleton } from "@/components/skeletons"

export default async function Page() {
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  return (
    <Suspense fallback={<ProjectsListSkeleton />}>
      <CachedProjectsList orgId={organization.id} />
    </Suspense>
  )
}
