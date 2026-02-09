"use client"

import { LazyMotion, domAnimation, AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { ComponentProps } from "react"

// Re-export the slim `m` components wrapped in LazyMotion for reduced bundle size.
// Using `m` + `LazyMotion` reduces the motion bundle from ~34kb to ~4.6kb initial load.
// `domAnimation` covers: animate, exit, initial, transition, variants
// (no drag, layout animations, or scroll — use domMax if those are needed)

function MotionDiv(props: ComponentProps<typeof m.div>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div {...props} />
    </LazyMotion>
  )
}

function MotionSpan(props: ComponentProps<typeof m.span>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.span {...props} />
    </LazyMotion>
  )
}

export { MotionDiv, MotionSpan, AnimatePresence }
