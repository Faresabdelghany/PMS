import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-full">
      {/* History sidebar skeleton */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border p-4">
        <Skeleton className="h-9 w-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
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

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Assistant message skeleton */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          {/* User message skeleton */}
          <div className="flex gap-3 justify-end">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48 ml-auto" />
            </div>
          </div>
          {/* Another assistant message */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
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
