import { redirect } from "next/navigation"
import { InboxContent } from "@/components/inbox/InboxContent"
import { getUserOrganizations } from "@/lib/actions/organizations"
import { getInboxItems, getUnreadCount } from "@/lib/actions/inbox"

export default async function Page() {
  // Get user's organizations
  const orgsResult = await getUserOrganizations()

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
