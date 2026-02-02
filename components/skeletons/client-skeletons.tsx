import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Skeleton,
  SkeletonAvatar,
} from "@/components/ui/skeleton"
import { ProjectCardSkeleton } from "./dashboard-skeletons"

/**
 * Client card skeleton
 */
export function ClientCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="lg" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Clients list skeleton
 */
export function ClientsListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <ClientCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Client header skeleton
 */
export function ClientHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

/**
 * Client info sidebar skeleton
 */
export function ClientInfoSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Client details page skeleton
 */
export function ClientDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <ClientHeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ClientInfoSkeleton />
        <div className="lg:col-span-2">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Client projects section skeleton
 */
export function ClientProjectsSkeleton() {
  return (
    <div>
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
