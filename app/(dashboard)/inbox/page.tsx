import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { InboxContent } from "@/components/inbox/InboxContent"
import { InboxPageSkeleton } from "@/components/skeletons"
import { getCachedInboxItems, getCachedUnreadCount, getCachedActiveOrgFromKV } from "@/lib/server-cache"

export const metadata: Metadata = {
  title: "Inbox - PMS",
}

export default async function Page() {
  // Use KV-cached org - instant hit from layout's cache warming (~5ms)
  const org = await getCachedActiveOrgFromKV()

  if (!org) {
    redirect("/onboarding")
  }

  // Start promises WITHOUT awaiting — Suspense streams data in
  const inboxPromise = getCachedInboxItems()
  const unreadPromise = getCachedUnreadCount()

  return (
    <Suspense fallback={<InboxPageSkeleton />}>
      <InboxStreamed
        inboxPromise={inboxPromise}
        unreadPromise={unreadPromise}
        organizationId={org.id}
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
      initialUnreadCount={unreadCount}
      organizationId={organizationId}
    />
  )
}
