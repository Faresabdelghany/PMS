import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
} from "@/components/ui/skeleton"
import { TaskRowSkeleton } from "./task-skeletons"

/**
 * Project header skeleton
 */
export function ProjectHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-2">
        <SkeletonBadge />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  )
}

/**
 * Project stats bar skeleton
 */
export function ProjectStatsSkeleton() {
  return (
    <div className="flex gap-6 p-4 bg-muted/50 rounded-lg">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="text-center">
          <Skeleton className="h-8 w-12 mx-auto mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/**
 * Project members skeleton
 */
export function ProjectMembersSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <SkeletonAvatar size="sm" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
              </div>
              <SkeletonBadge />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Workstream skeleton
 */
export function WorkstreamSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-8" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <TaskRowSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Workstreams list skeleton
 */
export function WorkstreamsListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <WorkstreamSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Project files skeleton
 */
export function ProjectFilesSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-16" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-3">
              <Skeleton className="h-10 w-10 mx-auto mb-2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-16 mt-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Project notes skeleton
 */
export function ProjectNotesSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-16" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 border rounded-lg">
            <Skeleton className="h-4 w-48 mb-2" />
            <SkeletonText lines={2} />
            <Skeleton className="h-3 w-24 mt-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Project details page skeleton
 */
export function ProjectDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <ProjectHeaderSkeleton />
      <ProjectStatsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <WorkstreamsListSkeleton />
        </div>
        <div className="space-y-6">
          <ProjectMembersSkeleton />
          <ProjectFilesSkeleton />
          <ProjectNotesSkeleton />
        </div>
      </div>
    </div>
  )
}
