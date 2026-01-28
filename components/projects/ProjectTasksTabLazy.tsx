"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Loading skeleton for ProjectTasksTab
function ProjectTasksTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Task list skeleton */}
      <div className="border rounded-lg divide-y">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Lazy-loaded ProjectTasksTab component
// This reduces initial bundle size by ~50-70KB (@dnd-kit)
export const ProjectTasksTabLazy = dynamic(
  () => import("./ProjectTasksTab").then((mod) => ({ default: mod.ProjectTasksTab })),
  {
    loading: () => <ProjectTasksTabSkeleton />,
    ssr: false, // Disable SSR since drag-drop requires client-side rendering
  }
)

// Re-export types for convenience
export type { TaskWithRelations } from "@/lib/actions/tasks"
