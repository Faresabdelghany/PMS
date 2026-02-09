import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Chart container skeleton
 */
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </CardContent>
    </Card>
  )
}

/**
 * Performance stat card skeleton
 */
export function PerformanceStatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

/**
 * Charts-only skeleton (used when header + stat cards are already rendered)
 */
export function ChartsSkeleton() {
  return (
    <>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <ChartSkeleton height={300} />
        <ChartSkeleton height={300} />
      </div>
      <ChartSkeleton height={350} />
    </>
  )
}

/**
 * Full performance page skeleton
 */
export function PerformancePageSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-6 space-y-6">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Stat cards row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <PerformanceStatCardSkeleton />
        <PerformanceStatCardSkeleton />
        <PerformanceStatCardSkeleton />
        <PerformanceStatCardSkeleton />
      </div>

      {/* Charts section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <ChartSkeleton height={300} />
        <ChartSkeleton height={300} />
      </div>

      {/* Team productivity chart */}
      <ChartSkeleton height={350} />
    </div>
  )
}
