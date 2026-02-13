import { redirect } from "next/navigation"
import { cachedGetUser } from "./request-cache"
import { getCachedActiveOrgFromKV } from "./server-cache"

/**
 * Standard auth + org resolution for dashboard pages.
 *
 * Returns the authenticated user and their active organization ID.
 * Redirects to /login if not authenticated, /onboarding if no organization.
 *
 * Uses request-level caching (React cache + KV) so multiple calls within
 * the same request are free. The dashboard layout pre-warms the KV cache
 * for org resolution, making this ~5ms on subsequent reads.
 *
 * Usage:
 *   const { user, orgId } = await getPageOrganization()
 */
export async function getPageOrganization() {
  const { user, error } = await cachedGetUser()

  if (error || !user) {
    redirect("/login")
  }

  const org = await getCachedActiveOrgFromKV()

  if (!org) {
    redirect("/onboarding")
  }

  return {
    user: { id: user.id, email: user.email || "" },
    orgId: org.id as string,
  }
}
