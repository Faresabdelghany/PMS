import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-full">
      {/* History sidebar skeleton */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border p-4">
        <Skeleton className="h-9 w-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>

      {/* Main chat area skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md lg:hidden" />
          <Skeleton className="h-5 w-32" />
        </div>

        {/* Empty chat state */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Skeleton className="h-12 w-12 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
