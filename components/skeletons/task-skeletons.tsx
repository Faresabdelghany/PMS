import {
  Skeleton,
  SkeletonAvatar,
  SkeletonBadge,
} from "@/components/ui/skeleton"

/**
 * Single task row skeleton
 */
export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1">
        <Skeleton className="h-4 w-64" />
      </div>
      <SkeletonBadge />
      <SkeletonAvatar size="sm" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

/**
 * Task list skeleton
 */
export function TaskListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="border rounded-lg">
      {Array.from({ length: count }).map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * My tasks page skeleton
 */
export function MyTasksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <TaskListSkeleton count={10} />
    </div>
  )
}

/**
 * Task detail skeleton
 */
export function TaskDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <div className="flex gap-2">
        <SkeletonBadge />
        <SkeletonBadge />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex items-center gap-2">
        <SkeletonAvatar size="sm" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
