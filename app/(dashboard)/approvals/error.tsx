"use client"

import { Button } from "@/components/ui/button"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <h2 className="text-lg font-semibold">Failed to load approvals</h2>
      <p className="text-sm text-muted-foreground">An error occurred while fetching approval requests.</p>
      <Button onClick={reset} variant="outline">Try Again</Button>
    </div>
  )
}
