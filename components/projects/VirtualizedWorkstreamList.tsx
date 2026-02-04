"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"
import type { ReactNode } from "react"

type VirtualizedWorkstreamListProps = Readonly<{
  items: Array<{ id: string }>
  renderItem: (item: { id: string }, index: number) => ReactNode
  estimateSize?: number
  overscan?: number
}>

/**
 * Virtualized list component for workstreams to improve INP
 * Only renders visible items + overscan buffer
 */
export function VirtualizedWorkstreamList({
  items,
  renderItem,
  estimateSize = 120,
  overscan = 3,
}: VirtualizedWorkstreamListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-300px)] overflow-y-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={items[virtualItem.index].id}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
