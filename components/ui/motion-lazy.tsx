"use client"

import { LazyMotion, domAnimation, AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { ComponentProps, ReactNode } from "react"

// Re-export the slim `m` components for reduced bundle size.
// Using `m` + `LazyMotion` reduces the motion bundle from ~34kb to ~4.6kb initial load.
// `domAnimation` covers: animate, exit, initial, transition, variants
// (no drag, layout animations, or scroll — use domMax if those are needed)
//
// LazyMotion provider is placed once at the root (MotionProvider) rather than
// per-component to avoid duplicate React context providers in the tree.

function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}

function MotionDiv(props: ComponentProps<typeof m.div>) {
  return <m.div {...props} />
}

function MotionSpan(props: ComponentProps<typeof m.span>) {
  return <m.span {...props} />
}

export { MotionProvider, MotionDiv, MotionSpan, AnimatePresence }
