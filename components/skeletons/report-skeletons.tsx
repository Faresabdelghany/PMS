import { Skeleton } from "@/components/ui/skeleton"

export function ReportListItemSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-64" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

export function ReportsListSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <ReportListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function ReportDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-96" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      {/* Portfolio Summary */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Project sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-lg border p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}
