import {
  Skeleton,
  SkeletonAvatar,
  SkeletonBadge,
} from "@/components/ui/skeleton"

/**
 * Single task row skeleton — matches TaskRowBase layout
 */
export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-48 sm:w-64" />
      </div>
      <span className="hidden sm:block"><SkeletonBadge /></span>
      <span className="hidden sm:block"><SkeletonAvatar size="sm" /></span>
      <Skeleton className="h-4 w-16 hidden sm:block" />
      <Skeleton className="h-7 w-7 rounded-md" />
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
 * Project task section skeleton — matches ProjectTasksSection layout
 */
function ProjectTasksSectionSkeleton({ taskCount = 4 }: { taskCount?: number }) {
  return (
    <section className="max-w-6xl mx-auto rounded-3xl border border-border bg-muted shadow-[var(--shadow-workstream)] p-3 space-y-2">
      {/* Header — matches ProjectTasksSection header */}
      <header className="flex items-center justify-between gap-4 px-0 py-1">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16 hidden sm:block" />
            <Skeleton className="h-3 w-24 hidden sm:block" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="size-[18px] rounded-full" />
          <div className="h-4 w-px bg-border/80" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </header>
      {/* Task rows */}
      <div className="space-y-1 px-2 py-3 bg-background rounded-2xl border border-border">
        {Array.from({ length: taskCount }).map((_, i) => (
          <TaskRowSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}

/**
 * My tasks page skeleton — matches the full MyTasksPage layout to prevent CLS.
 * Mirrors: header bar, filter/view sub-header, and project task sections.
 */
export function MyTasksSkeleton() {
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      {/* Header bar — matches MyTasksPage header */}
      <header className="flex flex-col border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        {/* Filter + view options sub-header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      </header>
      {/* Task sections content */}
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
        <ProjectTasksSectionSkeleton taskCount={4} />
        <ProjectTasksSectionSkeleton taskCount={3} />
      </div>
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
