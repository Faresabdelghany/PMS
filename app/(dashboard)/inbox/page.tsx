import type { Metadata } from "next"
import { Suspense } from "react"
import { InboxContent } from "@/components/inbox/InboxContent"
import { InboxPageSkeleton } from "@/components/skeletons"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedInboxItems, getCachedUnreadCount } from "@/lib/server-cache"

export const metadata: Metadata = {
  title: "Inbox - PMS",
}

export default async function Page() {
  const { orgId } = await getPageOrganization()

  // Start promises WITHOUT awaiting — Suspense streams data in
  const inboxPromise = getCachedInboxItems()
  const unreadPromise = getCachedUnreadCount()

  return (
    <Suspense fallback={<InboxPageSkeleton />}>
      <InboxStreamed
        inboxPromise={inboxPromise}
        unreadPromise={unreadPromise}
        organizationId={orgId}
      />
    </Suspense>
  )
}

async function InboxStreamed({
  inboxPromise,
  unreadPromise,
  organizationId,
}: {
  inboxPromise: ReturnType<typeof getCachedInboxItems>
  unreadPromise: ReturnType<typeof getCachedUnreadCount>
  organizationId: string
}) {
  const [inboxResult, unreadResult] = await Promise.all([inboxPromise, unreadPromise])

  const items = inboxResult.data ?? []
  const unreadCount = unreadResult.data ?? 0

  return (
    <InboxContent
      initialItems={items}
      initialHasMore={inboxResult.hasMore ?? false}
      initialCursor={inboxResult.nextCursor ?? null}
      initialUnreadCount={unreadCount}
      organizationId={organizationId}
    />
  )
}
