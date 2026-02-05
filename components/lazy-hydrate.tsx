"use client"

import { lazyHydrate } from "next-lazy-hydration-on-scroll"
import type { ReactNode, ComponentType } from "react"

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
 * Create a lazy-hydrated version of a component using next-lazy-hydration-on-scroll.
 *
 * This HOC defers JavaScript hydration until the component is near the viewport,
 * reducing Total Blocking Time (TBT) by up to 70%.
 *
 * @example
 * ```tsx
 * // Create lazy version at module level:
 * const LazyChart = createLazyHydratedComponent(
 *   () => import('./Chart'),
 *   { rootMargin: '200px' }
 * )
 *
 * // Usage in component:
 * <LazyChart data={data} />
 * ```
 */
export function createLazyHydratedComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>,
  options?: {
    rootMargin?: string
    wrapperElement?: "div" | "section" | "article" | "aside" | "main" | "span"
    LoadingComponent?: ComponentType
  }
) {
  return lazyHydrate(importFn, {
    rootMargin: options?.rootMargin ?? "200px",
    wrapperElement: options?.wrapperElement ?? "div",
    LoadingComponent: options?.LoadingComponent,
  })
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
