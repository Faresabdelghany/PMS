"use client"

import dynamic from "next/dynamic"

// Defer analytics loading until after hydration for better TTI (~15KB deferred)
const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false }
)

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false }
)

/**
 * Wrapper component that lazy-loads Vercel Analytics and Speed Insights
 * after hydration to improve Time to Interactive (TTI).
 */
export function AnalyticsWrapper() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
