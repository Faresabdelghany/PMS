"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy-loaded AI chat input to reduce initial bundle size
// Only loads when the chat sheet is opened and AI is configured
// Savings: ~15-30KB (file handling, attachment logic)

function AIChatInputSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <Skeleton className="h-8 w-16 rounded" />
      </div>
    </div>
  )
}

export const AIChatInputLazy = dynamic(
  () => import("./ai-chat-input").then((mod) => ({ default: mod.AIChatInput })),
  {
    ssr: false,
    loading: () => <AIChatInputSkeleton />,
  }
)
