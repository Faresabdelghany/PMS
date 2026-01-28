import { redirect } from "next/navigation"
import { InboxContent } from "@/components/inbox/InboxContent"
import { cachedGetUserOrganizations } from "@/lib/request-cache"
import { getInboxItems, getUnreadCount } from "@/lib/actions/inbox"

export default async function Page() {
  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const organization = orgsResult.data[0]

  // Fetch inbox data in parallel
  const [inboxResult, unreadResult] = await Promise.all([
    getInboxItems(),
    getUnreadCount(),
  ])

  const items = inboxResult.data ?? []
  const unreadCount = unreadResult.data ?? 0

  return (
    <InboxContent
      initialItems={items}
      initialUnreadCount={unreadCount}
      organizationId={organization.id}
    />
  )
}
