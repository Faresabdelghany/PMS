"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

function ModalLoadingState() {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-[500px] mx-4">
        <Skeleton className="w-full h-[350px] rounded-xl" />
      </div>
    </div>
  )
}

export const TaskQuickCreateModalLazy = dynamic(
  () => import("./TaskQuickCreateModal").then((mod) => ({ default: mod.TaskQuickCreateModal })),
  {
    loading: () => <ModalLoadingState />,
    ssr: false,
  }
)

// Re-export types for convenience
export type { TaskData, CreateTaskContext } from "./TaskQuickCreateModal"
