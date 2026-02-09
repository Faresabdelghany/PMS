import { Skeleton } from "@/components/ui/skeleton"

interface ChatPageSkeletonProps {
  showMessages?: boolean
}

/**
 * Chat page skeleton that matches the actual ChatPageContent layout.
 * Uses the same container structure (m-2, border, rounded-lg) to prevent CLS.
 */
export function ChatPageSkeleton({ showMessages = false }: ChatPageSkeletonProps) {
  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0 m-2 border border-border rounded-lg overflow-hidden">
      {/* Top Bar - matches ChatPageContent header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-4 border-b border-border">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Split Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop: History Sidebar skeleton */}
        <aside className="hidden md:flex w-72 border-r border-border/60 bg-muted/20 flex-col h-full min-h-0 flex-shrink-0">
          <div className="p-3">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="px-3 pb-2">
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <div className="flex-1 px-2 py-2 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </aside>

        {/* Right: Chat area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Chat header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          {/* Messages or empty state */}
          <div className="flex-1 flex flex-col min-h-0">
            {showMessages ? (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Assistant message */}
                <div className="flex items-start gap-3 max-w-[85%]">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
                {/* User message */}
                <div className="flex justify-end">
                  <Skeleton className="h-10 w-48 rounded-2xl" />
                </div>
                {/* Another assistant message */}
                <div className="flex items-start gap-3 max-w-[85%]">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Skeleton className="h-16 w-16 rounded-2xl mx-auto" />
                  <Skeleton className="h-5 w-48 mx-auto" />
                  <Skeleton className="h-4 w-40 mx-auto" />
                  <div className="flex flex-wrap justify-center gap-2 max-w-md pt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-28 rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-border px-6 py-4">
              <Skeleton className="h-[72px] w-full rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
