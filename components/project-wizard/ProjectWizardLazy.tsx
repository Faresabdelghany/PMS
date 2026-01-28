"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

function WizardLoadingState() {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-[600px] mx-4">
        <Skeleton className="w-full h-[400px] rounded-xl" />
      </div>
    </div>
  )
}

export const ProjectWizardLazy = dynamic(
  () => import("./ProjectWizard").then((mod) => ({ default: mod.ProjectWizard })),
  {
    loading: () => <WizardLoadingState />,
    ssr: false,
  }
)
