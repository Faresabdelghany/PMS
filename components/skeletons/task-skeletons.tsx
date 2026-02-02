import { Card } from "@/components/ui/card"
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
 * Kanban card skeleton
 */
export function KanbanCardSkeleton() {
  return (
    <Card className="p-3">
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-3 w-3/4 mb-3" />
      <div className="flex items-center gap-2">
        <SkeletonAvatar size="sm" />
        <SkeletonBadge />
      </div>
    </Card>
  )
}

/**
 * Kanban column skeleton
 */
export function KanbanColumnSkeleton() {
  return (
    <div className="w-72 flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <KanbanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * Kanban board skeleton
 */
export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <KanbanColumnSkeleton key={i} />
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
