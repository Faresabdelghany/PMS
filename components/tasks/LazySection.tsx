"use client"

import { useRef, useState, useEffect, type ReactNode } from "react"

/**
 * Defers rendering of children until the placeholder scrolls near the viewport.
 * Uses IntersectionObserver with a generous rootMargin so content is ready
 * before the user reaches it. Once mounted, stays mounted (no unmount on scroll-away).
 *
 * Used to reduce initial DOM node count for below-the-fold task sections.
 */
export function LazySection({
  children,
  estimatedHeight = 220,
}: {
  children: ReactNode
  /** Height of the placeholder in px — should match the approximate section height */
  estimatedHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px 0px" } // Start loading 200px before entering viewport
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (visible) return <>{children}</>

  return (
    <div
      ref={ref}
      className="max-w-6xl mx-auto rounded-3xl border border-border bg-muted/50 p-3"
      style={{ height: estimatedHeight }}
      aria-hidden
    />
  )
}
