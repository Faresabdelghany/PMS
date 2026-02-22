import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded-md bg-muted animate-pulse mt-2" />
      </div>
      <PageSkeleton />
    </div>
  )
}
