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
 * Inbox page skeleton - matches InboxContent layout to prevent CLS.
 * Uses the same container structure (mx-2, my-2, border, rounded-lg).
 */
export function InboxPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      {/* Header - matches InboxContent header */}
      <header className="flex flex-col border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>

        {/* Tab bar + search */}
        <div className="flex items-center justify-between px-4 pb-3 pt-3 gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-48 rounded-lg" />
          </div>
        </div>
      </header>

      {/* Inbox items */}
      <div className="flex-1 overflow-auto divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
