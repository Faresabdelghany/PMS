"use client"

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface LoadMoreButtonProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
}

export function LoadMoreButton({ hasMore, isLoading, onLoadMore }: LoadMoreButtonProps) {
  if (!hasMore) return null

  return (
    <div className="flex justify-center py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          "Load More"
        )}
      </Button>
    </div>
  )
}
