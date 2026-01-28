"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Loading skeleton for WorkstreamTab
function WorkstreamTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Workstream items */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>

          {/* Task rows skeleton */}
          <div className="space-y-2 pl-8">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-5 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Lazy-loaded WorkstreamTab component
// This reduces initial bundle size by ~50-70KB (@dnd-kit)
export const WorkstreamTabLazy = dynamic(
  () => import("./WorkstreamTab").then((mod) => ({ default: mod.WorkstreamTab })),
  {
    loading: () => <WorkstreamTabSkeleton />,
    ssr: false, // Disable SSR since drag-drop requires client-side rendering
  }
)

// Re-export props type for convenience
export type { WorkstreamGroup, WorkstreamTask } from "@/lib/data/project-details"
