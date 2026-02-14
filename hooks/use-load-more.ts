"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { PaginatedResult } from "@/lib/actions/types"

/**
 * Generic hook for cursor-based "Load More" pagination.
 *
 * Usage:
 *   const { items, hasMore, isLoading, loadMore } = useLoadMore({
 *     initialItems: projects,
 *     initialHasMore: true,
 *     initialCursor: "2024-01-01T00:00:00Z",
 *     fetchMore: (cursor) => getProjects(orgId, undefined, cursor),
 *   })
 */
export function useLoadMore<T>({
  initialItems,
  initialHasMore = false,
  initialCursor = null,
  fetchMore,
}: {
  initialItems: T[]
  initialHasMore: boolean
  initialCursor: string | null
  fetchMore: (cursor: string) => Promise<PaginatedResult<T>>
}) {
  const [items, setItems] = useState<T[]>(initialItems)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [isLoading, setIsLoading] = useState(false)
  const loadingRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return

    loadingRef.current = true
    setIsLoading(true)

    try {
      const result = await fetchMore(cursor)

      if (result.error) {
        console.error("Load more failed:", result.error)
        return
      }

      const newItems = result.data ?? []
      setItems((prev) => [...prev, ...newItems])
      setHasMore(result.hasMore ?? false)
      setCursor(result.nextCursor ?? null)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }, [cursor, fetchMore])

  // Auto-reset when server-provided initial data changes (e.g., navigation or filter change)
  const initialItemsRef = useRef(initialItems)
  useEffect(() => {
    if (initialItemsRef.current !== initialItems) {
      initialItemsRef.current = initialItems
      setItems(initialItems)
      setHasMore(initialHasMore)
      setCursor(initialCursor)
    }
  }, [initialItems, initialHasMore, initialCursor])

  // Manual reset (e.g., after refetch)
  const reset = useCallback((newItems: T[], newHasMore: boolean, newCursor: string | null) => {
    setItems(newItems)
    setHasMore(newHasMore)
    setCursor(newCursor)
  }, [])

  return { items, hasMore, isLoading, loadMore, setItems, reset }
}
