"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"

// Lazy-loaded motion components to reduce initial bundle size
// These are loaded only when needed and skip SSR

export const MotionDiv = dynamic(
  () => import("motion/react").then((mod) => {
    const Component = mod.motion.div
    return { default: Component }
  }),
  { ssr: false }
) as React.ComponentType<ComponentProps<typeof import("motion/react").motion.div>>

export const MotionSpan = dynamic(
  () => import("motion/react").then((mod) => {
    const Component = mod.motion.span
    return { default: Component }
  }),
  { ssr: false }
) as React.ComponentType<ComponentProps<typeof import("motion/react").motion.span>>

// AnimatePresence needs to be imported directly as it's a wrapper component
// that manages children lifecycle - dynamic import would break its functionality
export { AnimatePresence } from "motion/react"
