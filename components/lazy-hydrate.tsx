"use client"

import React, { useRef, useState, useEffect, lazy, Suspense, type ReactNode, type ComponentType } from "react"

interface LazyHydrateWrapperProps {
  children: ReactNode
}

/**
 * Simple pass-through wrapper for marking below-fold content.
 * For actual lazy hydration, use createLazyHydratedComponent() instead.
 */
export function LazyHydrateWrapper({ children }: LazyHydrateWrapperProps) {
  return <>{children}</>
}

/**
 * Create a lazy-hydrated version of a component using IntersectionObserver.
 *
 * Defers JavaScript loading and hydration until the component is near the viewport,
 * reducing Total Blocking Time (TBT).
 */
export function createLazyHydratedComponent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importFn: () => Promise<{ default: ComponentType<any> }>,
  options?: {
    rootMargin?: string
    wrapperElement?: "div" | "section" | "article" | "aside" | "main" | "span"
    LoadingComponent?: ComponentType
  }
) {
  const LazyComponent = lazy(importFn)
  const Wrapper = (options?.wrapperElement ?? "div") as React.ElementType
  const rootMargin = options?.rootMargin ?? "200px"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function LazyHydrated(props: any) {
    const ref = useRef<HTMLElement>(null)
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
        { rootMargin }
      )
      observer.observe(el)
      return () => observer.disconnect()
    }, [])

    return (
      <Wrapper ref={ref as any}>
        {visible ? (
          <Suspense fallback={options?.LoadingComponent ? <options.LoadingComponent /> : null}>
            <LazyComponent {...props} />
          </Suspense>
        ) : (
          options?.LoadingComponent ? <options.LoadingComponent /> : null
        )}
      </Wrapper>
    )
  }
}

// Lazy-hydrated below-fold components for ProjectDetailsPage
// These defer JavaScript hydration until the component is near the viewport

export const LazyOutcomesList = createLazyHydratedComponent(
  () => import("@/components/projects/OutcomesList").then(m => ({ default: m.OutcomesList })),
  { rootMargin: "200px" }
)

export const LazyKeyFeaturesColumns = createLazyHydratedComponent(
  () => import("@/components/projects/KeyFeaturesColumns").then(m => ({ default: m.KeyFeaturesColumns })),
  { rootMargin: "200px" }
)

export const LazyTimelineGantt = createLazyHydratedComponent(
  () => import("@/components/projects/TimelineGantt").then(m => ({ default: m.TimelineGantt })),
  { rootMargin: "200px" }
)

export const LazyRightMetaPanel = createLazyHydratedComponent(
  () => import("@/components/projects/RightMetaPanel").then(m => ({ default: m.RightMetaPanel })),
  { rootMargin: "100px" }
)
