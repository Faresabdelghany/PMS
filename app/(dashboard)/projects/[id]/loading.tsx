import { ProjectDetailsSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      <div className="flex-1 bg-background px-6 py-4 rounded-b-lg">
        <div className="mx-auto w-full max-w-7xl">
          <ProjectDetailsSkeleton />
        </div>
      </div>
    </div>
  )
}
