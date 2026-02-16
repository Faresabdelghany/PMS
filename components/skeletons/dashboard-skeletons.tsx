import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
} from "@/components/ui/skeleton"

/**
 * Stat card skeleton (for dashboard counts)
 */
export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

/**
 * Project card skeleton
 */
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background p-4" style={{ minHeight: 200 }}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-5 rounded" />
        <SkeletonBadge />
      </div>
      <div className="mt-3">
        <Skeleton className="h-5 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-4 border-t border-border/60" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-2 w-24 rounded-full" />
        <SkeletonAvatar size="sm" />
      </div>
    </div>
  )
}

/**
 * Projects list skeleton (shows 8 cards in grid matching ProjectCardsView layout)
 */
export function ProjectsListSkeleton() {
  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * Recent activity skeleton
 */
export function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonAvatar size="sm" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full max-w-xs" />
              <Skeleton className="h-3 w-20 mt-1" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Dashboard header skeleton
 */
export function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  )
}
