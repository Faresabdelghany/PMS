import { Skeleton, SkeletonAvatar } from "@/components/ui/skeleton"

/**
 * Inbox item skeleton
 */
export function InboxItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b last:border-b-0">
      <Skeleton className="h-2 w-2 rounded-full mt-2" />
      <SkeletonAvatar size="sm" />
      <div className="flex-1">
        <Skeleton className="h-4 w-full max-w-md mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

/**
 * Inbox list skeleton
 */
export function InboxListSkeleton() {
  return (
    <div className="border rounded-lg">
      {Array.from({ length: 8 }).map((_, i) => (
        <InboxItemSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Unread count skeleton (small badge)
 */
export function UnreadCountSkeleton() {
  return <Skeleton className="h-5 w-5 rounded-full" />
}

/**
 * Inbox page skeleton
 */
export function InboxPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <InboxListSkeleton />
    </div>
  )
}
